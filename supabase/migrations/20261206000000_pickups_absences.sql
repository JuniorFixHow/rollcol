-- Part 9c: pickup codes and absence reports, from parents in the app or on the website.
--
-- Pickup codes: a parent who cannot collect their child makes a six-digit code
-- for that child and day, with the collector's name, and gives it to the
-- collector. A teacher types the code, sees the child and the collector's name,
-- and confirms the release. A code works once, for one child, only on its day;
-- the parent can cancel it, and is told when the child is released. Staff never
-- see the codes themselves, only check one that is typed in (with a limit on
-- wrong tries).
--
-- Absence reports: a parent tells the school ahead that a child will be absent
-- (up to two weeks, with a reason). The class teacher is told, the register
-- shows it next to the child, and no "absent" alert is sent for those days.

-- ---------------------------------------------------------------------------
-- Pickup codes
-- ---------------------------------------------------------------------------

create table public.pickup_codes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade deferrable initially immediate,
  student_id uuid not null,
  created_by uuid not null references auth.users (id) on delete cascade deferrable initially immediate,
  code text not null check (code ~ '^[0-9]{6}$'),
  pickup_date date not null,
  collector_name text not null check (char_length(collector_name) between 2 and 80),
  collector_phone text,
  status text not null default 'active' check (status in ('active', 'used', 'cancelled')),
  created_at timestamptz not null default now(),
  used_at timestamptz,
  released_by uuid references auth.users (id) on delete set null deferrable initially immediate,
  foreign key (student_id, school_id) references public.students (id, school_id) on delete cascade deferrable initially immediate
);

-- One active code with these digits per school and day, so a typed code finds one child.
create unique index pickup_codes_active_code on public.pickup_codes (school_id, pickup_date, code) where status = 'active';
create index pickup_codes_parent_idx on public.pickup_codes (created_by, pickup_date);
create index pickup_codes_school_day_idx on public.pickup_codes (school_id, pickup_date);

alter table public.pickup_codes enable row level security;
-- Parents read their own codes. Staff use school_pickups and check_pickup_code,
-- which never return the digits.
create policy pickup_codes_select on public.pickup_codes
  for select to authenticated using (created_by = (select auth.uid()));
grant select on public.pickup_codes to authenticated;

-- Wrong codes typed by staff, to stop guessing.
create table private.pickup_code_tries (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade deferrable initially immediate,
  school_id uuid not null,
  tried_at timestamptz not null default now()
);
create index pickup_code_tries_user_idx on private.pickup_code_tries (user_id, tried_at);

-- The staff (as app users) who teach a child's class: the class teacher.
create function private.class_teacher_users(p_student_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select sf.user_id from public.students st
  join public.classes c on c.id = st.class_id
  join public.staff sf on sf.id = c.class_teacher_id and sf.status = 'active'
  where st.id = p_student_id and sf.user_id is not null;
$$;

-- Today and up to a week ahead.
create function public.parent_create_pickup(
  p_student_id uuid,
  p_date date,
  p_collector_name text,
  p_collector_phone text default null
)
returns table (id uuid, code text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_school uuid;
  v_today date := private.ghana_today();
  v_date date := coalesce(p_date, private.ghana_today());
  v_code text;
  v_id uuid;
  v_tries integer := 0;
begin
  select c.school_id into v_school from private.my_children() c where c.student_id = p_student_id limit 1;
  if v_school is null then
    raise exception 'You cannot make a code for this child.' using errcode = '42501';
  end if;
  if v_date < v_today or v_date > v_today + 7 then
    raise exception 'Choose today or a day in the next week.' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_collector_name, ''))) < 2 then
    raise exception 'Type the name of the person collecting your child.' using errcode = '22023';
  end if;
  if (select count(*) from public.pickup_codes pc
      where pc.student_id = p_student_id and pc.pickup_date = v_date and pc.status = 'active') >= 3 then
    raise exception 'This child already has 3 codes for that day. Cancel one first.' using errcode = 'P0001';
  end if;

  loop
    v_code := lpad((floor(random() * 1000000))::integer::text, 6, '0');
    begin
      insert into public.pickup_codes (school_id, student_id, created_by, code, pickup_date, collector_name, collector_phone)
      values (v_school, p_student_id, auth.uid(), v_code, v_date, trim(p_collector_name),
              nullif(trim(coalesce(p_collector_phone, '')), ''))
      returning pickup_codes.id into v_id;
      exit;
    exception when unique_violation then
      v_tries := v_tries + 1;
      if v_tries > 20 then
        raise exception 'RollCol could not make a code. Please try again.' using errcode = 'P0001';
      end if;
    end;
  end loop;
  return query select v_id, v_code;
end;
$$;

create function public.parent_cancel_pickup(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  update public.pickup_codes set status = 'cancelled'
  where id = p_id and created_by = auth.uid() and status = 'active';
  if not found then
    raise exception 'This code cannot be cancelled (it is used, cancelled or not yours).' using errcode = 'P0001';
  end if;
end;
$$;

-- The parent's codes from the last week and ahead, for one child or all.
create function public.parent_pickups(p_student_id uuid default null)
returns table (
  id uuid, student_id uuid, student_name text, code text, pickup_date date, collector_name text,
  collector_phone text, status text, used_at timestamptz, released_by_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select pc.id, pc.student_id, st.full_name, pc.code, pc.pickup_date, pc.collector_name, pc.collector_phone,
         case when pc.status = 'active' and pc.pickup_date < private.ghana_today() then 'expired' else pc.status end,
         pc.used_at,
         (select sf.full_name from public.staff sf where sf.user_id = pc.released_by and sf.school_id = pc.school_id limit 1)
  from public.pickup_codes pc
  join public.students st on st.id = pc.student_id
  where pc.created_by = auth.uid()
    and pc.pickup_date >= private.ghana_today() - 7
    and (p_student_id is null or pc.student_id = p_student_id)
  order by pc.pickup_date desc, pc.created_at desc;
$$;

-- A teacher types a code: today's active code at their school, or nothing.
-- Ten wrong codes in an hour stop the checks for that hour.
create function public.check_pickup_code(p_school_id uuid, p_code text)
returns table (
  id uuid, student_name text, class_name text, collector_name text, collector_phone text,
  parent_name text, created_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_found uuid;
begin
  if not private.is_school_staff(p_school_id) then
    raise exception 'You cannot check codes at this school.' using errcode = '42501';
  end if;
  if (select count(*) from private.pickup_code_tries t
      where t.user_id = auth.uid() and t.tried_at > now() - interval '1 hour') >= 10 then
    raise exception 'Too many wrong codes. Wait an hour, or ask the parent to call the school.' using errcode = 'P0001';
  end if;

  select pc.id into v_found from public.pickup_codes pc
  where pc.school_id = p_school_id and pc.pickup_date = private.ghana_today()
    and pc.status = 'active' and pc.code = regexp_replace(coalesce(p_code, ''), '\D', '', 'g');
  if v_found is null then
    insert into private.pickup_code_tries (user_id, school_id) values (auth.uid(), p_school_id);
    return;
  end if;

  return query
  select pc.id, st.full_name, cl.name, pc.collector_name, pc.collector_phone,
         (select g.full_name from public.parent_links pl join public.guardians g on g.id = pl.guardian_id
          join public.guardian_links gl on gl.guardian_id = g.id and gl.student_id = pc.student_id
          where pl.user_id = pc.created_by limit 1),
         pc.created_at
  from public.pickup_codes pc
  join public.students st on st.id = pc.student_id
  left join public.classes cl on cl.id = st.class_id
  where pc.id = v_found;
end;
$$;

-- The teacher hands the child over: the code is used, and the parent is told.
create function public.release_pickup(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_code public.pickup_codes;
  v_child text;
  v_staff text;
begin
  select * into v_code from public.pickup_codes where id = p_id for update;
  if v_code.id is null or not private.is_school_staff(v_code.school_id) then
    raise exception 'You cannot release this child.' using errcode = '42501';
  end if;
  if v_code.status <> 'active' or v_code.pickup_date <> private.ghana_today() then
    raise exception 'This code is no longer valid.' using errcode = 'P0001';
  end if;
  update public.pickup_codes set status = 'used', used_at = now(), released_by = auth.uid() where id = p_id;

  select st.full_name into v_child from public.students st where st.id = v_code.student_id;
  select sf.full_name into v_staff from public.staff sf where sf.user_id = auth.uid() and sf.school_id = v_code.school_id limit 1;
  perform private.queue_push(
    v_code.created_by,
    left(private.sms_school_name(v_code.school_id), 100),
    v_child || ' was collected by ' || v_code.collector_name || ' at '
      || to_char(now() at time zone 'Africa/Accra', 'FMHH12:MIam')
      || case when v_staff is not null then '. Released by ' || v_staff || '.' else '.' end,
    jsonb_build_object('pickupId', v_code.id)
  );
end;
$$;

-- The day's codes at a school, without the digits.
create function public.school_pickups(p_school_id uuid, p_date date default null)
returns table (
  id uuid, student_name text, class_name text, collector_name text, status text,
  used_at timestamptz, released_by_name text, created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not private.is_school_staff(p_school_id) then
    raise exception 'You cannot see this school.' using errcode = '42501';
  end if;
  return query
  select pc.id, st.full_name, cl.name, pc.collector_name, pc.status, pc.used_at,
         (select sf.full_name from public.staff sf where sf.user_id = pc.released_by and sf.school_id = pc.school_id limit 1),
         pc.created_at
  from public.pickup_codes pc
  join public.students st on st.id = pc.student_id
  left join public.classes cl on cl.id = st.class_id
  where pc.school_id = p_school_id and pc.pickup_date = coalesce(p_date, private.ghana_today())
  order by (pc.status = 'active') desc, cl.name, st.full_name;
end;
$$;

-- ---------------------------------------------------------------------------
-- Absence reports
-- ---------------------------------------------------------------------------

create table public.absence_reports (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade deferrable initially immediate,
  student_id uuid not null,
  reported_by uuid not null references auth.users (id) on delete cascade deferrable initially immediate,
  from_date date not null,
  to_date date not null,
  reason text not null check (reason in ('sick', 'family', 'travel', 'other')),
  note text check (char_length(note) <= 300),
  status text not null default 'active' check (status in ('active', 'cancelled')),
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  constraint absence_reports_dates check (to_date >= from_date and to_date - from_date <= 13),
  foreign key (student_id, school_id) references public.students (id, school_id) on delete cascade deferrable initially immediate
);

create index absence_reports_student_idx on public.absence_reports (student_id, from_date, to_date) where status = 'active';
create index absence_reports_school_idx on public.absence_reports (school_id, from_date);

alter table public.absence_reports enable row level security;
create policy absence_reports_select on public.absence_reports
  for select to authenticated
  using (reported_by = (select auth.uid()) or private.is_school_staff(school_id));
grant select on public.absence_reports to authenticated;

create function private.absence_reported(p_student_id uuid, p_day date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.absence_reports ar
    where ar.student_id = p_student_id and ar.status = 'active' and p_day between ar.from_date and ar.to_date
  );
$$;

create function private.absence_reason_text(p_reason text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_reason when 'sick' then 'Sick' when 'family' then 'Family matter' when 'travel' then 'Travelling' else 'Other' end;
$$;

create function public.parent_report_absence(p_student_id uuid, p_from date, p_to date, p_reason text, p_note text default null)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_school uuid;
  v_child text;
  v_id uuid;
  v_today date := private.ghana_today();
  v_when text;
  r record;
begin
  select c.school_id into v_school from private.my_children() c where c.student_id = p_student_id limit 1;
  if v_school is null then
    raise exception 'You cannot report for this child.' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_from < v_today or p_to < p_from then
    raise exception 'Choose today or later, and an end date on or after the start.' using errcode = '22023';
  end if;
  if p_to - p_from > 13 or p_from > v_today + 60 then
    raise exception 'Report up to two weeks at a time, starting within the next two months.' using errcode = '22023';
  end if;
  if p_reason not in ('sick', 'family', 'travel', 'other') then
    raise exception 'Choose a reason.' using errcode = '22023';
  end if;

  insert into public.absence_reports (school_id, student_id, reported_by, from_date, to_date, reason, note)
  values (v_school, p_student_id, auth.uid(), p_from, p_to, p_reason, nullif(left(trim(coalesce(p_note, '')), 300), ''))
  returning id into v_id;

  select st.full_name into v_child from public.students st where st.id = p_student_id;
  v_when := case when p_from = p_to then to_char(p_from, 'FMDy FMDD Mon')
                 else to_char(p_from, 'FMDy FMDD Mon') || ' to ' || to_char(p_to, 'FMDy FMDD Mon') end;
  for r in select distinct u from private.class_teacher_users(p_student_id) u loop
    perform private.queue_push(r.u, 'Absence reported: ' || v_child,
      v_when || ': ' || private.absence_reason_text(p_reason)
        || coalesce('. ' || nullif(left(trim(coalesce(p_note, '')), 120), ''), '') || '. Reported by a parent in RollCol.',
      jsonb_build_object('absenceId', v_id));
  end loop;
  return v_id;
end;
$$;

create function public.parent_cancel_absence(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  update public.absence_reports set status = 'cancelled', cancelled_at = now()
  where id = p_id and reported_by = auth.uid() and status = 'active' and to_date >= private.ghana_today();
  if not found then
    raise exception 'This report cannot be cancelled.' using errcode = 'P0001';
  end if;
end;
$$;

-- The school's reports: from a week ago onwards, for staff (teachers see all
-- classes' reports, so a subject teacher also knows).
create function public.school_absence_reports(p_school_id uuid)
returns table (
  id uuid, student_id uuid, student_name text, class_name text, from_date date, to_date date,
  reason text, note text, status text, created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not private.is_school_staff(p_school_id) then
    raise exception 'You cannot see this school.' using errcode = '42501';
  end if;
  return query
  select ar.id, st.id, st.full_name, cl.name, ar.from_date, ar.to_date, ar.reason, ar.note, ar.status, ar.created_at
  from public.absence_reports ar
  join public.students st on st.id = ar.student_id
  left join public.classes cl on cl.id = st.class_id
  where ar.school_id = p_school_id and ar.to_date >= private.ghana_today() - 7
  order by (ar.to_date >= private.ghana_today()) desc, ar.from_date, cl.name, st.full_name;
end;
$$;

-- No "absent" alert for a day the parent reported.
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

select private.swap_in_function('private.queue_attendance_alerts()'::regprocedure,
  $old$    and r.class_subject_id is null
    and r.register_date = private.ghana_today()
$old$,
  $new$    and r.class_subject_id is null
    and r.register_date = private.ghana_today()
    and not (e.mark = 'absent' and private.absence_reported(e.student_id, r.register_date))
$new$);

select private.swap_in_function('private.queue_attendance_alerts()'::regprocedure,
  $old$    and r.class_subject_id is not null
    and r.register_date = private.ghana_today()
$old$,
  $new$    and r.class_subject_id is not null
    and r.register_date = private.ghana_today()
    and not private.absence_reported(e.student_id, r.register_date)
$new$);

drop function private.swap_in_function(regprocedure, text, text, integer);

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke execute on function
  public.parent_create_pickup(uuid, date, text, text),
  public.parent_cancel_pickup(uuid),
  public.parent_pickups(uuid),
  public.check_pickup_code(uuid, text),
  public.release_pickup(uuid),
  public.school_pickups(uuid, date),
  public.parent_report_absence(uuid, date, date, text, text),
  public.parent_cancel_absence(uuid),
  public.school_absence_reports(uuid)
from public, anon;

grant execute on function
  public.parent_create_pickup(uuid, date, text, text),
  public.parent_cancel_pickup(uuid),
  public.parent_pickups(uuid),
  public.check_pickup_code(uuid, text),
  public.release_pickup(uuid),
  public.school_pickups(uuid, date),
  public.parent_report_absence(uuid, date, date, text, text),
  public.parent_cancel_absence(uuid),
  public.school_absence_reports(uuid)
to authenticated;
