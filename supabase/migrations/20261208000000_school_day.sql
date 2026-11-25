-- Part 9d: the school day, absence reports for several children, and parents
-- asking for a new phone number.
--
-- The school day: arrival and closing times and breaks for each weekday, for
-- the whole school, with different times for a class where needed; and one-off
-- changes for a day (closed, opening later, closing earlier), which can tell the
-- parents of the classes affected. Parents see each day's times with their
-- child's attendance.
--
-- Number changes: a parent asks for the school to use a new number. An admin
-- approves (or declines) on the Parent app page; approving changes the
-- guardian's number, which tells both numbers by SMS as before and ends the
-- app link (the parent signs in with the new number).

-- ---------------------------------------------------------------------------
-- No alert for a reported absence, also when marks change after alerts went out
-- ---------------------------------------------------------------------------

create function private.swap_in_function(p_function regprocedure, p_old text, p_new text, p_times integer default 1)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_source text := pg_get_functiondef(p_function);
  v_found integer := (char_length(v_source) - char_length(replace(v_source, p_old, ''))) / char_length(p_old);
begin
  if v_found <> p_times then
    raise exception 'Expected % of "%" in %, found %.', p_times, p_old, p_function, v_found;
  end if;
  execute replace(v_source, p_old, p_new);
end;
$$;

select private.swap_in_function('private.attendance_change_alert()'::regprocedure,
  $old$elsif new.mark = 'absent' and (tg_op = 'INSERT' or old.mark <> 'absent') then$old$,
  $new$elsif new.mark = 'absent' and (tg_op = 'INSERT' or old.mark <> 'absent')
        and not private.absence_reported(new.student_id, v_register.register_date) then$new$);

drop function private.swap_in_function(regprocedure, text, text, integer);

-- ---------------------------------------------------------------------------
-- One absence report for several children
-- ---------------------------------------------------------------------------

create function public.parent_report_absences(
  p_student_ids uuid[],
  p_from date,
  p_to date,
  p_reason text,
  p_note text default null
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_count integer := 0;
begin
  if p_student_ids is null or cardinality(p_student_ids) = 0 then
    raise exception 'Choose at least one child.' using errcode = '22023';
  end if;
  foreach v_id in array (select array_agg(distinct x) from unnest(p_student_ids) x) loop
    perform public.parent_report_absence(v_id, p_from, p_to, p_reason, p_note);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- The school day
-- ---------------------------------------------------------------------------

create table public.school_day_times (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade deferrable initially immediate,
  -- Null: the whole school. A class: times for that class instead.
  class_id uuid references public.classes (id) on delete cascade deferrable initially immediate,
  weekday smallint not null check (weekday between 1 and 7), -- 1 is Monday
  opens_at time not null,
  closes_at time not null,
  -- [{"label": "Break", "start": "10:00", "end": "10:30"}]
  breaks jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null deferrable initially immediate,
  constraint school_day_times_order check (closes_at > opens_at),
  constraint school_day_times_one unique nulls not distinct (school_id, class_id, weekday)
);

create table public.school_day_changes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade deferrable initially immediate,
  class_id uuid references public.classes (id) on delete cascade deferrable initially immediate,
  day date not null,
  closed boolean not null default false,
  opens_at time,
  closes_at time,
  note text check (char_length(note) <= 200),
  created_by uuid references auth.users (id) on delete set null deferrable initially immediate,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  constraint school_day_changes_something check (closed or opens_at is not null or closes_at is not null)
);

create index school_day_changes_day_idx on public.school_day_changes (school_id, day) where cancelled_at is null;

alter table public.school_day_times enable row level security;
alter table public.school_day_changes enable row level security;
create policy school_day_times_select on public.school_day_times for select to authenticated
  using (private.is_school_staff(school_id));
create policy school_day_changes_select on public.school_day_changes for select to authenticated
  using (private.is_school_staff(school_id));
grant select on public.school_day_times, public.school_day_changes to authenticated;

-- "7:30am", for messages.
create function private.clock(p_time time)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(to_char(p_time, 'FMHH12:MIam'));
$$;

-- Checks and tidies a list of breaks: [{"label", "start", "end"}], at most 4.
create function private.clean_breaks(p_breaks jsonb, p_opens time, p_closes time)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_out jsonb := '[]'::jsonb;
  b jsonb;
  v_start time;
  v_end time;
begin
  if p_breaks is null or jsonb_typeof(p_breaks) <> 'array' then
    return v_out;
  end if;
  if jsonb_array_length(p_breaks) > 4 then
    raise exception 'Add at most 4 breaks a day.' using errcode = '22023';
  end if;
  for b in select * from jsonb_array_elements(p_breaks) loop
    begin
      v_start := (b ->> 'start')::time;
      v_end := (b ->> 'end')::time;
    exception when others then
      raise exception 'Give each break a start and an end time.' using errcode = '22023';
    end;
    if v_end <= v_start or v_start < p_opens or v_end > p_closes then
      raise exception 'Each break must end after it starts, within the school day.' using errcode = '22023';
    end if;
    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'label', left(coalesce(nullif(trim(b ->> 'label'), ''), 'Break'), 30),
      'start', to_char(v_start, 'HH24:MI'),
      'end', to_char(v_end, 'HH24:MI')));
  end loop;
  return (select coalesce(jsonb_agg(x order by x ->> 'start'), '[]'::jsonb) from jsonb_array_elements(v_out) x);
end;
$$;

-- The usual times of a school or a class. p_days: [{"weekday": 1, "opens": "07:30",
-- "closes": "15:00", "breaks": [...]}]; a weekday left out has no school day. For a
-- class, an empty list goes back to the school's times. App parents are told.
create function public.set_school_day(p_school_id uuid, p_class_id uuid, p_days jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  d jsonb;
  v_opens time;
  v_closes time;
  v_weekday smallint;
  r record;
begin
  if not private.is_school_admin(p_school_id) then
    raise exception 'Only admins can set the school day.' using errcode = '42501';
  end if;
  if p_class_id is not null and not exists (select 1 from public.classes c where c.id = p_class_id and c.school_id = p_school_id) then
    raise exception 'Choose a class of this school.' using errcode = '22023';
  end if;
  if p_days is null or jsonb_typeof(p_days) <> 'array' then
    raise exception 'Give the days as a list.' using errcode = '22023';
  end if;

  delete from public.school_day_times where school_id = p_school_id and class_id is not distinct from p_class_id;
  for d in select * from jsonb_array_elements(p_days) loop
    begin
      v_weekday := (d ->> 'weekday')::smallint;
      v_opens := (d ->> 'opens')::time;
      v_closes := (d ->> 'closes')::time;
    exception when others then
      raise exception 'Give each day an arrival and a closing time.' using errcode = '22023';
    end;
    if v_weekday is null or v_weekday not between 1 and 7 or v_opens is null or v_closes is null or v_closes <= v_opens then
      raise exception 'Each day must close after it opens.' using errcode = '22023';
    end if;
    insert into public.school_day_times (school_id, class_id, weekday, opens_at, closes_at, breaks, updated_by)
    values (p_school_id, p_class_id, v_weekday, v_opens, v_closes, private.clean_breaks(d -> 'breaks', v_opens, v_closes), auth.uid());
  end loop;

  -- App parents of the classes affected are told (no SMS).
  for r in
    select distinct pl.user_id
    from public.parent_links pl
    join public.guardian_links gl on gl.guardian_id = pl.guardian_id
    join public.students st on st.id = gl.student_id and st.status = 'active'
    where pl.school_id = p_school_id and pl.status = 'active'
      and (p_class_id is null or st.class_id = p_class_id)
  loop
    perform private.queue_push(r.user_id, left(private.sms_school_name(p_school_id), 100),
      'The school day times have changed. See them with your child''s attendance in RollCol.',
      jsonb_build_object('schoolDay', true));
  end loop;
end;
$$;

-- One day's times for a class (with any one-off change), or null when there is no school day.
create function private.day_for_class(p_school_id uuid, p_class_id uuid, p_day date)
returns table (opens_at time, closes_at time, breaks jsonb, closed boolean, note text, changed boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with usual as (
    select t.opens_at, t.closes_at, t.breaks
    from public.school_day_times t
    where t.school_id = p_school_id and t.weekday = extract(isodow from p_day)::smallint
      and (t.class_id = p_class_id or t.class_id is null)
    order by t.class_id nulls last
    limit 1
  ),
  change as (
    select c.* from public.school_day_changes c
    where c.school_id = p_school_id and c.day = p_day and c.cancelled_at is null
      and (c.class_id = p_class_id or c.class_id is null)
    order by c.class_id nulls last, c.created_at desc
    limit 1
  )
  select coalesce(ch.opens_at, u.opens_at), coalesce(ch.closes_at, u.closes_at),
         case when ch.closed then '[]'::jsonb else coalesce(u.breaks, '[]'::jsonb) end,
         coalesce(ch.closed, false), ch.note, ch.id is not null
  from (select 1) one
  left join usual u on true
  left join change ch on true
  where u.opens_at is not null or ch.id is not null;
$$;

-- One-off changes for a day, for the whole school (p_class_ids null) or some
-- classes. With p_notify, guardians of those classes are told the way their
-- channel says (in the app first; an SMS uses the school's credits).
create function public.add_school_day_change(
  p_school_id uuid,
  p_class_ids uuid[],
  p_day date,
  p_closed boolean,
  p_opens time,
  p_closes time,
  p_note text,
  p_notify boolean
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_class uuid;
  v_classes uuid[] := case when p_class_ids is null or cardinality(p_class_ids) = 0 then array[null::uuid] else p_class_ids end;
  v_text text;
  v_body text;
  v_segments integer;
  v_needed integer;
  v_message bigint;
  v_guardian record;
begin
  if not private.is_school_admin(p_school_id) then
    raise exception 'Only admins can change the school day.' using errcode = '42501';
  end if;
  if p_day is null or p_day < private.ghana_today() or p_day > private.ghana_today() + 180 then
    raise exception 'Choose today or a day in the next six months.' using errcode = '22023';
  end if;
  if not coalesce(p_closed, false) and p_opens is null and p_closes is null then
    raise exception 'Say whether the school is closed, or give the new times.' using errcode = '22023';
  end if;
  if p_opens is not null and p_closes is not null and p_closes <= p_opens then
    raise exception 'The day must close after it opens.' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(p_class_ids) c
             where c is not null and not exists (select 1 from public.classes k where k.id = c and k.school_id = p_school_id)) then
    raise exception 'Choose classes of this school.' using errcode = '22023';
  end if;

  foreach v_class in array v_classes loop
    insert into public.school_day_changes (school_id, class_id, day, closed, opens_at, closes_at, note, created_by)
    values (p_school_id, v_class, p_day, coalesce(p_closed, false),
            case when p_closed then null else p_opens end, case when p_closed then null else p_closes end,
            nullif(left(trim(coalesce(p_note, '')), 200), ''), auth.uid());
  end loop;

  if not coalesce(p_notify, false) then
    return cardinality(v_classes);
  end if;

  v_text := to_char(p_day, 'FMDay FMDD Mon') || ': '
    || case
         when p_closed then 'school is closed'
         when p_opens is not null and p_closes is not null then 'school opens at ' || private.clock(p_opens) || ' and closes at ' || private.clock(p_closes)
         when p_opens is not null then 'school opens at ' || private.clock(p_opens)
         else 'school closes at ' || private.clock(p_closes)
       end
    || '.' || coalesce(' ' || nullif(left(trim(coalesce(p_note, '')), 200), ''), '');
  v_body := private.sms_school_name(p_school_id) || ': ' || v_text;
  v_segments := private.sms_segments(private.sms_clean(v_body));

  create temporary table if not exists pg_temp.day_change_guardians (guardian_id uuid, phone text) on commit drop;
  truncate pg_temp.day_change_guardians;
  insert into pg_temp.day_change_guardians
  select distinct on (g.phone) g.id, g.phone
  from public.guardians g
  join public.guardian_links gl on gl.guardian_id = g.id and gl.alerts_enabled
  join public.students st on st.id = gl.student_id and st.status = 'active'
  where g.school_id = p_school_id and g.phone is not null
    and (p_class_ids is null or cardinality(p_class_ids) = 0 or st.class_id = any (p_class_ids));

  select count(*) * v_segments into v_needed from pg_temp.day_change_guardians d
  where coalesce(private.guardian_route(d.guardian_id), 'sms') = 'sms';
  if v_needed > 0 and private.sms_balance(p_school_id) < v_needed then
    raise exception 'Telling the parents needs % SMS credits, but the school has %. Buy credits, or save without telling them.',
      v_needed, private.sms_balance(p_school_id) using errcode = 'P0001';
  end if;

  insert into public.sms_messages (school_id, kind, audience, body, recipients, created_by)
  values (p_school_id, 'broadcast', case when p_class_ids is null or cardinality(p_class_ids) = 0 then 'All guardians' else 'Some classes' end,
          v_text, (select count(*) from pg_temp.day_change_guardians), auth.uid())
  returning id into v_message;

  for v_guardian in select * from pg_temp.day_change_guardians loop
    perform private.deliver_to_guardian(p_school_id, 'broadcast', v_guardian.phone, v_body, v_guardian.guardian_id, v_message, auth.uid(), 'messages');
  end loop;
  return cardinality(v_classes);
end;
$$;

create function public.cancel_school_day_change(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  update public.school_day_changes set cancelled_at = now()
  where id = p_id and cancelled_at is null and private.is_school_admin(school_id);
  if not found then
    raise exception 'This change cannot be cancelled.' using errcode = 'P0001';
  end if;
end;
$$;

-- Each day's times for one of the parent's children, between two dates.
create function public.parent_school_days(p_student_id uuid, p_from date, p_to date)
returns table (day date, opens_at time, closes_at time, breaks jsonb, closed boolean, note text, changed boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_student public.students;
begin
  if not exists (select 1 from private.my_children() c where c.student_id = p_student_id) then
    raise exception 'You cannot see this child.' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 31 then
    raise exception 'Choose up to a month of dates.' using errcode = '22023';
  end if;
  select * into v_student from public.students where id = p_student_id;
  return query
  select d::date, x.opens_at, x.closes_at, x.breaks, x.closed, x.note, x.changed
  from generate_series(p_from, p_to, interval '1 day') d
  cross join lateral private.day_for_class(v_student.school_id, v_student.class_id, d::date) x;
end;
$$;

-- ---------------------------------------------------------------------------
-- Parents asking for a new phone number
-- ---------------------------------------------------------------------------

create table public.guardian_phone_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade deferrable initially immediate,
  guardian_id uuid not null,
  requested_by uuid not null references auth.users (id) on delete cascade deferrable initially immediate,
  new_phone text not null check (new_phone ~ '^\+[1-9][0-9]{7,14}$'),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  decided_by uuid references auth.users (id) on delete set null deferrable initially immediate,
  decided_at timestamptz,
  foreign key (guardian_id, school_id) references public.guardians (id, school_id) on delete cascade deferrable initially immediate
);

create unique index guardian_phone_requests_one_pending on public.guardian_phone_requests (guardian_id) where status = 'pending';

alter table public.guardian_phone_requests enable row level security;
create policy guardian_phone_requests_select on public.guardian_phone_requests for select to authenticated
  using (requested_by = (select auth.uid()) or private.is_school_admin(school_id));
grant select on public.guardian_phone_requests to authenticated;

create function public.parent_request_phone_change(p_link_id uuid, p_new_phone text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_link public.parent_links;
  v_old text;
  v_child text;
  r record;
begin
  select * into v_link from public.parent_links where id = p_link_id and user_id = auth.uid() and status = 'active';
  if v_link.id is null then
    raise exception 'Choose one of your schools.' using errcode = '42501';
  end if;
  if p_new_phone is null or p_new_phone !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'Check the new number.' using errcode = '22023';
  end if;
  select g.phone into v_old from public.guardians g where g.id = v_link.guardian_id;
  if v_old = p_new_phone then
    raise exception 'That is already the number the school has.' using errcode = '22023';
  end if;
  update public.guardian_phone_requests set status = 'cancelled'
  where guardian_id = v_link.guardian_id and status = 'pending';
  insert into public.guardian_phone_requests (school_id, guardian_id, requested_by, new_phone)
  values (v_link.school_id, v_link.guardian_id, auth.uid(), p_new_phone);

  select string_agg(st.full_name, ', ' order by st.full_name) into v_child
  from public.guardian_links gl join public.students st on st.id = gl.student_id and st.status = 'active'
  where gl.guardian_id = v_link.guardian_id;
  for r in select sf.user_id from public.staff sf
           where sf.school_id = v_link.school_id and sf.role = 'admin' and sf.status = 'active' and sf.user_id is not null loop
    perform private.queue_push(r.user_id, 'New number requested',
      'A parent of ' || coalesce(v_child, 'a child') || ' asks to use a new phone number. Check it on the Parent app page.',
      jsonb_build_object('phoneRequest', true));
  end loop;
end;
$$;

create function public.parent_cancel_phone_change(p_id uuid)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.guardian_phone_requests set status = 'cancelled'
  where id = p_id and requested_by = (select auth.uid()) and status = 'pending';
$$;

create function public.school_phone_requests(p_school_id uuid)
returns table (
  id uuid, guardian_id uuid, guardian_name text, old_phone text, new_phone text, children text[], created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not private.is_school_admin(p_school_id) then
    raise exception 'Only admins can see number changes.' using errcode = '42501';
  end if;
  return query
  select q.id, g.id, g.full_name, g.phone, q.new_phone,
         array(select st.full_name from public.guardian_links gl
               join public.students st on st.id = gl.student_id and st.status = 'active'
               where gl.guardian_id = g.id order by st.full_name),
         q.created_at
  from public.guardian_phone_requests q
  join public.guardians g on g.id = q.guardian_id
  where q.school_id = p_school_id and q.status = 'pending'
  order by q.created_at;
end;
$$;

-- Approving changes the guardian's number: both numbers get the usual SMS, and
-- the app link ends (the parent signs in again with the new number).
create function public.decide_phone_request(p_id uuid, p_approve boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_request public.guardian_phone_requests;
  v_school text;
begin
  select * into v_request from public.guardian_phone_requests where id = p_id for update;
  if v_request.id is null or not private.is_school_admin(v_request.school_id) then
    raise exception 'You cannot decide this request.' using errcode = '42501';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'This request is already decided.' using errcode = 'P0001';
  end if;
  update public.guardian_phone_requests
  set status = case when p_approve then 'approved' else 'declined' end, decided_by = auth.uid(), decided_at = now()
  where id = p_id;

  v_school := private.sms_school_name(v_request.school_id);
  if p_approve then
    -- Told first: the number change below ends the link.
    perform private.queue_push(v_request.requested_by, left(v_school, 100),
      'Your new number is approved. Sign in to RollCol with it to see your children again.', '{}'::jsonb);
    update public.guardians set phone = v_request.new_phone where id = v_request.guardian_id;
  else
    perform private.queue_push(v_request.requested_by, left(v_school, 100),
      'The school did not change your number. Contact the school if you need to.', '{}'::jsonb);
  end if;
end;
$$;

-- The parent's links now also give the school, to match number change requests.
drop function public.parent_my_links();
create function public.parent_my_links()
returns table (id uuid, school_id uuid, school_name text, status text, children text[], created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select pl.id, s.id, s.name, pl.status::text,
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
revoke execute on function public.parent_my_links() from public, anon;
grant execute on function public.parent_my_links() to authenticated;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke execute on function
  public.parent_report_absences(uuid[], date, date, text, text),
  public.set_school_day(uuid, uuid, jsonb),
  public.add_school_day_change(uuid, uuid[], date, boolean, time, time, text, boolean),
  public.cancel_school_day_change(uuid),
  public.parent_school_days(uuid, date, date),
  public.parent_request_phone_change(uuid, text),
  public.parent_cancel_phone_change(uuid),
  public.school_phone_requests(uuid),
  public.decide_phone_request(uuid, boolean)
from public, anon;

grant execute on function
  public.parent_report_absences(uuid[], date, date, text, text),
  public.set_school_day(uuid, uuid, jsonb),
  public.add_school_day_change(uuid, uuid[], date, boolean, time, time, text, boolean),
  public.cancel_school_day_change(uuid),
  public.parent_school_days(uuid, date, date),
  public.parent_request_phone_change(uuid, text),
  public.parent_cancel_phone_change(uuid),
  public.school_phone_requests(uuid),
  public.decide_phone_request(uuid, boolean)
to authenticated;
