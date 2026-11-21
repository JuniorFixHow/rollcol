-- =============================================================================
-- RollCol test data
--
-- Run in the Supabase dashboard: SQL Editor > New query > paste this file > Run.
-- Running it again replaces the previous test data. To remove it, run remove.sql.
--
-- It creates three verified test schools whose names start with "Test:":
--   Test: Adenta Basic School   basic school, daily registers
--   Test: Labone SHS            senior high, a register every period
--   Test: Accra Nursing College tertiary (for check-in, Part 5)
-- with staff, classes, subjects, students, a current term or semester, and
-- two weeks of past registers. Test accounts end in @rollcol.test and share
-- one password. Your own account becomes an admin of all three schools, so
-- you can also try the school switcher.
--
-- EDIT THE THREE VALUES BELOW FIRST.
-- =============================================================================

create temporary table test_settings as
select
  'YOUR-EMAIL@example.com'::text as my_email,  -- the email of your own RollCol account
  '+233240000000'::text as my_phone,            -- YOUR phone, in +233 format. Test guardians use only this
                                                -- number, so test SMS (Part 4) can only ever reach you.
  'RollCol-Test-2026'::text as password;        -- password for every @rollcol.test account

-- -----------------------------------------------------------------------------
-- Clear the previous test data
-- -----------------------------------------------------------------------------

delete from public.schools where name like 'Test: %';
delete from auth.users where email like '%@rollcol.test';

-- -----------------------------------------------------------------------------
-- Helpers (temporary: they disappear when this query finishes)
-- -----------------------------------------------------------------------------

-- Creates a confirmed email account that can sign in straight away.
create function pg_temp.test_user(p_email text, p_full_name text)
returns uuid
language plpgsql
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', p_email,
    extensions.crypt((select password from test_settings), extensions.gen_salt('bf')), now(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    jsonb_build_object('full_name', p_full_name), now(), now(),
    '', '', '', ''
  );
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (
    gen_random_uuid(), v_id, v_id::text,
    jsonb_build_object('sub', v_id::text, 'email', p_email, 'email_verified', true),
    'email', now(), now(), now()
  );
  return v_id;
end;
$$;

create function pg_temp.test_school(p_name text, p_type public.school_type, p_mode public.register_mode, p_phone text)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  insert into public.schools (name, code, type, register_mode, status, contact_phone, verified_at)
  values (p_name, private.generate_school_code(), p_type, p_mode, 'verified', p_phone, now())
  returning id into v_id;
  insert into public.school_settings (school_id, student_approval_required, student_self_signup)
  values (v_id, false, true);
  return v_id;
end;
$$;

create function pg_temp.test_staff(p_school uuid, p_user uuid, p_number text, p_name text, p_email text, p_role public.staff_role)
returns uuid
language sql
as $$
  insert into public.staff (school_id, user_id, school_number, full_name, email, role)
  values (p_school, p_user, p_number, p_name, p_email, p_role)
  returning id;
$$;

-- Adds your own account as an admin, if it exists.
create function pg_temp.add_me(p_school uuid, p_number text)
returns void
language plpgsql
as $$
declare
  v_me uuid := (select id from auth.users where lower(email) = lower((select my_email from test_settings)));
begin
  if v_me is null then
    raise notice 'Your account (%) was not found, so it was not added. Sign up first, or use the test admin accounts.',
      (select my_email from test_settings);
    return;
  end if;
  insert into public.staff (school_id, user_id, school_number, full_name, email, role)
  select p_school, v_me, p_number, coalesce(u.raw_user_meta_data ->> 'full_name', 'RollCol Owner'), u.email, 'admin'
  from auth.users u where u.id = v_me;
end;
$$;

-- A steady pseudo-random number from 0 to 99 for a student and day, so the
-- history looks real but is the same every time the script runs.
create function pg_temp.roll(p_key text)
returns integer
language sql
immutable
as $$
  select abs(hashtext(p_key)) % 100;
$$;

create temporary table test_names (n integer primary key, full_name text);
insert into test_names (n, full_name) values
  (1, 'Abena Mensah'), (2, 'Kwame Owusu'), (3, 'Efua Asante'), (4, 'Kofi Boateng'),
  (5, 'Ama Darko'), (6, 'Yaw Ofori'), (7, 'Akosua Appiah'), (8, 'Kwabena Osei'),
  (9, 'Adwoa Amoah'), (10, 'Kojo Antwi'), (11, 'Esi Quaye'), (12, 'Fiifi Annan'),
  (13, 'Naa Adjeley Tetteh'), (14, 'Nii Armah Lamptey'), (15, 'Dzifa Agbeko'), (16, 'Selorm Kpodo'),
  (17, 'Abdul-Rahman Iddrisu'), (18, 'Fuseina Alhassan'), (19, 'Mawuli Dogbe'), (20, 'Afia Sarpong'),
  (21, 'Kwesi Arthur'), (22, 'Akua Frimpong'), (23, 'Ekow Mensah'), (24, 'Yaa Asantewaa Boakye');

-- -----------------------------------------------------------------------------
-- Everything else
-- -----------------------------------------------------------------------------

do $$
declare
  v_today date := (now() at time zone 'Africa/Accra')::date;
  v_phone text := (select my_phone from test_settings);
  v_has_phone boolean := (select my_phone from test_settings) <> '+233240000000';

  v_basic uuid; v_shs uuid; v_uni uuid;
  v_term uuid; v_shs_term uuid; v_semester uuid;
  v_t1 uuid; v_t2 uuid; v_s1 uuid; v_s2 uuid; v_s3 uuid; v_l1 uuid; v_l2 uuid;
  v_b4 uuid; v_b5 uuid; v_f2s uuid; v_f2a uuid;
  v_guardian uuid;
  v_programme uuid; v_batch uuid;
  r record; d date; v_reg uuid; v_cs record;
begin
  -- Schools ------------------------------------------------------------------
  v_basic := pg_temp.test_school('Test: Adenta Basic School', 'non_tertiary', 'daily', '+233302000001');
  v_shs := pg_temp.test_school('Test: Labone SHS', 'non_tertiary', 'per_period', '+233302000002');
  v_uni := pg_temp.test_school('Test: Accra Nursing College', 'tertiary', null, '+233302000003');

  -- Basic school: an admin and two class teachers ------------------------------
  perform pg_temp.test_staff(v_basic, pg_temp.test_user('basic.admin@rollcol.test', 'Grace Adjei'), 'BA001', 'Grace Adjei', 'basic.admin@rollcol.test', 'admin');
  v_t1 := pg_temp.test_staff(v_basic, pg_temp.test_user('basic.teacher1@rollcol.test', 'Samuel Ankrah'), 'BT001', 'Samuel Ankrah', 'basic.teacher1@rollcol.test', 'teacher');
  v_t2 := pg_temp.test_staff(v_basic, pg_temp.test_user('basic.teacher2@rollcol.test', 'Comfort Badu'), 'BT002', 'Comfort Badu', 'basic.teacher2@rollcol.test', 'teacher');
  perform pg_temp.add_me(v_basic, 'OWNER1');

  insert into public.academic_periods (school_id, kind, name, starts_on, ends_on)
  values (v_basic, 'term', 'Term 1', v_today - 40, v_today + 50) returning id into v_term;
  -- Registers close late in the evening, so you can test before 10:00 passes.
  update public.school_settings set daily_register_closes_at = '20:00' where school_id = v_basic;

  insert into public.classes (school_id, name, class_teacher_id) values (v_basic, 'Basic 4', v_t1) returning id into v_b4;
  insert into public.classes (school_id, name, class_teacher_id) values (v_basic, 'Basic 5', v_t2) returning id into v_b5;

  insert into public.students (school_id, school_number, full_name, class_id)
  select v_basic, 'ADB4' || lpad(n::text, 3, '0'), full_name, v_b4 from test_names where n <= 12;
  insert into public.students (school_id, school_number, full_name, class_id)
  select v_basic, 'ADB5' || lpad(n::text, 3, '0'), full_name, v_b5 from test_names where n > 12;

  -- Guardians: only your own phone number, on three Basic 4 children.
  if v_has_phone then
    insert into public.guardians (school_id, full_name, phone) values (v_basic, 'Test Parent', v_phone) returning id into v_guardian;
    insert into public.guardian_links (school_id, guardian_id, student_id, relationship, receives_present_alerts)
    select v_basic, v_guardian, st.id, 'Parent', true
    from public.students st where st.class_id = v_b4 order by st.full_name limit 3;
    -- Test guardians should not get "you have been added" SMS. The events are
    -- written by a trigger that normally waits for the end of the transaction,
    -- so run it now, then mark them as already handled.
    set constraints all immediate;
    update public.guardian_events set processed_at = now() where school_id = v_basic and processed_at is null;
  end if;

  -- 50 SMS credits to try broadcasts and alerts (SMS stay in test mode until you set a provider).
  insert into public.sms_credit_entries (school_id, amount, reason) values (v_basic, 50, 'Test credits'), (v_shs, 50, 'Test credits');

  -- Two weeks of daily registers for both classes (weekdays before today).
  for d in select g::date from generate_series(v_today - 14, v_today - 1, interval '1 day') g
           where extract(isodow from g) < 6 loop
    for r in select c.id, c.class_teacher_id from public.classes c where c.school_id = v_basic loop
      insert into public.registers (school_id, class_id, register_date, academic_period_id, status, reward_marks,
                                    opened_by, opened_at, closes_at, submitted_by, submitted_at)
      values (v_basic, r.id, d, v_term, 'submitted', 1, r.class_teacher_id,
              (d + time '07:45') at time zone 'Africa/Accra', (d + time '10:00') at time zone 'Africa/Accra',
              r.class_teacher_id, (d + time '08:05') at time zone 'Africa/Accra')
      returning id into v_reg;
      insert into public.register_entries (register_id, student_id, school_id, mark, marked_by, marked_at)
      select v_reg, st.id, v_basic,
             case when pg_temp.roll(st.id::text || d::text) < 84 then 'present'
                  when pg_temp.roll(st.id::text || d::text) < 92 then 'late'
                  else 'absent' end::public.attendance_mark,
             r.class_teacher_id, (d + time '08:00') at time zone 'Africa/Accra'
      from public.students st where st.class_id = r.id;
    end loop;
  end loop;

  -- SHS: an admin, three subject teachers, two classes ---------------------------
  perform pg_temp.test_staff(v_shs, pg_temp.test_user('shs.admin@rollcol.test', 'Richard Asamoah'), 'LA001', 'Richard Asamoah', 'shs.admin@rollcol.test', 'admin');
  v_s1 := pg_temp.test_staff(v_shs, pg_temp.test_user('shs.teacher1@rollcol.test', 'Joyce Addo'), 'LT001', 'Joyce Addo', 'shs.teacher1@rollcol.test', 'teacher');
  v_s2 := pg_temp.test_staff(v_shs, pg_temp.test_user('shs.teacher2@rollcol.test', 'Emmanuel Nkrumah'), 'LT002', 'Emmanuel Nkrumah', 'shs.teacher2@rollcol.test', 'teacher');
  v_s3 := pg_temp.test_staff(v_shs, pg_temp.test_user('shs.teacher3@rollcol.test', 'Patience Owusu-Ansah'), 'LT003', 'Patience Owusu-Ansah', 'shs.teacher3@rollcol.test', 'teacher');
  perform pg_temp.add_me(v_shs, 'OWNER1');
  -- Basic teacher 1 also teaches at the SHS: two schools, one account.
  perform pg_temp.test_staff(v_shs, (select user_id from public.staff where id = v_t1), 'LT004', 'Samuel Ankrah', 'basic.teacher1@rollcol.test', 'teacher');

  insert into public.academic_periods (school_id, kind, name, starts_on, ends_on)
  values (v_shs, 'term', 'Term 1', v_today - 40, v_today + 50) returning id into v_shs_term;
  update public.school_settings set period_register_minutes = 120 where school_id = v_shs;

  insert into public.classes (school_id, name, class_teacher_id) values (v_shs, 'Form 2 Science', v_s1) returning id into v_f2s;
  insert into public.classes (school_id, name, class_teacher_id) values (v_shs, 'Form 2 Arts', v_s3) returning id into v_f2a;
  insert into public.subjects (school_id, name)
  values (v_shs, 'Core Mathematics'), (v_shs, 'English Language'), (v_shs, 'Physics'), (v_shs, 'Literature in English');

  insert into public.class_subjects (school_id, class_id, subject_id, teacher_id)
  select v_shs, v_f2s, s.id, case s.name when 'Core Mathematics' then v_s1 when 'English Language' then v_s3 else v_s2 end
  from public.subjects s where s.school_id = v_shs and s.name in ('Core Mathematics', 'English Language', 'Physics');
  insert into public.class_subjects (school_id, class_id, subject_id, teacher_id)
  select v_shs, v_f2a, s.id, case s.name when 'Core Mathematics' then v_s1 else v_s3 end
  from public.subjects s where s.school_id = v_shs and s.name in ('Core Mathematics', 'English Language', 'Literature in English');

  insert into public.students (school_id, school_number, full_name, class_id)
  select v_shs, 'LSS' || lpad(n::text, 4, '0'), full_name, case when n % 2 = 0 then v_f2s else v_f2a end
  from test_names;

  -- One week of period registers: periods 1 to 3 each weekday.
  for d in select g::date from generate_series(v_today - 7, v_today - 1, interval '1 day') g
           where extract(isodow from g) < 6 loop
    for v_cs in
      select cs.id, cs.class_id, cs.teacher_id,
             row_number() over (partition by cs.class_id order by cs.id)::smallint as period
      from public.class_subjects cs where cs.school_id = v_shs
    loop
      insert into public.registers (school_id, class_id, class_subject_id, period_number, register_date, academic_period_id,
                                    status, reward_marks, opened_by, opened_at, closes_at, closed_at)
      values (v_shs, v_cs.class_id, v_cs.id, v_cs.period, d, v_shs_term, 'closed', 0, v_cs.teacher_id,
              (d + time '08:00') at time zone 'Africa/Accra', (d + time '10:00') at time zone 'Africa/Accra',
              (d + time '10:00') at time zone 'Africa/Accra')
      returning id into v_reg;
      insert into public.register_entries (register_id, student_id, school_id, mark, marked_by, marked_at)
      select v_reg, st.id, v_shs,
             case when pg_temp.roll(st.id::text || v_reg::text) < 88 then 'present'
                  when pg_temp.roll(st.id::text || v_reg::text) < 94 then 'late'
                  else 'absent' end::public.attendance_mark,
             v_cs.teacher_id, (d + time '08:10') at time zone 'Africa/Accra'
      from public.students st where st.class_id = v_cs.class_id;
    end loop;
  end loop;

  -- Tertiary: an admin, two lecturers, students with accounts ---------------------
  perform pg_temp.test_staff(v_uni, pg_temp.test_user('uni.admin@rollcol.test', 'Dr. Felicia Mensah'), 'NA001', 'Dr. Felicia Mensah', 'uni.admin@rollcol.test', 'admin');
  v_l1 := pg_temp.test_staff(v_uni, pg_temp.test_user('uni.lecturer1@rollcol.test', 'Mr. Daniel Ocran'), 'NL001', 'Mr. Daniel Ocran', 'uni.lecturer1@rollcol.test', 'teacher');
  v_l2 := pg_temp.test_staff(v_uni, pg_temp.test_user('uni.lecturer2@rollcol.test', 'Mrs. Gifty Amponsah'), 'NL002', 'Mrs. Gifty Amponsah', 'uni.lecturer2@rollcol.test', 'teacher');
  perform pg_temp.add_me(v_uni, 'OWNER1');

  insert into public.academic_periods (school_id, kind, name, starts_on, ends_on)
  values (v_uni, 'semester', 'First semester', v_today - 40, v_today + 70) returning id into v_semester;
  insert into public.programmes (school_id, name, code) values (v_uni, 'Diploma in Registered General Nursing', 'RGN') returning id into v_programme;
  insert into public.batches (school_id, programme_id, name, entry_year) values (v_uni, v_programme, '2025 intake', 2025) returning id into v_batch;
  insert into public.courses (school_id, code, title)
  values (v_uni, 'NUR 101', 'Foundations of Nursing'), (v_uni, 'ANA 102', 'Anatomy and Physiology'), (v_uni, 'GSC 103', 'Communication Skills');
  insert into public.course_runs (school_id, course_id, academic_period_id)
  select v_uni, c.id, v_semester from public.courses c where c.school_id = v_uni;
  insert into public.course_run_staff (school_id, course_run_id, staff_id)
  select v_uni, cr.id, case c.code when 'NUR 101' then v_l1 when 'GSC 103' then v_l1 else v_l2 end
  from public.course_runs cr join public.courses c on c.id = cr.course_id where cr.school_id = v_uni;

  -- Six students with accounts (student1@rollcol.test ...), plus twelve records without.
  for r in select n, full_name from test_names where n <= 18 loop
    insert into public.students (school_id, user_id, school_number, full_name, programme_id, batch_id, status)
    values (
      v_uni,
      case when r.n <= 6 then pg_temp.test_user('student' || r.n || '@rollcol.test', r.full_name) end,
      'RGN25' || lpad(r.n::text, 3, '0'), r.full_name, v_programme, v_batch, 'active'
    );
  end loop;
  insert into public.enrolments (school_id, course_run_id, student_id)
  select v_uni, cr.id, st.id
  from public.course_runs cr cross join public.students st
  where cr.school_id = v_uni and st.school_id = v_uni;

  -- A venue (somewhere in Accra; change it to your own location on the Venues page to test check-in).
  insert into public.venues (school_id, name, location, radius_m, verified_at)
  values (v_uni, 'Main Lecture Hall', 'SRID=4326;POINT(-0.186964 5.650812)', 75, now());

  -- Past sessions: NUR 101 on the last five weekdays, with most students checked in.
  -- Marked as already notified, so loading test data sends no notifications.
  for d in select g::date from generate_series(v_today - 7, v_today - 1, interval '1 day') g
           where extract(isodow from g) < 6 loop
    insert into public.attendance_sessions
      (school_id, course_run_id, location, radius_m, venue_id, reward_marks, qr_required, starts_at, ends_at, started_by,
       notified_open_at, notified_soon_at, notified_closed_at)
    select v_uni, cr.id, v.location, v.radius_m, v.id, 1, true,
           (d + time '09:00') at time zone 'Africa/Accra', (d + time '09:30') at time zone 'Africa/Accra', v_l1,
           now(), now(), now()
    from public.course_runs cr join public.courses c on c.id = cr.course_id
    cross join public.venues v
    where cr.school_id = v_uni and c.code = 'NUR 101' and v.school_id = v_uni
    returning id into v_reg;
    insert into public.session_checkins (session_id, student_id, school_id, method, checked_in_at, distance_m, accuracy_m)
    select v_reg, st.id, v_uni, 'self', (d + time '09:05') at time zone 'Africa/Accra',
           round((pg_temp.roll(st.id::text || d::text) * 0.5)::numeric, 1), 12
    from public.students st
    where st.school_id = v_uni and pg_temp.roll(st.id::text || d::text) < 85;
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- What you can sign in with
-- -----------------------------------------------------------------------------

select s.name as school, s.code as school_code, st.school_number as school_id, st.full_name as name,
       case when st.role = 'admin' then 'Admin' when s.type = 'tertiary' then 'Lecturer' else 'Teacher' end as role,
       st.email,
       case when st.email like '%@rollcol.test' then (select password from test_settings) else 'your own password' end as password
from public.staff st join public.schools s on s.id = st.school_id
where s.name like 'Test: %'
union all
select s.name, s.code, st.school_number, st.full_name, 'Student (mobile app)', u.email, (select password from test_settings)
from public.students st join public.schools s on s.id = st.school_id join auth.users u on u.id = st.user_id
where s.name like 'Test: %'
order by 1, 5, 3;
