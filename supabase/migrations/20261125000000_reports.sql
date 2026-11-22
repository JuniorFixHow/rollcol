-- Part 6: records, reports and exports.
--
-- Basic and senior high schools: a class's term as days (the GES register:
-- "Attendance X out of Y"), and per subject for schools that mark each period.
-- Tertiary: a course's semester as sessions. An overview per class or course
-- for the Reports page, and each student's record.
--
-- Totals are always worked out from the term's or semester's dates, never from
-- a stored link (as class_attendance_summary does).

alter table public.school_settings
  add column low_attendance_percent smallint not null default 75 check (low_attendance_percent between 1 and 100);
grant update (low_attendance_percent) on public.school_settings to authenticated;

-- The date range of a term or semester, or everything when none is given.
create function private.period_range(p_school_id uuid, p_period_id uuid)
returns table (starts_on date, ends_on date)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(ap.starts_on, date '1900-01-01'), coalesce(ap.ends_on, date '2999-12-31')
  from (select 1) as one
  left join public.academic_periods ap on ap.id = p_period_id and ap.school_id = p_school_id;
$$;

-- ---------------------------------------------------------------------------
-- Basic and senior high schools
-- ---------------------------------------------------------------------------

-- One row per child per school day that had a register. With several period
-- registers in a day, the day counts as present if the child was present in
-- any period, late if only late, and absent if absent in every period.
create function public.class_register_days(p_class_id uuid, p_period_id uuid default null)
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
    select st.id, st.full_name, st.school_number from public.students st
    where st.class_id = v_class.id and st.status <> 'disabled'
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

-- Per subject, for schools that mark each period: lessons held and how each child did.
create function public.class_subject_summary(p_class_id uuid, p_period_id uuid default null)
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
  from public.students st
  cross join public.class_subjects cs
  join public.subjects sub on sub.id = cs.subject_id
  left join lessons l on l.class_subject_id = cs.id
  left join public.register_entries e on e.register_id = l.id and e.student_id = st.id
  where st.class_id = v_class.id and st.status <> 'disabled' and cs.class_id = v_class.id
  group by st.id, st.full_name, sub.name, cs.id
  having (select count(*) from lessons l2 where l2.class_subject_id = cs.id) > 0
  order by st.full_name, sub.name;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tertiary
-- ---------------------------------------------------------------------------

-- Every registered student by every session that has started and was not
-- cancelled, with their check-in if any.
create function public.course_run_report(p_course_run_id uuid)
returns table (
  student_id uuid,
  full_name text,
  school_number text,
  session_id uuid,
  starts_at timestamptz,
  checked_in_at timestamptz,
  method text,
  reward_marks numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not private.can_run_session(p_course_run_id) then
    raise exception 'Only this course''s lecturers and admins can see its report.' using errcode = '42501';
  end if;
  return query
  with sessions as (
    select s.id, s.starts_at, s.reward_marks from public.attendance_sessions s
    where s.course_run_id = p_course_run_id and s.voided_at is null and s.starts_at <= now()
  ),
  students as (
    select st.id, st.full_name, st.school_number from public.enrolments e
    join public.students st on st.id = e.student_id
    where e.course_run_id = p_course_run_id
      and (e.status = 'active' or exists (
        select 1 from public.session_checkins c join sessions s on s.id = c.session_id where c.student_id = st.id))
  )
  select st.id, st.full_name, st.school_number, s.id, s.starts_at, c.checked_in_at, c.method,
         case when c.student_id is null then 0 else s.reward_marks end
  from students st
  cross join sessions s
  left join public.session_checkins c on c.session_id = s.id and c.student_id = st.id
  order by st.full_name, s.starts_at;
end;
$$;

-- A student's semester across their courses (for admins, the student's lecturers' view uses the course report).
create function public.student_course_attendance(p_student_id uuid, p_period_id uuid default null)
returns table (course_run_id uuid, code text, title text, held integer, attended integer, marks numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_school uuid := (select school_id from public.students where id = p_student_id);
begin
  if v_school is null or not private.is_school_admin(v_school) then
    raise exception 'Only admins can see a student''s record across courses.' using errcode = '42501';
  end if;
  return query
  select cr.id, c.code, c.title,
         count(s.*)::integer,
         count(ci.*)::integer,
         coalesce(sum(s.reward_marks) filter (where ci.student_id is not null), 0)
  from public.enrolments e
  join public.course_runs cr on cr.id = e.course_run_id
  join public.courses c on c.id = cr.course_id
  left join public.attendance_sessions s on s.course_run_id = cr.id and s.voided_at is null and s.starts_at <= now()
  left join public.session_checkins ci on ci.session_id = s.id and ci.student_id = e.student_id
  where e.student_id = p_student_id and (p_period_id is null or cr.academic_period_id = p_period_id)
  group by cr.id, c.code, c.title
  order by c.code;
end;
$$;

-- ---------------------------------------------------------------------------
-- Overview for the Reports page
-- ---------------------------------------------------------------------------

-- Each class (or course) this person can see: students, days (or sessions)
-- held, the attendance rate, and how many students are below the school's
-- threshold. Present and late both count as attended.
create function public.attendance_overview(p_school_id uuid, p_period_id uuid default null)
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
    per_student as (
      select st.class_id, st.id as student_id,
             (select count(*) from days d where d.class_id = st.class_id) as held,
             (select count(distinct r.register_date) from public.registers r
              join public.register_entries e on e.register_id = r.id
              where r.class_id = st.class_id and e.student_id = st.id and e.mark in ('present', 'late')
                and r.register_date between v_from and v_to) as attended
      from public.students st
      where st.class_id in (select id from classes) and st.status <> 'disabled'
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

revoke all on all functions in schema private from public, anon;
revoke all on function
  public.class_register_days(uuid, uuid),
  public.class_subject_summary(uuid, uuid),
  public.course_run_report(uuid),
  public.student_course_attendance(uuid, uuid),
  public.attendance_overview(uuid, uuid)
from public, anon;
grant execute on function
  public.class_register_days(uuid, uuid),
  public.class_subject_summary(uuid, uuid),
  public.course_run_report(uuid),
  public.student_course_attendance(uuid, uuid),
  public.attendance_overview(uuid, uuid)
to authenticated;
