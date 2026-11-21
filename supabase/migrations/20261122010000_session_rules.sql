-- Session rules from testing Part 5a.
--
-- * The rotating code's interval is chosen per session: 10 to 60 seconds, 15 by default.
-- * A student's own check-in can only be removed by an admin, unless the school
--   lets lecturers do it (off by default).
-- * Adding students after a session ends is a school setting for lecturers
--   (off by default). Admins can always correct, and every change is logged.
-- * Lecturers can add venues (a school setting, on by default). A lecturer's venue
--   is "unverified" until an admin verifies it; it can still be used. Venue
--   names are unique in a school, ignoring capitals and extra spaces.

alter table public.school_settings
  add column lecturers_add_venues boolean not null default true,
  add column lecturers_remove_self_checkins boolean not null default false,
  add column lecturers_add_after_end boolean not null default false;

grant update (lecturers_add_venues, lecturers_remove_self_checkins, lecturers_add_after_end)
  on public.school_settings to authenticated;

alter table public.attendance_sessions
  add column qr_seconds smallint not null default 15 check (qr_seconds between 10 and 60);
grant select (qr_seconds) on public.attendance_sessions to authenticated;

-- QR windows of any length.
drop function private.qr_window(timestamptz);
create function private.qr_window(p_at timestamptz, p_seconds integer)
returns bigint
language sql
stable
set search_path = ''
as $$ select floor(extract(epoch from p_at) / p_seconds)::bigint $$;

-- ---------------------------------------------------------------------------
-- Venues
-- ---------------------------------------------------------------------------

alter table public.venues
  add column verified_at timestamptz,
  add column verified_by uuid references auth.users (id) on delete set null;

-- Existing venues were added by admins.
update public.venues set verified_at = created_at where verified_at is null;

alter table public.venues drop constraint venues_name_unique;
create unique index venues_name_unique on public.venues
  (school_id, lower(regexp_replace(btrim(name), '\s+', ' ', 'g')));

-- Venues change only through the functions below.
drop policy "Admins add venues" on public.venues;
drop policy "Admins change venues" on public.venues;
drop policy "Admins remove venues" on public.venues;
revoke insert, update, delete on public.venues from authenticated;

create function private.can_add_venues(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_school_admin(p_school_id)
      or (private.is_school_staff(p_school_id)
          and coalesce((select lecturers_add_venues from public.school_settings where school_id = p_school_id), true));
$$;

-- Adds a venue. An admin's venue is verified straight away.
create function public.add_venue(
  p_school_id uuid,
  p_name text,
  p_lat double precision,
  p_lng double precision,
  p_radius_m integer
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_name text := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_existing text;
  v_id uuid;
begin
  if not private.can_add_venues(p_school_id) then
    raise exception 'Your school only lets admins add venues.' using errcode = '42501';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 80 then
    raise exception 'Enter the venue''s name.' using errcode = '23514';
  end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'That location is not valid.' using errcode = '22023';
  end if;
  select name into v_existing from public.venues
  where school_id = p_school_id and lower(name) = lower(v_name);
  if v_existing is not null then
    raise exception '"%" is already saved. Choose it from the list.', v_existing using errcode = '23505';
  end if;

  insert into public.venues (school_id, name, location, radius_m, created_by, verified_at, verified_by)
  values (p_school_id, v_name, private.point(p_lat, p_lng), coalesce(p_radius_m, 75), auth.uid(),
          case when private.is_school_admin(p_school_id) then now() end,
          case when private.is_school_admin(p_school_id) then auth.uid() end)
  returning id into v_id;
  return v_id;
end;
$$;

create function public.verify_venue(p_venue_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_school uuid := (select school_id from public.venues where id = p_venue_id);
begin
  if v_school is null or not private.is_school_admin(v_school) then
    raise exception 'Only admins verify venues.' using errcode = '42501';
  end if;
  update public.venues set verified_at = now(), verified_by = auth.uid() where id = p_venue_id;
end;
$$;

-- Admins remove any venue; a lecturer removes an unverified venue they added.
-- Past sessions keep their location.
create function public.remove_venue(p_venue_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_venue public.venues;
begin
  select * into v_venue from public.venues where id = p_venue_id;
  if v_venue.id is null then
    raise exception 'Venue not found.' using errcode = 'P0002';
  end if;
  if not (private.is_school_admin(v_venue.school_id)
          or (v_venue.created_by = auth.uid() and v_venue.verified_at is null)) then
    raise exception 'Only admins can remove this venue.' using errcode = '42501';
  end if;
  delete from public.venues where id = p_venue_id;
end;
$$;

drop function public.school_venues(uuid);
create function public.school_venues(p_school_id uuid)
returns table (
  id uuid,
  name text,
  latitude double precision,
  longitude double precision,
  radius_m integer,
  verified boolean,
  added_by text,
  mine boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select v.id, v.name, extensions.st_y(v.location::extensions.geometry), extensions.st_x(v.location::extensions.geometry),
         v.radius_m, v.verified_at is not null,
         (select sf.full_name from public.staff sf where sf.user_id = v.created_by and sf.school_id = v.school_id limit 1),
         v.created_by = (select auth.uid())
  from public.venues v
  where v.school_id = p_school_id and private.is_school_staff(p_school_id)
  order by v.verified_at is null, v.name;
$$;

-- ---------------------------------------------------------------------------
-- Sessions
-- ---------------------------------------------------------------------------

drop function public.start_session(uuid, integer, timestamptz, uuid, double precision, double precision, double precision, integer, numeric, boolean);

create function public.start_session(
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

create or replace function public.session_qr(p_session_id uuid)
returns table (token text, expires_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_session public.attendance_sessions;
  v_window bigint;
begin
  select * into v_session from public.attendance_sessions where id = p_session_id;
  if v_session.id is null or not private.can_run_session(v_session.course_run_id) then
    raise exception 'Session not found.' using errcode = 'P0002';
  end if;
  if not v_session.qr_required or not private.session_is_open(v_session) then
    return;
  end if;
  v_window := private.qr_window(now(), v_session.qr_seconds);
  return query select private.qr_token(v_session.qr_secret, v_window), to_timestamp((v_window + 1) * v_session.qr_seconds);
end;
$$;

create or replace function public.check_in(
  p_session_id uuid,
  p_device_secret text,
  p_lat double precision default null,
  p_lng double precision default null,
  p_accuracy double precision default null,
  p_mocked boolean default false,
  p_qr_token text default null
)
returns table (checked_in_at timestamptz, distance_m numeric, course_code text, reward_marks numeric)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_session public.attendance_sessions;
  v_student public.students;
  v_device public.devices;
  v_point extensions.geography;
  v_distance double precision;
  v_window bigint;
  v_code text;
  v_row public.session_checkins;
begin
  perform private.activate_due_devices();

  select * into v_session from public.attendance_sessions where id = p_session_id;
  if v_session.id is null then
    raise exception 'Session not found.' using errcode = 'P0002';
  end if;
  v_code := private.session_label(v_session.id);
  if v_session.voided_at is not null then
    raise exception 'Your lecturer cancelled this session.' using errcode = 'P0001';
  end if;
  if now() < v_session.starts_at then
    raise exception '% has not started yet. It opens at %.', v_code,
      to_char(v_session.starts_at at time zone 'Africa/Accra', 'FMHH12:MIam') using errcode = 'P0001';
  end if;
  if now() >= v_session.ends_at then
    raise exception 'Check-in for % has closed.', v_code using errcode = 'P0001';
  end if;

  select st.* into v_student from public.students st
  where st.user_id = auth.uid() and st.school_id = v_session.school_id;
  if v_student.id is null or v_student.status <> 'active' then
    raise exception 'You are not an active student of this school.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.enrolments e
                 where e.course_run_id = v_session.course_run_id and e.student_id = v_student.id and e.status = 'active') then
    raise exception 'You are not registered for %. Join the course first.', v_code using errcode = '42501';
  end if;

  if exists (select 1 from public.session_checkins c where c.session_id = v_session.id and c.student_id = v_student.id) then
    raise exception 'You have already checked in to %.', v_code using errcode = '23505';
  end if;

  select * into v_device from public.devices
  where user_id = auth.uid() and secret_hash = encode(extensions.digest(coalesce(p_device_secret, ''), 'sha256'), 'hex');
  if v_device.id is null then
    raise exception 'This phone is not registered to you. Sign out and sign in again on your own phone.' using errcode = '42501';
  end if;
  if v_device.status = 'pending' then
    if v_device.active_from is null then
      raise exception 'This is a new phone. Your school admin must approve it before you can check in. Ask your lecturer to add you meanwhile.'
        using errcode = 'P0001';
    end if;
    raise exception 'This is a new phone. It can check in from %. Ask your lecturer to add you meanwhile.',
      to_char(v_device.active_from at time zone 'Africa/Accra', 'FMDD Mon "at" FMHH12:MIam') using errcode = 'P0001';
  end if;
  if v_device.status <> 'active' then
    raise exception 'This phone was replaced by another one. Check in from your current phone.' using errcode = '42501';
  end if;

  if coalesce(p_mocked, false) then
    raise exception 'Your phone is using a fake location. Turn off mock location apps and try again.' using errcode = 'P0001';
  end if;

  if v_session.location is not null then
    if p_lat is null or p_lng is null or p_accuracy is null then
      raise exception 'Turn on location to check in to %.', v_code using errcode = 'P0001';
    end if;
    if p_accuracy > 100 then
      raise exception 'Your location is not precise enough (about % metres). Turn on precise location, move near a window or outside, and try again.',
        round(p_accuracy::numeric) using errcode = 'P0001';
    end if;
    v_point := private.point(p_lat, p_lng);
    v_distance := extensions.st_distance(v_point, v_session.location);
    -- Allow for the phone's stated accuracy, up to 50 metres.
    if v_distance - least(p_accuracy, 50) > v_session.radius_m then
      raise exception 'You are about % metres from the class. Check-in works within % metres.',
        round(v_distance::numeric), v_session.radius_m using errcode = 'P0001';
    end if;
  end if;

  if v_session.qr_required then
    v_window := private.qr_window(now(), v_session.qr_seconds);
    if p_qr_token is null
       or (lower(p_qr_token) <> private.qr_token(v_session.qr_secret, v_window)
           and lower(p_qr_token) <> private.qr_token(v_session.qr_secret, v_window - 1)) then
      raise exception 'Scan the code on your lecturer''s screen again. It changes every few seconds.' using errcode = 'P0001';
    end if;
  end if;

  begin
    insert into public.session_checkins
      (session_id, student_id, school_id, method, device_id, location, distance_m, accuracy_m)
    values
      (v_session.id, v_student.id, v_session.school_id, 'self', v_device.id, v_point,
       round(v_distance::numeric, 1), round(p_accuracy::numeric, 1))
    returning * into v_row;
  exception
    when unique_violation then
      if exists (select 1 from public.session_checkins c where c.session_id = v_session.id and c.student_id = v_student.id) then
        raise exception 'You have already checked in to %.', v_code using errcode = '23505';
      end if;
      raise exception 'This phone has already checked in another student to this session. Each student checks in on their own phone.'
        using errcode = '23505';
  end;

  return query select v_row.checked_in_at, v_row.distance_m, v_code, v_session.reward_marks;
end;
$$;

create or replace function public.add_checkin_manually(p_session_id uuid, p_student_id uuid, p_reason text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_session public.attendance_sessions;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_user uuid;
begin
  select * into v_session from public.attendance_sessions where id = p_session_id;
  if v_session.id is null or not private.can_run_session(v_session.course_run_id) then
    raise exception 'Session not found.' using errcode = 'P0002';
  end if;
  if v_session.voided_at is not null then
    raise exception 'This session was cancelled.' using errcode = 'P0001';
  end if;
  if v_session.starts_at > now() then
    raise exception 'This session has not started yet.' using errcode = 'P0001';
  end if;
  if v_session.ends_at <= now() and not private.is_school_admin(v_session.school_id)
     and not (select lecturers_add_after_end from public.school_settings where school_id = v_session.school_id) then
    raise exception 'Your school does not let lecturers add students after a session ends. Ask an admin.' using errcode = '42501';
  end if;
  if v_session.ends_at < now() - interval '14 days' then
    raise exception 'Sessions can be corrected for 14 days after they end.' using errcode = 'P0001';
  end if;
  if char_length(v_reason) < 3 then
    raise exception 'Give a reason.' using errcode = '23514';
  end if;
  if not exists (select 1 from public.enrolments e
                 where e.course_run_id = v_session.course_run_id and e.student_id = p_student_id and e.status = 'active') then
    raise exception 'That student is not registered for this course.' using errcode = 'P0001';
  end if;

  insert into public.session_checkins (session_id, student_id, school_id, method, added_by, reason)
  values (p_session_id, p_student_id, v_session.school_id, 'manual', private.my_staff_id_in(v_session.school_id), left(v_reason, 300))
  on conflict (session_id, student_id) do nothing;
  if not found then
    raise exception 'That student is already checked in.' using errcode = '23505';
  end if;
  insert into public.session_adjustments (session_id, school_id, student_id, action, reason, staff_id)
  values (p_session_id, v_session.school_id, p_student_id, 'manual_add', left(v_reason, 300), private.my_staff_id_in(v_session.school_id));

  select user_id into v_user from public.students where id = p_student_id;
  if v_user is not null then
    perform private.queue_push(v_user, private.session_label(p_session_id) || ': marked present',
      'Your lecturer marked you present. Reason: ' || left(v_reason, 200));
  end if;
end;
$$;

create or replace function public.remove_checkin(p_session_id uuid, p_student_id uuid, p_reason text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_session public.attendance_sessions;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_user uuid;
  v_method text;
begin
  select * into v_session from public.attendance_sessions where id = p_session_id;
  if v_session.id is null or not private.can_run_session(v_session.course_run_id) then
    raise exception 'Session not found.' using errcode = 'P0002';
  end if;
  if v_session.ends_at < now() - interval '14 days' then
    raise exception 'Sessions can be corrected for 14 days after they end.' using errcode = 'P0001';
  end if;
  if char_length(v_reason) < 3 then
    raise exception 'Give a reason.' using errcode = '23514';
  end if;
  select method into v_method from public.session_checkins where session_id = p_session_id and student_id = p_student_id;
  if v_method is null then
    raise exception 'That student is not checked in.' using errcode = 'P0002';
  end if;
  -- A student's own check-in passed every check; only admins (or lecturers, if the school allows it) remove it.
  if v_method = 'self' and not private.is_school_admin(v_session.school_id)
     and not (select lecturers_remove_self_checkins from public.school_settings where school_id = v_session.school_id) then
    raise exception 'Students who checked in themselves can only be removed by an admin.' using errcode = '42501';
  end if;
  if v_session.ends_at <= now() and v_method = 'manual' and not private.is_school_admin(v_session.school_id)
     and not (select lecturers_add_after_end from public.school_settings where school_id = v_session.school_id) then
    raise exception 'Your school does not let lecturers change attendance after a session ends. Ask an admin.' using errcode = '42501';
  end if;
  delete from public.session_checkins where session_id = p_session_id and student_id = p_student_id;
  insert into public.session_adjustments (session_id, school_id, student_id, action, reason, staff_id)
  values (p_session_id, v_session.school_id, p_student_id, 'remove', left(v_reason, 300), private.my_staff_id_in(v_session.school_id));

  select user_id into v_user from public.students where id = p_student_id;
  if v_user is not null then
    perform private.queue_push(v_user, private.session_label(p_session_id) || ': check-in removed',
      'Your lecturer removed your check-in. Reason: ' || left(v_reason, 200));
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on all functions in schema private from public, anon;
revoke all on function
  public.add_venue(uuid, text, double precision, double precision, integer),
  public.verify_venue(uuid),
  public.remove_venue(uuid),
  public.school_venues(uuid),
  public.start_session(uuid, integer, timestamptz, uuid, double precision, double precision, double precision, integer, numeric, boolean, integer)
from public, anon;
grant execute on function
  public.add_venue(uuid, text, double precision, double precision, integer),
  public.verify_venue(uuid),
  public.remove_venue(uuid),
  public.school_venues(uuid),
  public.start_session(uuid, integer, timestamptz, uuid, double precision, double precision, double precision, integer, numeric, boolean, integer)
to authenticated;
