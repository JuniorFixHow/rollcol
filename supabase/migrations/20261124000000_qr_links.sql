-- Scanning the check-in code with any camera or QR app.
--
-- The code now holds a web link (https://<site>/checkin/<session>?t=<token>).
-- A phone camera opens it; the web page hands over to the RollCol app, which
-- claims the code at once. The claim gives a pass that lasts two minutes, so
-- Face ID and finding the location afterwards do not make the code expire.
-- The pass belongs to one student and one session, and is used once.

create table private.qr_passes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.attendance_sessions (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '2 minutes'
);

create index qr_passes_lookup on private.qr_passes (session_id, student_id);

-- Checks a scanned code and returns a pass. Accepts the code shown now and
-- the two before it, because opening the link through a browser takes a few seconds.
create function public.claim_qr(p_session_id uuid, p_token text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_session public.attendance_sessions;
  v_student uuid;
  v_window bigint;
  v_token text := lower(btrim(coalesce(p_token, '')));
  v_pass uuid;
begin
  select * into v_session from public.attendance_sessions where id = p_session_id;
  if v_session.id is null or not private.session_is_open(v_session) then
    raise exception 'This session is not open for check-in.' using errcode = 'P0001';
  end if;
  select st.id into v_student from public.students st
  where st.user_id = auth.uid() and st.school_id = v_session.school_id and st.status = 'active';
  if v_student is null then
    raise exception 'You are not an active student of this school.' using errcode = '42501';
  end if;
  v_window := private.qr_window(now(), v_session.qr_seconds);
  if v_token not in (
    private.qr_token(v_session.qr_secret, v_window),
    private.qr_token(v_session.qr_secret, v_window - 1),
    private.qr_token(v_session.qr_secret, v_window - 2)
  ) then
    raise exception 'That code has changed. Scan the code on your lecturer''s screen again.' using errcode = 'P0001';
  end if;
  delete from private.qr_passes where expires_at < now() - interval '1 hour';
  insert into private.qr_passes (session_id, student_id) values (v_session.id, v_student) returning id into v_pass;
  return v_pass;
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
    -- Either a code scanned just now, or a pass from claim_qr (scanned a moment
    -- ago, before Face ID and location).
    if not (
      (p_qr_token is not null
       and (lower(p_qr_token) = private.qr_token(v_session.qr_secret, v_window)
            or lower(p_qr_token) = private.qr_token(v_session.qr_secret, v_window - 1)))
      or exists (
        select 1 from private.qr_passes qp
        where p_qr_token ~* '^[0-9a-f-]{36}$' and qp.id = p_qr_token::uuid
          and qp.session_id = v_session.id and qp.student_id = v_student.id and qp.expires_at > now()
      )
    ) then
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

-- A pass is used once: removed when the check-in is saved.
create function private.use_qr_pass()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from private.qr_passes where session_id = new.session_id and student_id = new.student_id;
  return new;
end;
$$;

create trigger session_checkins_use_pass after insert on public.session_checkins
  for each row execute function private.use_qr_pass();

revoke all on all functions in schema private from public, anon;
revoke all on function public.claim_qr(uuid, text) from public, anon;
grant execute on function public.claim_qr(uuid, text) to authenticated;
