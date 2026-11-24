-- Part 9a: parents in the app.
--
-- A parent signs in to the app with the phone number on a guardian record and
-- a one-time SMS code (sent by the send-auth-sms hook through the school SMS
-- provider), then types one child's name to link. The name check stops someone
-- who got a recycled number from seeing another family's children.
--
-- A link is between the app account and a guardian record, so the parent sees
-- every child that guardian record is linked to at that school. It ends when the
-- school changes the guardian's number or removes the guardian. Not for tertiary
-- schools.

-- ---------------------------------------------------------------------------
-- Settings and tables
-- ---------------------------------------------------------------------------

-- Off by default: a correct name links straight away.
alter table public.school_settings add column parent_link_approval boolean not null default false;

create type public.parent_link_status as enum ('pending', 'active');

create table public.parent_links (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade deferrable initially immediate,
  guardian_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade deferrable initially immediate,
  status public.parent_link_status not null default 'active',
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references auth.users (id) on delete set null deferrable initially immediate,
  constraint parent_links_unique unique (guardian_id, user_id),
  foreign key (guardian_id, school_id) references public.guardians (id, school_id) on delete cascade deferrable initially immediate
);

create index parent_links_user_idx on public.parent_links (user_id);
create index parent_links_school_idx on public.parent_links (school_id, status);

alter table public.parent_links enable row level security;

-- Parents see their own links; school admins see their school's. Changes go
-- through the functions below.
create policy parent_links_select on public.parent_links
  for select to authenticated
  using (user_id = (select auth.uid()) or private.is_school_admin(school_id));

grant select on public.parent_links to authenticated;

-- Tries at the name check, to stop guessing.
create table private.parent_link_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade deferrable initially immediate,
  matched boolean not null,
  attempted_at timestamptz not null default now()
);

create index parent_link_attempts_user_idx on private.parent_link_attempts (user_id, attempted_at);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- The signed-in person's phone, in +233 format (Supabase stores it without the plus).
create function private.my_phone()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case when u.phone is null or u.phone = '' then null
              when u.phone like '+%' then u.phone
              else '+' || u.phone end
  from auth.users u where u.id = auth.uid();
$$;

-- Schools whose guardians can use the parent app: basic and senior high
-- schools that can send SMS (verified schools, or classes workspaces on Alerts),
-- so sign-in codes only go to numbers a real school added.
create function private.parents_allowed(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select s.type <> 'tertiary' and s.status <> 'suspended' and private.plan_allows(s.id, 'sms')
     from public.schools s where s.id = p_school_id),
    false);
$$;

-- Lower case letters only, for comparing names.
create function private.name_key(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(lower(coalesce(p_text, '')), '[^a-z]', '', 'g');
$$;

-- The children the signed-in parent can see: active students of guardian
-- records they have an active link to.
create function private.my_children()
returns table (student_id uuid, school_id uuid, guardian_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct gl.student_id, gl.school_id, gl.guardian_id
  from public.parent_links pl
  join public.guardian_links gl on gl.guardian_id = pl.guardian_id
  join public.students st on st.id = gl.student_id and st.status = 'active'
  where pl.user_id = auth.uid() and pl.status = 'active' and private.parents_allowed(pl.school_id);
$$;

-- One row per school day for a child: the days the child's class had a
-- register, and any day the child was marked (for example in an old class).
-- Present if present in any register that day, late if only late, absent if
-- absent in all; null if the class had a register but the child was not marked.
create function private.child_days(p_student_id uuid, p_from date, p_to date)
returns table (day date, mark text)
language sql
stable
security definer
set search_path = ''
as $$
  with entries as (
    select r.register_date as day,
           bool_or(e.mark = 'present') as any_present,
           bool_or(e.mark = 'late') as any_late,
           bool_or(e.mark = 'absent') as any_absent
    from public.register_entries e
    join public.registers r on r.id = e.register_id
    where e.student_id = p_student_id and r.register_date between p_from and p_to
    group by r.register_date
  ),
  days as (
    select r.register_date as day
    from public.registers r
    join public.students st on st.id = p_student_id and st.class_id = r.class_id
    where r.register_date between p_from and p_to
    union
    select day from entries
  )
  select d.day,
         case when en.any_present then 'present' when en.any_late then 'late' when en.any_absent then 'absent' end
  from days d
  left join entries en on en.day = d.day
  order by d.day;
$$;

-- ---------------------------------------------------------------------------
-- The sign-in code hook (service role only)
-- ---------------------------------------------------------------------------

-- Whether a sign-in code may be sent to this number: it must be a guardian's
-- number at a school that uses the parent app.
create function public.auth_sms_allowed(p_phone text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.guardians g
    where g.phone = case when p_phone like '+%' then p_phone else '+' || p_phone end
      and private.parents_allowed(g.school_id)
  );
$$;

revoke execute on function public.auth_sms_allowed(text) from public, anon, authenticated;
grant execute on function public.auth_sms_allowed(text) to service_role;

-- ---------------------------------------------------------------------------
-- Parent functions
-- ---------------------------------------------------------------------------

-- What the app needs to know first: linked, waiting, and guardian records with
-- this number that still need a child's name.
create function public.parent_status()
returns table (phone text, active integer, pending integer, unlinked integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_phone text := private.my_phone();
begin
  if auth.uid() is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  return query
  select v_phone,
         (select count(*)::integer from public.parent_links pl
          where pl.user_id = auth.uid() and pl.status = 'active' and private.parents_allowed(pl.school_id)),
         (select count(*)::integer from public.parent_links pl
          where pl.user_id = auth.uid() and pl.status = 'pending' and private.parents_allowed(pl.school_id)),
         (select count(*)::integer from public.guardians g
          where v_phone is not null and g.phone = v_phone and private.parents_allowed(g.school_id)
            and not exists (select 1 from public.parent_links pl where pl.guardian_id = g.id and pl.user_id = auth.uid()));
end;
$$;

-- Links every guardian record with the parent's number that has a child with
-- this name (any one of the child's names). Five wrong names a day at most.
create function public.parent_link_children(p_name text)
returns table (linked integer, pending integer, remaining integer)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user uuid := auth.uid();
  v_phone text := private.my_phone();
  v_key text := private.name_key(p_name);
  v_linked integer := 0;
  v_pending integer := 0;
  r record;
begin
  if v_user is null or v_phone is null then
    raise exception 'Sign in with your phone number first.' using errcode = '42501';
  end if;
  if char_length(v_key) < 2 or char_length(coalesce(p_name, '')) > 60 then
    raise exception 'Type one of your child''s names.' using errcode = '22023';
  end if;
  if (select count(*) from private.parent_link_attempts a
      where a.user_id = v_user and not a.matched and a.attempted_at > now() - interval '24 hours') >= 5 then
    raise exception 'Too many tries. Try again tomorrow, or ask the school to check your child''s name.'
      using errcode = 'P0001';
  end if;

  for r in
    select g.id as guardian_id, g.school_id, coalesce(ss.parent_link_approval, false) as needs_approval
    from public.guardians g
    left join public.school_settings ss on ss.school_id = g.school_id
    where g.phone = v_phone
      and private.parents_allowed(g.school_id)
      and not exists (select 1 from public.parent_links pl where pl.guardian_id = g.id and pl.user_id = v_user)
      and exists (
        select 1 from public.guardian_links gl
        join public.students st on st.id = gl.student_id and st.status = 'active'
        where gl.guardian_id = g.id
          and v_key = any (select private.name_key(w) from regexp_split_to_table(st.full_name, '\s+') w)
      )
  loop
    insert into public.parent_links (school_id, guardian_id, user_id, status)
    values (r.school_id, r.guardian_id, v_user, case when r.needs_approval then 'pending' else 'active' end::public.parent_link_status);
    if r.needs_approval then v_pending := v_pending + 1; else v_linked := v_linked + 1; end if;
  end loop;

  insert into private.parent_link_attempts (user_id, matched) values (v_user, v_linked + v_pending > 0);

  return query
  select v_linked, v_pending,
         (select count(*)::integer from public.guardians g
          where g.phone = v_phone and private.parents_allowed(g.school_id)
            and not exists (select 1 from public.parent_links pl where pl.guardian_id = g.id and pl.user_id = v_user));
end;
$$;

-- The parent's children with this term's attendance. Waiting links show the
-- school only.
create function public.parent_children()
returns table (
  student_id uuid,
  full_name text,
  school_id uuid,
  school_name text,
  class_name text,
  period_name text,
  period_starts date,
  period_ends date,
  held integer,
  attended integer,
  late integer,
  absent integer,
  today_mark text,
  today_held boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_today date := private.ghana_today();
begin
  if auth.uid() is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  return query
  with kids as (
    select distinct c.student_id, c.school_id from private.my_children() c
  ),
  terms as (
    select k.student_id, ap.name, ap.starts_on, ap.ends_on
    from kids k
    left join lateral (
      select p.name, p.starts_on, p.ends_on from public.academic_periods p
      where p.school_id = k.school_id and p.starts_on <= v_today
      order by (v_today between p.starts_on and p.ends_on) desc, p.starts_on desc
      limit 1
    ) ap on true
  ),
  totals as (
    select t.student_id,
           count(*)::integer as held,
           count(*) filter (where d.mark in ('present', 'late'))::integer as attended,
           count(*) filter (where d.mark = 'late')::integer as late,
           count(*) filter (where d.mark = 'absent')::integer as absent
    from terms t
    cross join lateral private.child_days(t.student_id, coalesce(t.starts_on, v_today), least(coalesce(t.ends_on, v_today), v_today)) d
    group by t.student_id
  ),
  today as (
    select k.student_id, d.mark, true as held
    from kids k
    cross join lateral private.child_days(k.student_id, v_today, v_today) d
  )
  select st.id, st.full_name, s.id, s.name, cl.name, t.name, t.starts_on, t.ends_on,
         coalesce(tt.held, 0), coalesce(tt.attended, 0), coalesce(tt.late, 0), coalesce(tt.absent, 0),
         td.mark, coalesce(td.held, false)
  from kids k
  join public.students st on st.id = k.student_id
  join public.schools s on s.id = k.school_id
  left join public.classes cl on cl.id = st.class_id
  left join terms t on t.student_id = k.student_id
  left join totals tt on tt.student_id = k.student_id
  left join today td on td.student_id = k.student_id
  union all
  -- Waiting for the school to confirm: no child details yet.
  select null, null, s.id, s.name, null, null, null, null, 0, 0, 0, 0, null, false
  from public.parent_links pl
  join public.schools s on s.id = pl.school_id
  where pl.user_id = auth.uid() and pl.status = 'pending' and private.parents_allowed(pl.school_id)
  order by 4, 2 nulls last;
end;
$$;

-- One child's school days between two dates (at most a year).
create function public.parent_child_days(p_student_id uuid, p_from date, p_to date)
returns table (day date, mark text)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not exists (select 1 from private.my_children() c where c.student_id = p_student_id) then
    raise exception 'You cannot see this child.' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 370 then
    raise exception 'Choose up to a year of dates.' using errcode = '22023';
  end if;
  return query select d.day, d.mark from private.child_days(p_student_id, p_from, p_to) d;
end;
$$;

-- The SMS the schools sent to this number (alerts, messages and notices), for
-- schools the parent is linked to.
create function public.parent_messages(p_before bigint default null, p_limit integer default 50)
returns table (id bigint, school_name text, kind text, body text, sent_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_phone text := private.my_phone();
begin
  if v_phone is null then
    raise exception 'Sign in with your phone number first.' using errcode = '42501';
  end if;
  return query
  select o.id, s.name, o.kind::text, o.body, coalesce(o.sent_at, o.created_at)
  from public.sms_outbox o
  join public.schools s on s.id = o.school_id
  where o.to_phone = v_phone
    and o.status = 'sent'
    and o.school_id in (
      select pl.school_id from public.parent_links pl
      where pl.user_id = auth.uid() and pl.status = 'active' and private.parents_allowed(pl.school_id)
    )
    and (p_before is null or o.id < p_before)
  order by o.id desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
end;
$$;

-- The parent's links, for the Account screen.
create function public.parent_my_links()
returns table (id uuid, school_name text, status text, children text[], created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select pl.id, s.name, pl.status::text,
         case when pl.status = 'active' then
           array(select st.full_name from public.guardian_links gl
                 join public.students st on st.id = gl.student_id and st.status = 'active'
                 where gl.guardian_id = pl.guardian_id order by st.full_name)
         else array[]::text[] end,
         pl.created_at
  from public.parent_links pl
  join public.schools s on s.id = pl.school_id
  where pl.user_id = auth.uid()
  order by s.name;
$$;

-- A parent removes one of their links (they can link again with a name).
create function public.parent_unlink(p_link_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  delete from public.parent_links where id = p_link_id and user_id = auth.uid();
  if not found then
    raise exception 'This link is not yours.' using errcode = '42501';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- School functions
-- ---------------------------------------------------------------------------

-- The school's app links for the Parent app page.
create function public.school_parent_links(p_school_id uuid)
returns table (
  id uuid,
  status text,
  guardian_id uuid,
  guardian_name text,
  phone text,
  children text[],
  created_at timestamptz,
  approved_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not private.is_school_admin(p_school_id) then
    raise exception 'Only admins can see parent app links.' using errcode = '42501';
  end if;
  return query
  select pl.id, pl.status::text, g.id, g.full_name, g.phone,
         array(select st.full_name from public.guardian_links gl
               join public.students st on st.id = gl.student_id and st.status = 'active'
               where gl.guardian_id = g.id order by st.full_name),
         pl.created_at, pl.approved_at
  from public.parent_links pl
  join public.guardians g on g.id = pl.guardian_id
  where pl.school_id = p_school_id
  order by (pl.status = 'pending') desc, pl.created_at desc;
end;
$$;

create function public.approve_parent_link(p_link_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_link public.parent_links;
begin
  select * into v_link from public.parent_links where id = p_link_id;
  if v_link.id is null or not private.is_school_admin(v_link.school_id) then
    raise exception 'You cannot change this link.' using errcode = '42501';
  end if;
  if v_link.status = 'active' then
    return;
  end if;
  update public.parent_links set status = 'active', approved_at = now(), approved_by = auth.uid() where id = p_link_id;
  perform private.queue_push(v_link.user_id, 'Your child is linked',
    (select s.name from public.schools s where s.id = v_link.school_id) || ' confirmed your link. You can now see your child''s attendance.',
    jsonb_build_object('parentLink', v_link.id));
end;
$$;

-- Removes an app link. The parent is told; they can link again unless the
-- school changes or removes the guardian's number.
create function public.remove_parent_link(p_link_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_link public.parent_links;
begin
  select * into v_link from public.parent_links where id = p_link_id;
  if v_link.id is null or not private.is_school_admin(v_link.school_id) then
    raise exception 'You cannot change this link.' using errcode = '42501';
  end if;
  delete from public.parent_links where id = p_link_id;
  perform private.queue_push(v_link.user_id, 'Link removed',
    (select s.name from public.schools s where s.id = v_link.school_id) || ' removed your link in the RollCol app. Ask the school if this is a mistake.',
    '{}'::jsonb);
end;
$$;

create function public.set_parent_link_approval(p_school_id uuid, p_required boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not private.is_school_admin(p_school_id) then
    raise exception 'Only admins can change this.' using errcode = '42501';
  end if;
  update public.school_settings set parent_link_approval = coalesce(p_required, false), updated_by = auth.uid()
  where school_id = p_school_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- A new number ends the link
-- ---------------------------------------------------------------------------

create function private.end_parent_links_on_phone_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in delete from public.parent_links where guardian_id = new.id returning user_id loop
    perform private.queue_push(r.user_id, 'Link ended',
      (select s.name from public.schools s where s.id = new.school_id)
        || ' changed the phone number on your guardian record, so your children are no longer linked to this app.',
      '{}'::jsonb);
  end loop;
  return new;
end;
$$;

create trigger guardians_end_parent_links
  after update of phone on public.guardians
  for each row when (old.phone is distinct from new.phone)
  execute function private.end_parent_links_on_phone_change();

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke execute on function
  public.parent_status(),
  public.parent_link_children(text),
  public.parent_children(),
  public.parent_child_days(uuid, date, date),
  public.parent_messages(bigint, integer),
  public.parent_my_links(),
  public.parent_unlink(uuid),
  public.school_parent_links(uuid),
  public.approve_parent_link(uuid),
  public.remove_parent_link(uuid),
  public.set_parent_link_approval(uuid, boolean)
from public, anon;

grant execute on function
  public.parent_status(),
  public.parent_link_children(text),
  public.parent_children(),
  public.parent_child_days(uuid, date, date),
  public.parent_messages(bigint, integer),
  public.parent_my_links(),
  public.parent_unlink(uuid),
  public.school_parent_links(uuid),
  public.approve_parent_link(uuid),
  public.remove_parent_link(uuid),
  public.set_parent_link_approval(uuid, boolean)
to authenticated;
