-- Part 8a: fixes from testing 7b.
--
-- 1. Staff get push notifications. Only students register a phone (for
--    check-in), so pushes to teachers, lecturers and admins had nowhere to go
--    and ended as "no_device". Staff now register a push token on its own.
-- 2. Notification settings: each person chooses which kinds they get.
--    Security notices (a new phone signing in) are always sent.
-- 3. Reports include every pupil with marks in a class's registers in the
--    dates shown, not only the class's current pupils (a pupil joined to an
--    existing record by a workspace move stays in their own class).

-- ---------------------------------------------------------------------------
-- 1. Push tokens for staff
-- ---------------------------------------------------------------------------

create table public.push_tokens (
  token text primary key check (token ~ '^(Exponent|Expo)PushToken\[[A-Za-z0-9_-]+\]$'),
  user_id uuid not null references auth.users (id) on delete cascade,
  updated_at timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens (user_id);
alter table public.push_tokens enable row level security;
-- No policies: only the functions below read or write it.

-- This phone's token for the signed-in person. Another account that used the
-- phone before stops getting notifications on it.
create function public.set_staff_push_token(p_token text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if p_token is null or p_token !~ '^(Exponent|Expo)PushToken\[[A-Za-z0-9_-]+\]$' then
    raise exception 'Not a push token.' using errcode = '22023';
  end if;
  update public.devices set push_token = null where push_token = p_token and user_id <> auth.uid();
  insert into public.push_tokens (token, user_id) values (p_token, auth.uid())
  on conflict (token) do update set user_id = excluded.user_id, updated_at = now();
end;
$$;

-- Signing out of the app: this phone stops getting the person's notifications.
create function public.forget_push_token(p_token text)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  delete from public.push_tokens where token = p_token and user_id = auth.uid();
  update public.devices set push_token = null where push_token = p_token and user_id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- 2. Notification settings
-- ---------------------------------------------------------------------------

-- Kinds a person can turn off. "general" (for example a new phone signing in)
-- cannot be turned off.
create function private.push_kind(p_title text, p_data jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_data ? 'moveId' then 'moves'
    when p_data ? 'sessionId' and p_title like '%: 5 minutes left' then 'reminders'
    when p_data ? 'sessionId' then 'sessions'
    else 'general'
  end;
$$;

create table public.notification_settings (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('sessions', 'reminders', 'moves')),
  enabled boolean not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, kind)
);
alter table public.notification_settings enable row level security;
create policy "People see their own notification settings" on public.notification_settings
  for select to authenticated using (user_id = (select auth.uid()));
grant select on public.notification_settings to authenticated;

create function public.set_notification_setting(p_kind text, p_enabled boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if p_kind not in ('sessions', 'reminders', 'moves') then
    raise exception 'This notification cannot be turned off.' using errcode = '22023';
  end if;
  insert into public.notification_settings (user_id, kind, enabled) values (auth.uid(), p_kind, coalesce(p_enabled, true))
  on conflict (user_id, kind) do update set enabled = excluded.enabled, updated_at = now();
end;
$$;

alter table public.push_outbox drop constraint push_outbox_status_check;
alter table public.push_outbox add constraint push_outbox_status_check
  check (status in ('queued', 'sending', 'sent', 'failed', 'no_device', 'muted'));

-- Takes due notifications with every push token of the person: their
-- student phone (devices) and any staff tokens. Turned-off kinds are "muted".
create or replace function public.claim_push(p_limit integer default 100)
returns table (id bigint, push_token text, title text, body text, data jsonb)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  update public.push_outbox o set status = 'muted'
  where o.status = 'queued' and o.send_after <= now()
    and exists (
      select 1 from public.notification_settings ns
      where ns.user_id = o.user_id and ns.kind = private.push_kind(o.title, o.data) and not ns.enabled
    );

  -- Nobody to send to: no active phone and no staff token.
  update public.push_outbox o set status = 'no_device'
  where o.status = 'queued' and o.send_after <= now()
    and not exists (
      select 1 from public.devices d
      where d.push_token is not null
        and ((o.device_id is not null and d.id = o.device_id)
             or (o.device_id is null and d.user_id = o.user_id and d.status = 'active'))
    )
    and (o.device_id is not null or not exists (select 1 from public.push_tokens t where t.user_id = o.user_id));

  return query
  with picked as (
    select q.id from public.push_outbox q
    where q.status = 'queued' and q.send_after <= now()
    order by q.send_after, q.id
    limit greatest(1, least(p_limit, 500))
    for update skip locked
  ),
  marked as (
    update public.push_outbox o set status = 'sending', attempts = o.attempts + 1
    where o.id in (select picked.id from picked)
    returning o.*
  ),
  targets as (
    select m.id, d.push_token as token, m.title, m.body, m.data
    from marked m
    join public.devices d
      on d.push_token is not null
     and ((m.device_id is not null and d.id = m.device_id)
          or (m.device_id is null and d.user_id = m.user_id and d.status = 'active'))
    union
    select m.id, t.token, m.title, m.body, m.data
    from marked m join public.push_tokens t on t.user_id = m.user_id
    where m.device_id is null
  )
  select t.id, t.token, t.title, t.body, t.data from targets t;
end;
$$;

-- A notification can go to more than one phone (a student phone and a staff
-- token). Once it reached one of them it counts as sent: a failure on the
-- other must not queue it again (that would repeat it on the first).
create or replace function public.finish_push(p_id bigint, p_ok boolean, p_ticket text default null, p_error text default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_ok then
    update public.push_outbox set status = 'sent', sent_at = now(), ticket_id = left(p_ticket, 200), error = null where id = p_id;
  elsif p_error = 'DeviceNotRegistered' then
    -- The app was removed from a phone: forget its tokens (a failed copy cannot tell which, so only when nothing was sent).
    update public.devices set push_token = null
    where push_token = (select d.push_token from public.push_outbox o join public.devices d
                        on (o.device_id = d.id) or (o.device_id is null and d.user_id = o.user_id and d.status = 'active')
                        where o.id = p_id and o.status <> 'sent' limit 1);
    update public.push_outbox set status = 'failed', error = p_error where id = p_id and status <> 'sent';
  else
    update public.push_outbox
    set status = case when attempts < 3 then 'queued' else 'failed' end,
        send_after = now() + interval '2 minutes', error = left(p_error, 500)
    where id = p_id and status <> 'sent';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Reports include every pupil with marks
-- ---------------------------------------------------------------------------

-- Pupils of a class for a report: those in it now, and anyone marked in its
-- registers between the dates (for example joined by a workspace move).
create function private.class_report_pupils(p_class_id uuid, p_from date, p_to date)
returns table (id uuid, full_name text, school_number text)
language sql
stable
security definer
set search_path = ''
as $$
  select st.id, st.full_name, st.school_number from public.students st
  where st.class_id = p_class_id and st.status <> 'disabled'
  union
  select st.id, st.full_name, st.school_number from public.students st
  where exists (
    select 1 from public.register_entries e join public.registers r on r.id = e.register_id
    where e.student_id = st.id and r.class_id = p_class_id and r.register_date between p_from and p_to
  );
$$;

create or replace function public.class_register_days(p_class_id uuid, p_period_id uuid default null)
returns table (student_id uuid, full_name text, school_number text, day date, mark text, marks numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_class public.classes;
  v_from date;
  v_to date;
begin
  select * into v_class from public.classes where id = p_class_id;
  if v_class.id is null or not (private.is_school_admin(v_class.school_id) or private.teaches_class(v_class.id)) then
    raise exception 'You cannot see this class.' using errcode = '42501';
  end if;
  select starts_on, ends_on into v_from, v_to from private.period_range(v_class.school_id, p_period_id);

  return query
  with days as (
    select distinct r.register_date as day from public.registers r
    where r.class_id = v_class.id and r.register_date between v_from and v_to
  ),
  children as (
    select * from private.class_report_pupils(v_class.id, v_from, v_to)
  ),
  entries as (
    select e.student_id, r.register_date as day,
           bool_or(e.mark = 'present') as any_present,
           bool_or(e.mark = 'late') as any_late,
           bool_or(e.mark = 'absent') as any_absent,
           sum(r.reward_marks) filter (where e.mark in ('present', 'late')) as marks
    from public.registers r
    join public.register_entries e on e.register_id = r.id
    where r.class_id = v_class.id and r.register_date between v_from and v_to
    group by e.student_id, r.register_date
  )
  select c.id, c.full_name, c.school_number, d.day,
         case when en.any_present then 'present' when en.any_late then 'late' when en.any_absent then 'absent' end,
         coalesce(en.marks, 0)
  from children c
  cross join days d
  left join entries en on en.student_id = c.id and en.day = d.day
  order by c.full_name, d.day;
end;
$$;

create or replace function public.class_subject_summary(
  p_class_id uuid,
  p_period_id uuid default null,
  p_from date default null,
  p_to date default null
)
returns table (
  student_id uuid,
  full_name text,
  subject text,
  held integer,
  present integer,
  late integer,
  absent integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_class public.classes;
  v_from date;
  v_to date;
begin
  select * into v_class from public.classes where id = p_class_id;
  if v_class.id is null or not (private.is_school_admin(v_class.school_id) or private.teaches_class(v_class.id)) then
    raise exception 'You cannot see this class.' using errcode = '42501';
  end if;
  select starts_on, ends_on into v_from, v_to from private.period_range(v_class.school_id, p_period_id);
  v_from := greatest(v_from, coalesce(p_from, v_from));
  v_to := least(v_to, coalesce(p_to, v_to));

  return query
  with lessons as (
    select r.id, r.class_subject_id from public.registers r
    where r.class_id = v_class.id and r.class_subject_id is not null and r.register_date between v_from and v_to
  )
  select st.id, st.full_name, sub.name,
         (select count(*)::integer from lessons l where l.class_subject_id = cs.id),
         count(e.*) filter (where e.mark = 'present')::integer,
         count(e.*) filter (where e.mark = 'late')::integer,
         count(e.*) filter (where e.mark = 'absent')::integer
  from private.class_report_pupils(v_class.id, v_from, v_to) st
  cross join public.class_subjects cs
  join public.subjects sub on sub.id = cs.subject_id
  left join lessons l on l.class_subject_id = cs.id
  left join public.register_entries e on e.register_id = l.id and e.student_id = st.id
  where cs.class_id = v_class.id
  group by st.id, st.full_name, sub.name, cs.id
  having (select count(*) from lessons l2 where l2.class_subject_id = cs.id) > 0
  order by st.full_name, sub.name;
end;
$$;

create or replace function public.attendance_overview(p_school_id uuid, p_period_id uuid default null)
returns table (
  kind text,
  id uuid,
  name text,
  detail text,
  students integer,
  held integer,
  rate numeric,
  below integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_type public.school_type := (select type from public.schools where id = p_school_id);
  v_threshold numeric := coalesce((select low_attendance_percent from public.school_settings where school_id = p_school_id), 75);
  v_admin boolean := private.is_school_admin(p_school_id);
  v_from date;
  v_to date;
begin
  if not private.is_school_staff(p_school_id) then
    raise exception 'You cannot see this school''s reports.' using errcode = '42501';
  end if;
  select starts_on, ends_on into v_from, v_to from private.period_range(p_school_id, p_period_id);

  if v_type = 'tertiary' then
    return query
    with runs as (
      select cr.id, c.code, c.title from public.course_runs cr join public.courses c on c.id = cr.course_id
      where cr.school_id = p_school_id and (p_period_id is null or cr.academic_period_id = p_period_id)
        and (v_admin or private.lectures_run(cr.id))
    ),
    per_student as (
      select r.id as run_id, e.student_id,
             (select count(*) from public.attendance_sessions s
              where s.course_run_id = r.id and s.voided_at is null and s.starts_at <= now()) as held,
             (select count(*) from public.session_checkins ci join public.attendance_sessions s on s.id = ci.session_id
              where s.course_run_id = r.id and s.voided_at is null and ci.student_id = e.student_id) as attended
      from runs r join public.enrolments e on e.course_run_id = r.id and e.status = 'active'
    )
    select 'course', r.id, r.code, r.title,
           count(ps.student_id)::integer,
           coalesce(max(ps.held), (select count(*) from public.attendance_sessions s
              where s.course_run_id = r.id and s.voided_at is null and s.starts_at <= now()))::integer,
           case when coalesce(sum(ps.held), 0) = 0 then null else round(100.0 * sum(ps.attended) / sum(ps.held), 1) end,
           count(*) filter (where ps.held > 0 and 100.0 * ps.attended / ps.held < v_threshold)::integer
    from runs r left join per_student ps on ps.run_id = r.id
    group by r.id, r.code, r.title
    order by r.code;
  else
    return query
    with classes as (
      select cl.id, cl.name from public.classes cl
      where cl.school_id = p_school_id and cl.archived_at is null and (v_admin or private.teaches_class(cl.id))
    ),
    days as (
      select r.class_id, r.register_date from public.registers r
      where r.class_id in (select id from classes) and r.register_date between v_from and v_to
      group by r.class_id, r.register_date
    ),
    pupils as (
      select cl.id as class_id, p.id as student_id
      from classes cl cross join lateral private.class_report_pupils(cl.id, v_from, v_to) p
    ),
    per_student as (
      select p.class_id, p.student_id,
             (select count(*) from days d where d.class_id = p.class_id) as held,
             (select count(distinct r.register_date) from public.registers r
              join public.register_entries e on e.register_id = r.id
              where r.class_id = p.class_id and e.student_id = p.student_id and e.mark in ('present', 'late')
                and r.register_date between v_from and v_to) as attended
      from pupils p
    )
    select 'class', cl.id, cl.name, null::text,
           count(ps.student_id)::integer,
           (select count(*) from days d where d.class_id = cl.id)::integer,
           case when coalesce(sum(ps.held), 0) = 0 then null else round(100.0 * sum(ps.attended) / sum(ps.held), 1) end,
           count(*) filter (where ps.held > 0 and 100.0 * ps.attended / ps.held < v_threshold)::integer
    from classes cl left join per_student ps on ps.class_id = cl.id
    group by cl.id, cl.name
    order by cl.name;
  end if;
end;
$$;

-- The classes a pupil has a record in: their own class first, then any other
-- class whose registers mark them (for the student page).
create function public.student_register_classes(p_student_id uuid)
returns table (class_id uuid, class_name text, is_own boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_student public.students;
begin
  select * into v_student from public.students where id = p_student_id;
  if v_student.id is null or not (private.is_school_admin(v_student.school_id) or private.teaches_student(v_student.id)) then
    raise exception 'You cannot see this student.' using errcode = '42501';
  end if;
  return query
  select c.id, c.name, c.id = v_student.class_id
  from public.classes c
  where c.school_id = v_student.school_id
    and (c.id = v_student.class_id or exists (
      select 1 from public.registers r join public.register_entries e on e.register_id = r.id
      where r.class_id = c.id and e.student_id = v_student.id))
  order by c.id = v_student.class_id desc, c.name;
end;
$$;

revoke all on all functions in schema private from public, anon;
revoke all on function
  public.set_staff_push_token(text),
  public.forget_push_token(text),
  public.set_notification_setting(text, boolean),
  public.student_register_classes(uuid)
from public, anon;
grant execute on function
  public.set_staff_push_token(text),
  public.forget_push_token(text),
  public.set_notification_setting(text, boolean),
  public.student_register_classes(uuid)
to authenticated;
