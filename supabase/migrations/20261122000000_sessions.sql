-- Part 5: tertiary attendance sessions.
--
-- A lecturer (or admin) opens a session for a course run. Students check in
-- from the mobile app only, through public.check_in(), which checks:
--   the session is open (database clock), the student is enrolled, the phone
--   is the student's bound phone and has not checked anyone else in, the
--   location is within the radius (allowing for GPS accuracy), the location is
--   not mocked, and the rotating QR (Quick Response) code when the session uses one.
-- Lecturers can add or remove a student, end early or void a session, always
-- with a reason that is logged.
--
-- Devices: each student account has one active phone. A new phone becomes
-- active after 48 hours, or straight away when an admin approves it. After two
-- changes in a semester only an admin can approve.
--
-- Push notifications go through push_outbox and the send-push Edge Function,
-- woken every minute like the SMS sender.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Venues (saved locations for sessions started on the web)
-- ---------------------------------------------------------------------------

create table public.venues (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  location extensions.geography(point, 4326) not null,
  radius_m integer not null default 75 check (radius_m between 50 and 1000),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint venues_name_unique unique (school_id, name),
  constraint venues_id_school unique (id, school_id)
);

create trigger venues_touch before update on public.venues
  for each row execute function private.touch_updated_at();
create trigger venues_tertiary before insert or update on public.venues
  for each row execute function private.require_school_type('tertiary');

-- ---------------------------------------------------------------------------
-- Devices (one active phone per student account)
-- ---------------------------------------------------------------------------

create type public.device_status as enum ('active', 'pending', 'replaced', 'cancelled');

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- SHA-256 of the secret kept in the phone's secure storage. The secret never leaves the phone otherwise.
  secret_hash text not null unique check (secret_hash ~ '^[0-9a-f]{64}$'),
  label text not null default 'Phone' check (char_length(label) between 1 and 80),
  platform text not null check (platform in ('ios', 'android')),
  push_token text check (push_token is null or char_length(push_token) <= 200),
  status public.device_status not null,
  is_first boolean not null default false,
  requested_at timestamptz not null default now(),
  -- When a pending phone becomes active on its own. Null: waits for an admin.
  active_from timestamptz,
  approved_by uuid references auth.users (id) on delete set null,
  approved_at timestamptz,
  replaced_at timestamptz
);

create unique index devices_one_active on public.devices (user_id) where status = 'active';
create unique index devices_one_pending on public.devices (user_id) where status = 'pending';
create index devices_due_idx on public.devices (active_from) where status = 'pending';

-- ---------------------------------------------------------------------------
-- Sessions and check-ins
-- ---------------------------------------------------------------------------

create table public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  course_run_id uuid not null,
  venue_id uuid,
  -- Centre of the check-in area; null when the session has no location check.
  location extensions.geography(point, 4326),
  radius_m integer check (radius_m between 50 and 1000),
  reward_marks numeric(5, 2) not null default 0
    check (reward_marks >= 0 and reward_marks <= 100 and reward_marks * 4 = floor(reward_marks * 4)),
  qr_required boolean not null default false,
  -- Never readable by apps (column grants below); used to make the rotating QR code.
  qr_secret bytea not null default extensions.gen_random_bytes(32),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  started_by uuid,
  voided_at timestamptz,
  voided_by uuid,
  void_reason text,
  notified_open_at timestamptz,
  notified_soon_at timestamptz,
  notified_closed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint attendance_sessions_times check (ends_at > starts_at and ends_at <= starts_at + interval '6 hours'),
  constraint attendance_sessions_location check ((location is null) = (radius_m is null)),
  constraint attendance_sessions_void check ((voided_at is null) = (void_reason is null)),
  constraint attendance_sessions_id_school unique (id, school_id),
  -- One session at a time per course.
  constraint attendance_sessions_no_overlap exclude using gist (
    course_run_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (voided_at is null),
  foreign key (course_run_id, school_id) references public.course_runs (id, school_id) on delete cascade,
  foreign key (venue_id, school_id) references public.venues (id, school_id) on delete set null (venue_id),
  foreign key (started_by, school_id) references public.staff (id, school_id) on delete set null (started_by),
  foreign key (voided_by, school_id) references public.staff (id, school_id) on delete set null (voided_by)
);

create index attendance_sessions_run_idx on public.attendance_sessions (course_run_id, starts_at desc);
create index attendance_sessions_open_idx on public.attendance_sessions (ends_at) where voided_at is null;

create table public.session_checkins (
  session_id uuid not null,
  student_id uuid not null,
  school_id uuid not null references public.schools (id) on delete cascade,
  method text not null check (method in ('self', 'manual')),
  checked_in_at timestamptz not null default now(),
  device_id uuid references public.devices (id) on delete set null,
  location extensions.geography(point, 4326),
  distance_m numeric(8, 1),
  accuracy_m numeric(8, 1),
  added_by uuid,
  reason text check (reason is null or char_length(reason) between 3 and 300),
  primary key (session_id, student_id),
  -- One phone checks in one student per session.
  constraint session_checkins_device_once unique (session_id, device_id),
  constraint session_checkins_manual check ((method = 'manual') = (reason is not null)),
  foreign key (session_id, school_id) references public.attendance_sessions (id, school_id) on delete cascade,
  foreign key (student_id, school_id) references public.students (id, school_id) on delete cascade,
  foreign key (added_by, school_id) references public.staff (id, school_id) on delete set null (added_by)
);

create index session_checkins_student_idx on public.session_checkins (student_id);

-- Every change a lecturer makes by hand.
create table public.session_adjustments (
  id bigint generated always as identity primary key,
  session_id uuid not null,
  school_id uuid not null references public.schools (id) on delete cascade,
  student_id uuid,
  action text not null check (action in ('manual_add', 'remove', 'end_early', 'void')),
  reason text not null check (char_length(reason) between 3 and 300),
  staff_id uuid,
  created_at timestamptz not null default now(),
  foreign key (session_id, school_id) references public.attendance_sessions (id, school_id) on delete cascade,
  foreign key (student_id, school_id) references public.students (id, school_id) on delete set null (student_id),
  foreign key (staff_id, school_id) references public.staff (id, school_id) on delete set null (staff_id)
);

create index session_adjustments_session_idx on public.session_adjustments (session_id);

-- ---------------------------------------------------------------------------
-- Push notifications
-- ---------------------------------------------------------------------------

create table public.push_outbox (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Set to send to one particular phone (for example the old phone when a new one signs in).
  device_id uuid references public.devices (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  body text not null check (char_length(body) between 1 and 300),
  data jsonb not null default '{}',
  status text not null default 'queued' check (status in ('queued', 'sending', 'sent', 'failed', 'no_device')),
  attempts smallint not null default 0,
  ticket_id text,
  error text,
  send_after timestamptz not null default now(),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  updated_at timestamptz not null default now()
);

create index push_outbox_due_idx on public.push_outbox (send_after) where status = 'queued';

create trigger push_outbox_touch before update on public.push_outbox
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Access
-- ---------------------------------------------------------------------------

alter table public.venues enable row level security;
alter table public.devices enable row level security;
alter table public.attendance_sessions enable row level security;
alter table public.session_checkins enable row level security;
alter table public.session_adjustments enable row level security;
alter table public.push_outbox enable row level security;

grant select, insert, update, delete on public.venues to authenticated;
grant select (id, user_id, label, platform, status, is_first, requested_at, active_from, approved_at, replaced_at)
  on public.devices to authenticated;
grant select (id, school_id, course_run_id, venue_id, location, radius_m, reward_marks, qr_required, starts_at, ends_at,
              started_by, voided_at, voided_by, void_reason, created_at)
  on public.attendance_sessions to authenticated;
grant select on public.session_checkins, public.session_adjustments to authenticated;

create policy "Staff see venues" on public.venues
  for select to authenticated using (private.is_school_staff(school_id));
create policy "Admins add venues" on public.venues
  for insert to authenticated with check (private.is_school_admin(school_id));
create policy "Admins change venues" on public.venues
  for update to authenticated using (private.is_school_admin(school_id)) with check (private.is_school_admin(school_id));
create policy "Admins remove venues" on public.venues
  for delete to authenticated using (private.is_school_admin(school_id));

create policy "People see their own phones" on public.devices
  for select to authenticated using (user_id = (select auth.uid()));

create policy "Admins, lecturers and registered students see sessions"
  on public.attendance_sessions for select to authenticated
  using (
    private.is_school_admin(school_id)
    or private.lectures_run(course_run_id)
    or exists (
      select 1 from public.enrolments e
      where e.course_run_id = attendance_sessions.course_run_id and e.status = 'active'
        and e.student_id in (select private.my_student_ids())
    )
  );

create policy "Admins and lecturers see check-ins; students see their own" on public.session_checkins
  for select to authenticated
  using (
    student_id in (select private.my_student_ids())
    or private.is_school_admin(school_id)
    or exists (select 1 from public.attendance_sessions s
               where s.id = session_checkins.session_id and private.lectures_run(s.course_run_id))
  );

create policy "Admins and lecturers see adjustments" on public.session_adjustments
  for select to authenticated
  using (
    private.is_school_admin(school_id)
    or exists (select 1 from public.attendance_sessions s
               where s.id = session_adjustments.session_id and private.lectures_run(s.course_run_id))
  );

-- Live check-in count on the lecturer's screen.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.session_checkins;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create function private.point(p_lat double precision, p_lng double precision)
returns extensions.geography
language sql
immutable
set search_path = ''
as $$
  select extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography;
$$;

create function private.session_is_open(p_session public.attendance_sessions)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_session.voided_at is null and p_session.starts_at <= now() and now() < p_session.ends_at;
$$;

-- Lecturer of the course, or admin of the school.
create function private.can_run_session(p_course_run_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.lectures_run(p_course_run_id)
      or exists (select 1 from public.course_runs cr where cr.id = p_course_run_id and private.is_school_admin(cr.school_id));
$$;

-- The code on the lecturer's screen: changes every 15 seconds.
create function private.qr_token(p_secret bytea, p_window bigint)
returns text
language sql
immutable
set search_path = ''
as $$
  select left(encode(extensions.hmac(p_window::text::bytea, p_secret, 'sha256'), 'hex'), 12);
$$;

create function private.qr_window(p_at timestamptz default now())
returns bigint
language sql
stable
set search_path = ''
as $$ select floor(extract(epoch from p_at) / 15)::bigint $$;

create function private.queue_push(p_user_id uuid, p_title text, p_body text, p_data jsonb default '{}', p_device_id uuid default null)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.push_outbox (user_id, device_id, title, body, data)
  values (p_user_id, p_device_id, left(p_title, 100), left(p_body, 300), coalesce(p_data, '{}'));
$$;

create function private.session_label(p_session_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select c.code from public.attendance_sessions s
  join public.course_runs cr on cr.id = s.course_run_id
  join public.courses c on c.id = cr.course_id
  where s.id = p_session_id;
$$;

-- ---------------------------------------------------------------------------
-- Devices
-- ---------------------------------------------------------------------------

-- Pending phones whose 48 hours have passed become the active phone.
create function private.activate_due_devices()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  d record;
  v_count integer := 0;
begin
  for d in select * from public.devices where status = 'pending' and active_from <= now() for update loop
    update public.devices set status = 'replaced', replaced_at = now() where user_id = d.user_id and status = 'active';
    update public.devices set status = 'active' where id = d.id;
    perform private.queue_push(d.user_id, 'Your new phone is ready', 'You can now check in to classes with ' || d.label || '.');
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- Called by the app at sign-in with the secret it keeps in secure storage.
-- Returns the phone's status: active, pending (with when it becomes active,
-- or null when an admin must approve), or replaced.
create function public.register_device(p_secret text, p_label text, p_platform text)
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
    update public.devices set label = v_label where id = v_device.id;
    return query select v_device.id, v_device.status, v_device.active_from,
                        v_device.status = 'pending' and v_device.active_from is null;
    return;
  end if;

  select * into v_active from public.devices where user_id = v_user and status = 'active';
  if v_active.id is null then
    -- First phone (or no active phone left): active straight away.
    insert into public.devices (user_id, secret_hash, label, platform, status, is_first)
    values (v_user, v_hash, v_label, p_platform, 'active',
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
  insert into public.devices (user_id, secret_hash, label, platform, status, active_from)
  values (v_user, v_hash, v_label, p_platform, 'pending',
          case when v_changes < 2 then now() + interval '48 hours' end)
  returning * into v_device;

  -- Warn the current phone, in case this was not the student.
  perform private.queue_push(v_user, 'New phone signing in',
    'Your RollCol account signed in on ' || v_label || '. If this was not you, change your password and tell your school.',
    '{}', v_active.id);

  return query select v_device.id, v_device.status, v_device.active_from, v_device.active_from is null;
end;
$$;

-- The app sends its push token for this phone.
create function public.set_push_token(p_secret text, p_token text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_token is not null and p_token !~ '^(Exponent|Expo)PushToken\[[A-Za-z0-9_-]+\]$' then
    raise exception 'Not a push token.' using errcode = '22023';
  end if;
  -- Another account that signed in on this phone before stops getting its notifications.
  update public.devices set push_token = null where push_token = p_token and user_id <> auth.uid();
  update public.devices set push_token = p_token
  where user_id = auth.uid() and secret_hash = encode(extensions.digest(coalesce(p_secret, ''), 'sha256'), 'hex');
end;
$$;

-- Phone changes waiting in an admin's school.
create function public.pending_device_changes(p_school_id uuid)
returns table (
  device_id uuid,
  student_id uuid,
  student_name text,
  school_number text,
  new_label text,
  old_label text,
  requested_at timestamptz,
  active_from timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not private.is_school_admin(p_school_id) then
    raise exception 'Only admins see phone changes.' using errcode = '42501';
  end if;
  return query
  select d.id, st.id, st.full_name, st.school_number, d.label,
         (select a.label from public.devices a where a.user_id = d.user_id and a.status = 'active'),
         d.requested_at, d.active_from
  from public.devices d
  join public.students st on st.user_id = d.user_id and st.school_id = p_school_id
  where d.status = 'pending'
  order by d.active_from nulls first, d.requested_at;
end;
$$;

create function public.approve_device(p_device_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_device public.devices;
begin
  select * into v_device from public.devices where id = p_device_id and status = 'pending' for update;
  if v_device.id is null then
    raise exception 'That phone change is no longer waiting.' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.students st where st.user_id = v_device.user_id and private.is_school_admin(st.school_id)) then
    raise exception 'Only an admin of the student''s school can approve a new phone.' using errcode = '42501';
  end if;
  update public.devices set active_from = now(), approved_by = auth.uid(), approved_at = now() where id = p_device_id;
  perform private.activate_due_devices();
end;
$$;

-- ---------------------------------------------------------------------------
-- Sessions
-- ---------------------------------------------------------------------------

-- Opens a session. From the web, give a venue (or no location); from the app,
-- give the lecturer's live location and its accuracy.
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
  p_qr_required boolean default false
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
  if v_radius is not null and v_radius not between 50 and 1000 then
    raise exception 'The radius must be between 50 and 1000 metres.' using errcode = '23514';
  end if;
  if p_reward_marks is null or p_reward_marks < 0 or p_reward_marks > 100 or p_reward_marks * 4 <> floor(p_reward_marks * 4) then
    raise exception 'Marks must be between 0 and 100, in quarters.' using errcode = '23514';
  end if;

  insert into public.attendance_sessions
    (school_id, course_run_id, venue_id, location, radius_m, reward_marks, qr_required, starts_at, ends_at, started_by)
  values
    (v_run.school_id, v_run.id, v_venue.id, v_location, v_radius, p_reward_marks, coalesce(p_qr_required, false),
     v_starts, v_starts + make_interval(mins => p_minutes), private.my_staff_id_in(v_run.school_id))
  returning * into v_session;
  return v_session;
exception
  when exclusion_violation then
    raise exception 'This course already has a session at that time. End it first, or choose another time.' using errcode = 'P0001';
end;
$$;

create function public.end_session(p_session_id uuid, p_reason text default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_session public.attendance_sessions;
begin
  select * into v_session from public.attendance_sessions where id = p_session_id for update;
  if v_session.id is null or not private.can_run_session(v_session.course_run_id) then
    raise exception 'Session not found.' using errcode = 'P0002';
  end if;
  if v_session.voided_at is not null or v_session.ends_at <= now() then
    raise exception 'This session has already ended.' using errcode = 'P0001';
  end if;
  if v_session.starts_at > now() then
    -- Not started yet: cancelling a scheduled session removes it.
    delete from public.attendance_sessions where id = p_session_id;
    return;
  end if;
  update public.attendance_sessions set ends_at = now() where id = p_session_id;
  insert into public.session_adjustments (session_id, school_id, action, reason, staff_id)
  values (p_session_id, v_session.school_id, 'end_early', coalesce(nullif(btrim(p_reason), ''), 'Ended early'),
          private.my_staff_id_in(v_session.school_id));
end;
$$;

-- A session that should not count (opened by mistake, class cancelled).
create function public.void_session(p_session_id uuid, p_reason text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_session public.attendance_sessions;
  v_reason text := btrim(coalesce(p_reason, ''));
  r record;
begin
  select * into v_session from public.attendance_sessions where id = p_session_id for update;
  if v_session.id is null or not private.can_run_session(v_session.course_run_id) then
    raise exception 'Session not found.' using errcode = 'P0002';
  end if;
  if v_session.voided_at is not null then
    raise exception 'This session is already void.' using errcode = 'P0001';
  end if;
  if char_length(v_reason) < 3 then
    raise exception 'Give a reason.' using errcode = '23514';
  end if;
  update public.attendance_sessions
  set voided_at = now(), voided_by = private.my_staff_id_in(v_session.school_id), void_reason = left(v_reason, 300),
      ends_at = least(ends_at, greatest(now(), starts_at + interval '1 second'))
  where id = p_session_id;
  insert into public.session_adjustments (session_id, school_id, action, reason, staff_id)
  values (p_session_id, v_session.school_id, 'void', left(v_reason, 300), private.my_staff_id_in(v_session.school_id));

  for r in
    select st.user_id from public.session_checkins c join public.students st on st.id = c.student_id
    where c.session_id = p_session_id and st.user_id is not null
  loop
    perform private.queue_push(r.user_id, private.session_label(p_session_id) || ' session cancelled',
      'Your lecturer cancelled this session, so it does not count. Reason: ' || left(v_reason, 200));
  end loop;
end;
$$;

-- The rotating code for the lecturer's screen.
create function public.session_qr(p_session_id uuid)
returns table (token text, expires_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_session public.attendance_sessions;
  v_window bigint := private.qr_window();
begin
  select * into v_session from public.attendance_sessions where id = p_session_id;
  if v_session.id is null or not private.can_run_session(v_session.course_run_id) then
    raise exception 'Session not found.' using errcode = 'P0002';
  end if;
  if not v_session.qr_required or not private.session_is_open(v_session) then
    return;
  end if;
  return query select private.qr_token(v_session.qr_secret, v_window), to_timestamp((v_window + 1) * 15);
end;
$$;

-- Students check in through this function only.
create function public.check_in(
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
  v_window bigint := private.qr_window();
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
    if p_qr_token is null
       or (lower(p_qr_token) <> private.qr_token(v_session.qr_secret, v_window)
           and lower(p_qr_token) <> private.qr_token(v_session.qr_secret, v_window - 1)) then
      raise exception 'Scan the code on your lecturer''s screen again. It changes every 15 seconds.' using errcode = 'P0001';
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

-- A lecturer adds a student by hand (for example a new phone in its 48 hours).
create function public.add_checkin_manually(p_session_id uuid, p_student_id uuid, p_reason text)
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

create function public.remove_checkin(p_session_id uuid, p_student_id uuid, p_reason text)
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
  if v_session.ends_at < now() - interval '14 days' then
    raise exception 'Sessions can be corrected for 14 days after they end.' using errcode = 'P0001';
  end if;
  if char_length(v_reason) < 3 then
    raise exception 'Give a reason.' using errcode = '23514';
  end if;
  delete from public.session_checkins where session_id = p_session_id and student_id = p_student_id;
  if not found then
    raise exception 'That student is not checked in.' using errcode = 'P0002';
  end if;
  insert into public.session_adjustments (session_id, school_id, student_id, action, reason, staff_id)
  values (p_session_id, v_session.school_id, p_student_id, 'remove', left(v_reason, 300), private.my_staff_id_in(v_session.school_id));

  select user_id into v_user from public.students where id = p_student_id;
  if v_user is not null then
    perform private.queue_push(v_user, private.session_label(p_session_id) || ': check-in removed',
      'Your lecturer removed your check-in. Reason: ' || left(v_reason, 200));
  end if;
end;
$$;

-- Everyone registered for the session's course, with their check-in if any.
create function public.session_roster(p_session_id uuid)
returns table (
  student_id uuid,
  full_name text,
  school_number text,
  has_app boolean,
  checked_in_at timestamptz,
  method text,
  distance_m numeric,
  reason text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_session public.attendance_sessions;
begin
  select * into v_session from public.attendance_sessions where id = p_session_id;
  if v_session.id is null or not private.can_run_session(v_session.course_run_id) then
    raise exception 'Session not found.' using errcode = 'P0002';
  end if;
  return query
  select st.id, st.full_name, st.school_number, st.user_id is not null, c.checked_in_at, c.method, c.distance_m, c.reason
  from public.enrolments e
  join public.students st on st.id = e.student_id
  left join public.session_checkins c on c.session_id = p_session_id and c.student_id = st.id
  where e.course_run_id = v_session.course_run_id and (e.status = 'active' or c.student_id is not null)
  order by c.checked_in_at is null, c.checked_in_at desc, st.full_name;
end;
$$;

-- Sessions a student can check in to right now (for the app's home screen).
create function public.my_open_sessions()
returns table (
  session_id uuid,
  school_id uuid,
  course_code text,
  course_title text,
  starts_at timestamptz,
  ends_at timestamptz,
  needs_location boolean,
  qr_required boolean,
  reward_marks numeric,
  checked_in_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.school_id, c.code, c.title, s.starts_at, s.ends_at, s.location is not null, s.qr_required,
         s.reward_marks, ci.checked_in_at
  from public.students st
  join public.enrolments e on e.student_id = st.id and e.status = 'active'
  join public.attendance_sessions s on s.course_run_id = e.course_run_id
  join public.course_runs cr on cr.id = s.course_run_id
  join public.courses c on c.id = cr.course_id
  left join public.session_checkins ci on ci.session_id = s.id and ci.student_id = st.id
  where st.user_id = (select auth.uid()) and st.status = 'active'
    and s.voided_at is null and s.starts_at <= now() + interval '12 hours' and s.ends_at > now()
  order by s.starts_at;
$$;

-- Venues with plain coordinates, for the Venues page and the app.
create function public.school_venues(p_school_id uuid)
returns table (id uuid, name text, latitude double precision, longitude double precision, radius_m integer)
language sql
stable
security definer
set search_path = ''
as $$
  select v.id, v.name, extensions.st_y(v.location::extensions.geometry), extensions.st_x(v.location::extensions.geometry), v.radius_m
  from public.venues v
  where v.school_id = p_school_id and private.is_school_staff(p_school_id)
  order by v.name;
$$;

-- ---------------------------------------------------------------------------
-- Notifications job (every minute)
-- ---------------------------------------------------------------------------

create function private.queue_session_notifications()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  s record;
begin
  -- Session opened.
  for s in
    select a.*, private.session_label(a.id) as code from public.attendance_sessions a
    where a.notified_open_at is null and a.voided_at is null and a.starts_at <= now() and a.ends_at > now()
  loop
    insert into public.push_outbox (user_id, title, body, data)
    select st.user_id, s.code || ' is open',
           'Check in before ' || to_char(s.ends_at at time zone 'Africa/Accra', 'FMHH12:MIam') || '.',
           jsonb_build_object('sessionId', s.id)
    from public.enrolments e join public.students st on st.id = e.student_id
    where e.course_run_id = s.course_run_id and e.status = 'active' and st.status = 'active' and st.user_id is not null
      and not exists (select 1 from public.session_checkins c where c.session_id = s.id and c.student_id = st.id);
    update public.attendance_sessions set notified_open_at = now() where id = s.id;
  end loop;

  -- Five minutes left (sessions longer than ten minutes), to those not checked in.
  for s in
    select a.*, private.session_label(a.id) as code from public.attendance_sessions a
    where a.notified_soon_at is null and a.voided_at is null and a.ends_at - a.starts_at > interval '10 minutes'
      and now() >= a.ends_at - interval '5 minutes' and now() < a.ends_at
  loop
    insert into public.push_outbox (user_id, title, body, data)
    select st.user_id, s.code || ': 5 minutes left', 'Check in now if you are in class.', jsonb_build_object('sessionId', s.id)
    from public.enrolments e join public.students st on st.id = e.student_id
    where e.course_run_id = s.course_run_id and e.status = 'active' and st.status = 'active' and st.user_id is not null
      and not exists (select 1 from public.session_checkins c where c.session_id = s.id and c.student_id = st.id);
    update public.attendance_sessions set notified_soon_at = now() where id = s.id;
  end loop;

  -- Closed: present or missed. Sessions that ended over an hour ago are only marked.
  for s in
    select a.*, private.session_label(a.id) as code from public.attendance_sessions a
    where a.notified_closed_at is null and a.ends_at <= now()
  loop
    if s.voided_at is null and s.ends_at > now() - interval '1 hour' then
      insert into public.push_outbox (user_id, title, body, data)
      select st.user_id,
             s.code || case when c.student_id is null then ': missed' else ': present' end,
             case when c.student_id is null then 'You did not check in to this session.'
                  else 'Your attendance is recorded' ||
                       case when s.reward_marks > 0 then ' (' || trim(to_char(s.reward_marks, 'FM990.99')) || ' marks).' else '.' end
             end,
             jsonb_build_object('sessionId', s.id)
      from public.enrolments e join public.students st on st.id = e.student_id
      left join public.session_checkins c on c.session_id = s.id and c.student_id = st.id
      where e.course_run_id = s.course_run_id and e.status = 'active' and st.status = 'active' and st.user_id is not null;
    end if;
    update public.attendance_sessions set notified_closed_at = now() where id = s.id;
  end loop;
end;
$$;

-- Takes up to p_limit due notifications with the phone's push token.
create function public.claim_push(p_limit integer default 100)
returns table (id bigint, push_token text, title text, body text, data jsonb)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  -- Nobody to send to: no active phone with a push token.
  update public.push_outbox o set status = 'no_device'
  where o.status = 'queued' and o.send_after <= now()
    and not exists (
      select 1 from public.devices d
      where d.push_token is not null
        and ((o.device_id is not null and d.id = o.device_id)
             or (o.device_id is null and d.user_id = o.user_id and d.status = 'active'))
    );

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
  )
  select m.id, d.push_token, m.title, m.body, m.data
  from marked m
  join public.devices d
    on d.push_token is not null
   and ((m.device_id is not null and d.id = m.device_id)
        or (m.device_id is null and d.user_id = m.user_id and d.status = 'active'));
end;
$$;

create function public.finish_push(p_id bigint, p_ok boolean, p_ticket text default null, p_error text default null)
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
    -- The app was removed: forget the token.
    update public.devices set push_token = null
    where push_token = (select d.push_token from public.push_outbox o join public.devices d
                        on (o.device_id = d.id) or (o.device_id is null and d.user_id = o.user_id and d.status = 'active')
                        where o.id = p_id limit 1);
    update public.push_outbox set status = 'failed', error = p_error where id = p_id;
  else
    update public.push_outbox
    set status = case when attempts < 3 then 'queued' else 'failed' end,
        send_after = now() + interval '2 minutes', error = left(p_error, 500)
    where id = p_id;
  end if;
end;
$$;

create function private.run_push_pipeline()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  perform private.activate_due_devices();
  perform private.queue_session_notifications();

  update public.push_outbox set status = 'queued'
  where status = 'sending' and updated_at < now() - interval '10 minutes';

  select value into v_url from private.config where key = 'push_sender_url';
  select value into v_secret from private.config where key = 'cron_secret';
  if v_url is not null and v_secret is not null
     and exists (select 1 from public.push_outbox where status = 'queued' and send_after <= now()) then
    perform net.http_post(
      url := v_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
  end if;
end;
$$;

select cron.schedule('push-pipeline', '* * * * *', $$select private.run_push_pipeline()$$);

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on all functions in schema private from public, anon;
revoke all on function
  private.activate_due_devices(),
  private.queue_push(uuid, text, text, jsonb, uuid),
  private.queue_session_notifications(),
  private.run_push_pipeline()
from authenticated;

revoke all on function
  public.register_device(text, text, text),
  public.set_push_token(text, text),
  public.pending_device_changes(uuid),
  public.approve_device(uuid),
  public.start_session(uuid, integer, timestamptz, uuid, double precision, double precision, double precision, integer, numeric, boolean),
  public.end_session(uuid, text),
  public.void_session(uuid, text),
  public.session_qr(uuid),
  public.check_in(uuid, text, double precision, double precision, double precision, boolean, text),
  public.add_checkin_manually(uuid, uuid, text),
  public.remove_checkin(uuid, uuid, text),
  public.session_roster(uuid),
  public.my_open_sessions(),
  public.school_venues(uuid),
  public.claim_push(integer),
  public.finish_push(bigint, boolean, text, text)
from public, anon, authenticated;

grant execute on function
  public.register_device(text, text, text),
  public.set_push_token(text, text),
  public.pending_device_changes(uuid),
  public.approve_device(uuid),
  public.start_session(uuid, integer, timestamptz, uuid, double precision, double precision, double precision, integer, numeric, boolean),
  public.end_session(uuid, text),
  public.void_session(uuid, text),
  public.session_qr(uuid),
  public.check_in(uuid, text, double precision, double precision, double precision, boolean, text),
  public.add_checkin_manually(uuid, uuid, text),
  public.remove_checkin(uuid, uuid, text),
  public.session_roster(uuid),
  public.my_open_sessions(),
  public.school_venues(uuid)
to authenticated;

grant execute on function public.claim_push(integer), public.finish_push(bigint, boolean, text, text) to service_role;
