-- Part 5b: lecturer courses, phone recognition after a reinstall, the in-app
-- notification list, and what the mobile app reads.

-- ---------------------------------------------------------------------------
-- Courses created by lecturers
-- ---------------------------------------------------------------------------

alter table public.school_settings
  add column course_approval_required boolean not null default true;
grant update (course_approval_required) on public.school_settings to authenticated;

-- A course run created by a lecturer waits for an admin when the school asks
-- for approval. Until then students cannot join it and sessions cannot start.
alter table public.course_runs
  add column approved_at timestamptz default now(),
  add column created_by uuid references auth.users (id) on delete set null;

-- A lecturer adds a course (or a new semester of an existing course) and
-- becomes its lecturer.
create function public.lecturer_add_course(p_school_id uuid, p_code text, p_title text, p_period_id uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_staff uuid := private.my_staff_id_in(p_school_id);
  v_code text := upper(regexp_replace(btrim(coalesce(p_code, '')), '\s+', ' ', 'g'));
  v_title text := regexp_replace(btrim(coalesce(p_title, '')), '\s+', ' ', 'g');
  v_period public.academic_periods;
  v_course public.courses;
  v_run uuid;
  v_needs_approval boolean;
begin
  if v_staff is null then
    raise exception 'Only staff of this school can add courses.' using errcode = '42501';
  end if;
  if (select type from public.schools where id = p_school_id) <> 'tertiary' then
    raise exception 'Courses are for tertiary schools.' using errcode = 'P0001';
  end if;
  if v_code !~ '^[A-Z0-9 -]{2,20}$' then
    raise exception 'Enter a course code of 2 to 20 letters and numbers, for example NUR 101.' using errcode = '23514';
  end if;
  select * into v_period from public.academic_periods where id = p_period_id and school_id = p_school_id;
  if v_period.id is null then
    raise exception 'Choose a semester.' using errcode = 'P0002';
  end if;
  if v_period.ends_on < (now() at time zone 'Africa/Accra')::date then
    raise exception 'That semester has ended.' using errcode = 'P0001';
  end if;

  select * into v_course from public.courses where school_id = p_school_id and code = v_code;
  if v_course.id is null then
    if char_length(v_title) < 2 or char_length(v_title) > 160 then
      raise exception 'Enter the course title.' using errcode = '23514';
    end if;
    insert into public.courses (school_id, code, title) values (p_school_id, v_code, v_title) returning * into v_course;
  elsif exists (select 1 from public.course_runs where course_id = v_course.id and academic_period_id = v_period.id) then
    raise exception '% already runs in %. Ask an admin to add you as a lecturer.', v_code, v_period.name using errcode = '23505';
  end if;

  v_needs_approval := coalesce((select course_approval_required from public.school_settings where school_id = p_school_id), true)
                      and not private.is_school_admin(p_school_id);
  insert into public.course_runs (school_id, course_id, academic_period_id, approved_at, created_by)
  values (p_school_id, v_course.id, v_period.id, case when v_needs_approval then null else now() end, auth.uid())
  returning id into v_run;
  insert into public.course_run_staff (school_id, course_run_id, staff_id) values (p_school_id, v_run, v_staff);
  return v_run;
end;
$$;

create function public.approve_course_run(p_course_run_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_school uuid := (select school_id from public.course_runs where id = p_course_run_id);
begin
  if v_school is null or not private.is_school_admin(v_school) then
    raise exception 'Only admins approve courses.' using errcode = '42501';
  end if;
  update public.course_runs set approved_at = now() where id = p_course_run_id and approved_at is null;
end;
$$;

create or replace function public.start_session(
  p_course_run_id uuid,
  p_minutes integer,
  p_starts_at timestamptz default null,
  p_venue_id uuid default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_accuracy double precision default null,
  p_radius_m integer default null,
  p_reward_marks numeric default 0,
  p_qr_required boolean default false,
  p_qr_seconds integer default 15
)
returns public.attendance_sessions
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_run public.course_runs;
  v_period public.academic_periods;
  v_venue public.venues;
  v_starts timestamptz := coalesce(p_starts_at, now());
  v_location extensions.geography;
  v_radius integer;
  v_session public.attendance_sessions;
begin
  select * into v_run from public.course_runs where id = p_course_run_id;
  if v_run.id is null or not private.can_run_session(v_run.id) then
    raise exception 'Only this course''s lecturers and admins can open a session.' using errcode = '42501';
  end if;
  if v_run.approved_at is null then
    raise exception 'This course is waiting for an admin to approve it.' using errcode = 'P0001';
  end if;
  if (select status from public.schools where id = v_run.school_id) = 'suspended' then
    raise exception 'This school is suspended.' using errcode = 'P0001';
  end if;
  if p_minutes is null or p_minutes < 5 or p_minutes > 240 then
    raise exception 'A session lasts between 5 minutes and 4 hours.' using errcode = '23514';
  end if;
  if p_starts_at is not null and (p_starts_at < now() - interval '1 minute' or p_starts_at > now() + interval '14 days') then
    raise exception 'Choose a start time from now up to two weeks ahead.' using errcode = '23514';
  end if;

  select * into v_period from public.academic_periods where id = v_run.academic_period_id;
  if (v_starts at time zone 'Africa/Accra')::date not between v_period.starts_on and v_period.ends_on then
    raise exception '% runs from % to %. Sessions must fall within it.', v_period.name,
      to_char(v_period.starts_on, 'FMDD Mon'), to_char(v_period.ends_on, 'FMDD Mon YYYY') using errcode = '23514';
  end if;

  if p_venue_id is not null then
    select * into v_venue from public.venues where id = p_venue_id and school_id = v_run.school_id;
    if v_venue.id is null then
      raise exception 'Choose one of your school''s venues.' using errcode = 'P0002';
    end if;
    v_location := v_venue.location;
    v_radius := coalesce(p_radius_m, v_venue.radius_m);
  elsif p_lat is not null and p_lng is not null then
    if p_lat not between -90 and 90 or p_lng not between -180 and 180 then
      raise exception 'That location is not valid.' using errcode = '22023';
    end if;
    if p_accuracy is null or p_accuracy > 100 then
      raise exception 'Your location is not precise enough (within 100 metres is needed). Turn on precise location and try again, or choose a venue.'
        using errcode = 'P0001';
    end if;
    v_location := private.point(p_lat, p_lng);
    v_radius := coalesce(p_radius_m, 75);
  elsif p_radius_m is not null then
    raise exception 'Choose a venue to use a radius.' using errcode = '23514';
  end if;
  if coalesce(p_qr_seconds, 15) not between 10 and 60 then
    raise exception 'The code can change every 10 to 60 seconds.' using errcode = '23514';
  end if;
  if v_radius is not null and v_radius not between 50 and 1000 then
    raise exception 'The radius must be between 50 and 1000 metres.' using errcode = '23514';
  end if;
  if p_reward_marks is null or p_reward_marks < 0 or p_reward_marks > 100 or p_reward_marks * 4 <> floor(p_reward_marks * 4) then
    raise exception 'Marks must be between 0 and 100, in quarters.' using errcode = '23514';
  end if;

  insert into public.attendance_sessions
    (school_id, course_run_id, venue_id, location, radius_m, reward_marks, qr_required, qr_seconds, starts_at, ends_at, started_by)
  values
    (v_run.school_id, v_run.id, v_venue.id, v_location, v_radius, p_reward_marks, coalesce(p_qr_required, false),
     coalesce(p_qr_seconds, 15),
     v_starts, v_starts + make_interval(mins => p_minutes), private.my_staff_id_in(v_run.school_id))
  returning * into v_session;
  return v_session;
exception
  when exclusion_violation then
    raise exception 'This course already has a session at that time. End it first, or choose another time.' using errcode = 'P0001';
end;
$$;

create or replace function public.join_course_run(p_course_run_id uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_student public.students;
  v_run public.course_runs;
  v_ends_on date;
  v_id uuid;
begin
  select * into v_run from public.course_runs where id = p_course_run_id;
  if v_run.id is null or v_run.approved_at is null then
    raise exception 'Course not found.' using errcode = 'P0002';
  end if;

  select * into v_student from public.students
  where user_id = auth.uid() and school_id = v_run.school_id and status = 'active';
  if v_student.id is null then
    raise exception 'Your account at this school is not active yet.' using errcode = '42501';
  end if;

  select ends_on into v_ends_on from public.academic_periods where id = v_run.academic_period_id;
  if v_ends_on < (now() at time zone 'Africa/Accra')::date then
    raise exception 'That semester has ended.' using errcode = 'P0001';
  end if;

  insert into public.enrolments (school_id, course_run_id, student_id)
  values (v_student.school_id, v_run.id, v_student.id)
  on conflict (course_run_id, student_id) do update
    set status = 'active'
    where public.enrolments.status = 'removed' and public.enrolments.source = 'rollcol'
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.enrolments
    where course_run_id = v_run.id and student_id = v_student.id;
  end if;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Phones: recognise the same phone after a reinstall
-- ---------------------------------------------------------------------------

-- SHA-256 of the phone's own app ID (Android ID, or the iPhone's ID for this
-- developer's apps). It survives a reinstall on Android; the secret does not.
alter table public.devices add column hardware_hash text check (hardware_hash is null or hardware_hash ~ '^[0-9a-f]{64}$');

drop function public.register_device(text, text, text);

create function public.register_device(p_secret text, p_label text, p_platform text, p_hardware_id text default null)
returns table (device_id uuid, status public.device_status, active_from timestamptz, needs_admin boolean)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user uuid := auth.uid();
  v_hash text;
  v_device public.devices;
  v_active public.devices;
  v_since date;
  v_changes integer;
  v_label text := coalesce(nullif(left(btrim(coalesce(p_label, '')), 80), ''), 'Phone');
  v_hardware text := case when nullif(btrim(coalesce(p_hardware_id, '')), '') is null then null
                          else encode(extensions.digest(p_hardware_id, 'sha256'), 'hex') end;
begin
  if v_user is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if p_secret is null or char_length(p_secret) < 32 or char_length(p_secret) > 200 then
    raise exception 'This phone could not be identified.' using errcode = '22023';
  end if;
  if p_platform not in ('ios', 'android') then
    raise exception 'Check-in works on iPhone and Android phones only.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.students where user_id = v_user) then
    raise exception 'Only students register a phone.' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('device:' || v_user::text, 0));
  perform private.activate_due_devices();
  v_hash := encode(extensions.digest(p_secret, 'sha256'), 'hex');

  select * into v_device from public.devices where secret_hash = v_hash;
  if v_device.id is not null then
    if v_device.user_id <> v_user then
      raise exception 'This phone is registered to another student. Each student checks in from their own phone.'
        using errcode = '42501';
    end if;
    if v_device.status in ('replaced', 'cancelled') then
      raise exception 'This phone was replaced by another one. Ask your school admin if you need to use it again.'
        using errcode = 'P0001';
    end if;
    update public.devices set label = v_label, hardware_hash = coalesce(v_hardware, hardware_hash) where id = v_device.id;
    return query select v_device.id, v_device.status, v_device.active_from,
                        v_device.status = 'pending' and v_device.active_from is null;
    return;
  end if;

  select * into v_active from public.devices where user_id = v_user and status = 'active';

  -- Same phone, new secret (the app was reinstalled or its data cleared):
  -- the phone's own ID matches the active phone, so keep it active.
  if v_active.id is not null and v_hardware is not null and v_active.hardware_hash = v_hardware then
    update public.devices set secret_hash = v_hash, label = v_label where id = v_active.id;
    update public.devices set status = 'cancelled' where user_id = v_user and status = 'pending';
    return query select v_active.id, 'active'::public.device_status, null::timestamptz, false;
    return;
  end if;

  if v_active.id is null then
    -- First phone (or no active phone left): active straight away.
    insert into public.devices (user_id, secret_hash, hardware_hash, label, platform, status, is_first)
    values (v_user, v_hash, v_hardware, v_label, p_platform, 'active',
            not exists (select 1 from public.devices where user_id = v_user))
    returning * into v_device;
    return query select v_device.id, v_device.status, null::timestamptz, false;
    return;
  end if;

  -- A change of phone. Two per semester wait 48 hours; after that an admin decides.
  select coalesce(min(ap.starts_on), current_date - 180) into v_since
  from public.academic_periods ap
  join public.students st on st.school_id = ap.school_id and st.user_id = v_user
  where ap.kind = 'semester' and current_date between ap.starts_on and ap.ends_on;

  select count(*) into v_changes from public.devices
  where user_id = v_user and not is_first and requested_at >= v_since and status <> 'cancelled';

  update public.devices set status = 'cancelled' where user_id = v_user and status = 'pending';
  insert into public.devices (user_id, secret_hash, hardware_hash, label, platform, status, active_from)
  values (v_user, v_hash, v_hardware, v_label, p_platform, 'pending',
          case when v_changes < 2 then now() + interval '48 hours' end)
  returning * into v_device;

  -- Warn the current phone, in case this was not the student.
  perform private.queue_push(v_user, 'New phone signing in',
    'Your RollCol account signed in on ' || v_label || '. If this was not you, change your password and tell your school.',
    '{}', v_active.id);

  return query select v_device.id, v_device.status, v_device.active_from, v_device.active_from is null;
end;
$$;

-- What the app shows about this phone.
create function public.my_device(p_secret text)
returns table (status public.device_status, label text, active_from timestamptz, needs_admin boolean, active_label text)
language sql
stable
security definer
set search_path = ''
as $$
  select d.status, d.label, d.active_from, d.status = 'pending' and d.active_from is null,
         (select a.label from public.devices a where a.user_id = d.user_id and a.status = 'active')
  from public.devices d
  where d.user_id = (select auth.uid())
    and d.secret_hash = encode(extensions.digest(coalesce(p_secret, ''), 'sha256'), 'hex');
$$;

-- ---------------------------------------------------------------------------
-- Notifications list in the app (the push outbox, read by its owner)
-- ---------------------------------------------------------------------------

alter table public.push_outbox
  add column read_at timestamptz,
  add column dismissed_at timestamptz;

create index push_outbox_user_idx on public.push_outbox (user_id, created_at desc) where dismissed_at is null;

grant select (id, title, body, data, created_at, read_at) on public.push_outbox to authenticated;
create policy "People see their own notifications" on public.push_outbox
  for select to authenticated using (user_id = (select auth.uid()) and dismissed_at is null);

create function public.mark_notifications_read(p_ids bigint[] default null)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.push_outbox set read_at = now()
  where user_id = (select auth.uid()) and read_at is null and (p_ids is null or id = any (p_ids));
$$;

create function public.dismiss_notifications(p_ids bigint[] default null)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.push_outbox set dismissed_at = now(), read_at = coalesce(read_at, now())
  where user_id = (select auth.uid()) and dismissed_at is null and (p_ids is null or id = any (p_ids));
$$;

-- ---------------------------------------------------------------------------
-- Students: courses and attendance in the app
-- ---------------------------------------------------------------------------

-- Courses in the current semester of a school: the student's own (with
-- attendance) and the others they can join.
create function public.my_courses(p_school_id uuid)
returns table (
  course_run_id uuid,
  code text,
  title text,
  semester text,
  enrolled boolean,
  sessions_held integer,
  attended integer,
  marks numeric,
  lecturers text
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select st.id from public.students st
    where st.user_id = (select auth.uid()) and st.school_id = p_school_id and st.status = 'active'
  )
  select cr.id, c.code, c.title, ap.name,
         e.id is not null,
         case when e.id is null then 0 else
           (select count(*) from public.attendance_sessions s
            where s.course_run_id = cr.id and s.voided_at is null and s.starts_at <= now())::integer end,
         case when e.id is null then 0 else
           (select count(*) from public.session_checkins ci
            join public.attendance_sessions s on s.id = ci.session_id
            where s.course_run_id = cr.id and s.voided_at is null and ci.student_id = (select id from me))::integer end,
         case when e.id is null then 0 else
           coalesce((select sum(s.reward_marks) from public.session_checkins ci
            join public.attendance_sessions s on s.id = ci.session_id
            where s.course_run_id = cr.id and s.voided_at is null and ci.student_id = (select id from me)), 0) end,
         (select string_agg(sf.full_name, ', ' order by sf.full_name)
          from public.course_run_staff crs join public.staff sf on sf.id = crs.staff_id
          where crs.course_run_id = cr.id)
  from public.course_runs cr
  join public.courses c on c.id = cr.course_id
  join public.academic_periods ap on ap.id = cr.academic_period_id
  left join public.enrolments e on e.course_run_id = cr.id and e.student_id = (select id from me) and e.status = 'active'
  where cr.school_id = p_school_id
    and exists (select 1 from me)
    and cr.approved_at is not null
    and (now() at time zone 'Africa/Accra')::date between ap.starts_on and ap.ends_on
  order by e.id is null, c.code;
$$;

-- One course: every session so far, attended or missed.
create function public.my_course_sessions(p_course_run_id uuid)
returns table (session_id uuid, starts_at timestamptz, ends_at timestamptz, voided boolean, checked_in_at timestamptz, method text, reward_marks numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.starts_at, s.ends_at, s.voided_at is not null, ci.checked_in_at, ci.method, s.reward_marks
  from public.attendance_sessions s
  join public.course_runs cr on cr.id = s.course_run_id
  join public.students st on st.school_id = cr.school_id and st.user_id = (select auth.uid())
  join public.enrolments e on e.course_run_id = cr.id and e.student_id = st.id
  left join public.session_checkins ci on ci.session_id = s.id and ci.student_id = st.id
  where s.course_run_id = p_course_run_id and s.starts_at <= now()
  order by s.starts_at desc;
$$;

-- A session opening shows up in the app straight away.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.attendance_sessions;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on all functions in schema private from public, anon;
revoke all on function
  public.lecturer_add_course(uuid, text, text, uuid),
  public.approve_course_run(uuid),
  public.register_device(text, text, text, text),
  public.my_device(text),
  public.mark_notifications_read(bigint[]),
  public.dismiss_notifications(bigint[]),
  public.my_courses(uuid),
  public.my_course_sessions(uuid)
from public, anon;
grant execute on function
  public.lecturer_add_course(uuid, text, text, uuid),
  public.approve_course_run(uuid),
  public.register_device(text, text, text, text),
  public.my_device(text),
  public.mark_notifications_read(bigint[]),
  public.dismiss_notifications(bigint[]),
  public.my_courses(uuid),
  public.my_course_sessions(uuid)
to authenticated;
