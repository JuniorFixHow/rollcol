-- Part 2: RPC functions called by the web and mobile apps.
-- Each one checks its caller itself; none trusts the app.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Six characters, without look-alikes (0/O, 1/I).
create function private.generate_school_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea;
  v_code text;
begin
  loop
    v_bytes := extensions.gen_random_bytes(6);
    v_code := '';
    for i in 0..5 loop
      v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % 32) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.schools where code = v_code);
  end loop;
  return v_code;
end;
$$;

create function private.normalise_school_number(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(upper(regexp_replace(coalesce(p_value, ''), '\s', '', 'g')), '');
$$;

-- ---------------------------------------------------------------------------
-- Who am I? One call that both apps use after sign-in.
-- ---------------------------------------------------------------------------

create function public.current_member()
returns table (
  kind text,
  member_id uuid,
  status public.member_status,
  role public.staff_role,
  full_name text,
  school_number text,
  school_id uuid,
  school_name text,
  school_code text,
  school_type public.school_type,
  register_mode public.register_mode,
  school_status public.school_status,
  is_platform_admin boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select 'staff'::text as kind, s.id, s.status, s.role, s.full_name, s.school_number, s.school_id
    from public.staff s where s.user_id = (select auth.uid())
    union all
    select 'student', st.id, st.status, null, st.full_name, st.school_number, st.school_id
    from public.students st where st.user_id = (select auth.uid())
  )
  select me.kind, me.id, me.status, me.role, me.full_name, me.school_number,
         sc.id, sc.name, sc.code, sc.type, sc.register_mode, sc.status,
         private.is_platform_admin()
  from (select 1) as one
  left join me on true
  left join public.schools sc on sc.id = me.school_id
  where (select auth.uid()) is not null;
$$;

-- ---------------------------------------------------------------------------
-- Public lookup of a school by its code (sign-in and student sign-up screens).
-- ---------------------------------------------------------------------------

create function public.school_by_code(p_code text)
returns table (name text, type public.school_type, accepts_students boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select s.name, s.type,
         s.type = 'tertiary' and s.status <> 'suspended' and coalesce(ss.student_self_signup, false)
  from public.schools s
  left join public.school_settings ss on ss.school_id = s.id
  where s.code = upper(trim(p_code)) and s.status <> 'suspended';
$$;

-- ---------------------------------------------------------------------------
-- School sign-up. The caller becomes the school's first admin.
-- ---------------------------------------------------------------------------

create function public.create_school(
  p_name text,
  p_type public.school_type,
  p_contact_phone text,
  p_admin_full_name text,
  p_admin_school_number text,
  p_register_mode public.register_mode default null
)
returns table (school_id uuid, school_code text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_email text;
  v_school public.schools;
begin
  if v_user is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if exists (select 1 from public.staff where user_id = v_user)
     or exists (select 1 from public.students where user_id = v_user) then
    raise exception 'This account already belongs to a school.' using errcode = '23505';
  end if;

  select email into v_email from auth.users where id = v_user;

  insert into public.schools (name, code, type, register_mode, contact_phone, contact_email, created_by)
  values (
    trim(p_name),
    private.generate_school_code(),
    p_type,
    case when p_type = 'tertiary' then null else p_register_mode end,
    p_contact_phone,
    v_email,
    v_user
  )
  returning * into v_school;

  insert into public.school_settings (school_id) values (v_school.id);

  insert into public.staff (school_id, user_id, school_number, full_name, email, role)
  values (
    v_school.id,
    v_user,
    private.normalise_school_number(p_admin_school_number),
    trim(p_admin_full_name),
    v_email,
    'admin'
  );

  return query select v_school.id, v_school.code;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tertiary students join their school with its code and their school ID.
-- An unclaimed record with the same school ID (added by an admin or synced)
-- is claimed instead of creating a duplicate.
-- ---------------------------------------------------------------------------

create function public.join_school_as_student(
  p_school_code text,
  p_school_number text,
  p_full_name text
)
returns public.member_status
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_school public.schools;
  v_settings public.school_settings;
  v_number text := private.normalise_school_number(p_school_number);
  v_status public.member_status;
  v_existing public.students;
begin
  if v_user is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if exists (select 1 from public.staff where user_id = v_user)
     or exists (select 1 from public.students where user_id = v_user) then
    raise exception 'This account already belongs to a school.' using errcode = '23505';
  end if;

  select * into v_school from public.schools where code = upper(trim(p_school_code));
  if v_school.id is null or v_school.status = 'suspended' then
    raise exception 'No school uses that code. Check it with your school.' using errcode = 'P0002';
  end if;
  if v_school.type <> 'tertiary' then
    raise exception 'Students at this school do not need accounts.' using errcode = 'P0001';
  end if;

  select * into v_settings from public.school_settings where school_id = v_school.id;
  if not coalesce(v_settings.student_self_signup, false) then
    raise exception 'This school does not let students create their own accounts. Ask your school.'
      using errcode = 'P0001';
  end if;

  v_status := case when v_settings.student_approval_required then 'pending' else 'active' end;

  select * into v_existing from public.students
  where school_id = v_school.id and school_number = v_number
  for update;

  if v_existing.id is not null then
    if v_existing.user_id is not null then
      raise exception 'That school ID already has an account. If it is yours, sign in instead.'
        using errcode = '23505';
    end if;
    update public.students
    set user_id = v_user,
        status = case when v_existing.status = 'disabled' then 'disabled' else v_status end
    where id = v_existing.id
    returning status into v_status;
    return v_status;
  end if;

  insert into public.students (school_id, user_id, school_number, full_name, status)
  values (v_school.id, v_user, v_number, trim(p_full_name), v_status);

  return v_status;
end;
$$;

-- ---------------------------------------------------------------------------
-- Sign in with school code + school ID.
--
-- Returns the account's email only to a caller who already knows the
-- password, so the client can then sign in with Supabase Auth from its own
-- IP address (keeping Supabase's own rate limits). Emails are never revealed
-- to anyone who only knows a school ID. Repeated failures lock the school ID
-- for 15 minutes.
-- ---------------------------------------------------------------------------

create function public.sign_in_email(
  p_school_code text,
  p_school_number text,
  p_password text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_school_id uuid;
  v_number text := private.normalise_school_number(p_school_number);
  v_user uuid;
  v_email text;
  v_hash text;
  v_failures integer;
begin
  if p_password is null or char_length(p_password) = 0 or char_length(p_password) > 200 then
    return jsonb_build_object('status', 'invalid');
  end if;

  select id into v_school_id from public.schools
  where code = upper(trim(coalesce(p_school_code, ''))) and status <> 'suspended';

  if v_school_id is not null then
    select count(*) into v_failures from private.sign_in_failures
    where school_id = v_school_id and school_number = v_number
      and failed_at > now() - interval '15 minutes';
    if v_failures >= 10 then
      return jsonb_build_object('status', 'locked');
    end if;

    select user_id into v_user from public.staff
    where school_id = v_school_id and school_number = v_number;
    if v_user is null then
      select user_id into v_user from public.students
      where school_id = v_school_id and school_number = v_number and user_id is not null;
    end if;
  end if;

  if v_user is not null then
    select u.email, u.encrypted_password into v_email, v_hash
    from auth.users u where u.id = v_user;
  end if;

  if v_hash is null or v_hash = '' then
    -- Same work as a real check, so timing does not reveal whether the ID exists.
    perform extensions.crypt(p_password, extensions.gen_salt('bf', 10));
  elsif extensions.crypt(p_password, v_hash) = v_hash then
    delete from private.sign_in_failures
    where school_id = v_school_id and school_number = v_number;
    return jsonb_build_object('status', 'ok', 'email', v_email);
  end if;

  if v_school_id is not null and v_number is not null then
    insert into private.sign_in_failures (school_id, school_number) values (v_school_id, v_number);
  end if;
  return jsonb_build_object('status', 'invalid');
end;
$$;

-- ---------------------------------------------------------------------------
-- Platform owner: verify or suspend a school.
-- ---------------------------------------------------------------------------

create function public.set_school_status(p_school_id uuid, p_status public.school_status)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not private.is_platform_admin() then
    raise exception 'Only the RollCol team can do this.' using errcode = '42501';
  end if;

  update public.schools
  set status = p_status,
      verified_at = case when p_status = 'verified' then coalesce(verified_at, now()) else verified_at end,
      verified_by = case when p_status = 'verified' then coalesce(verified_by, auth.uid()) else verified_by end
  where id = p_school_id;

  if not found then
    raise exception 'School not found.' using errcode = 'P0002';
  end if;
end;
$$;

-- Platform owner's list of schools with head counts (no student details).
create function public.platform_schools()
returns table (
  id uuid,
  name text,
  code text,
  type public.school_type,
  status public.school_status,
  contact_phone text,
  contact_email text,
  created_at timestamptz,
  verified_at timestamptz,
  student_count bigint,
  staff_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_platform_admin() then
    raise exception 'Only the RollCol team can do this.' using errcode = '42501';
  end if;
  return query
    select s.id, s.name, s.code, s.type, s.status, s.contact_phone, s.contact_email,
           s.created_at, s.verified_at,
           (select count(*) from public.students st where st.school_id = s.id and st.status <> 'disabled'),
           (select count(*) from public.staff sf where sf.school_id = s.id)
    from public.schools s
    order by (s.status = 'unverified') desc, s.created_at desc;
end;
$$;

-- ---------------------------------------------------------------------------
-- Guardians: add a guardian to a student, reusing the school's existing
-- guardian with the same phone number.
-- ---------------------------------------------------------------------------

create function public.add_guardian_to_student(
  p_student_id uuid,
  p_full_name text,
  p_phone text,
  p_relationship text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_student public.students;
  v_guardian_id uuid;
  v_link_id uuid;
begin
  if not private.can_manage_guardians_for_student(p_student_id) then
    raise exception 'You cannot manage guardians for this student.' using errcode = '42501';
  end if;

  select * into v_student from public.students where id = p_student_id;

  insert into public.guardians (school_id, full_name, phone)
  values (v_student.school_id, trim(p_full_name), p_phone)
  on conflict (school_id, phone) do nothing
  returning id into v_guardian_id;

  if v_guardian_id is null then
    select id into v_guardian_id from public.guardians
    where school_id = v_student.school_id and phone = p_phone;
  end if;

  insert into public.guardian_links (school_id, guardian_id, student_id, relationship)
  values (v_student.school_id, v_guardian_id, p_student_id, nullif(trim(p_relationship), ''))
  on conflict (guardian_id, student_id) do nothing
  returning id into v_link_id;

  if v_link_id is null then
    raise exception 'This guardian is already linked to this student.' using errcode = '23505';
  end if;

  return v_link_id;
end;
$$;

-- Choose the one guardian who gets daily present alerts (Complete plan).
create function public.set_present_alert_guardian(p_student_id uuid, p_link_id uuid default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not private.can_manage_guardians_for_student(p_student_id) then
    raise exception 'You cannot manage guardians for this student.' using errcode = '42501';
  end if;
  update public.guardian_links set receives_present_alerts = false
  where student_id = p_student_id and receives_present_alerts and id is distinct from p_link_id;
  if p_link_id is not null then
    update public.guardian_links set receives_present_alerts = true
    where id = p_link_id and student_id = p_student_id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tertiary: a student joins a course run in the current or a coming semester.
-- ---------------------------------------------------------------------------

create function public.join_course_run(p_course_run_id uuid)
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
  select * into v_student from public.students
  where user_id = auth.uid() and status = 'active';
  if v_student.id is null then
    raise exception 'Your account is not active yet.' using errcode = '42501';
  end if;

  select * into v_run from public.course_runs
  where id = p_course_run_id and school_id = v_student.school_id;
  if v_run.id is null then
    raise exception 'Course not found.' using errcode = 'P0002';
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
-- What deleting the signed-in account would do, so the apps can warn first.
--   ok               only this account's RollCol data is deleted
--   deletes_school   the only staff member: the school and all its records go too
--   last_admin       blocked until another staff member is made an admin
-- ---------------------------------------------------------------------------

create function public.account_deletion_effect()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when me.id is null or me.role <> 'admin' or me.status <> 'active' then 'ok'
    when exists (select 1 from public.staff o
                 where o.school_id = me.school_id and o.id <> me.id
                   and o.role = 'admin' and o.status = 'active') then 'ok'
    when exists (select 1 from public.staff o
                 where o.school_id = me.school_id and o.id <> me.id) then 'last_admin'
    else 'deletes_school'
  end
  from (select 1) as one
  left join public.staff me on me.user_id = (select auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on function
  public.account_deletion_effect(),
  public.current_member(),
  public.school_by_code(text),
  public.create_school(text, public.school_type, text, text, text, public.register_mode),
  public.join_school_as_student(text, text, text),
  public.sign_in_email(text, text, text),
  public.set_school_status(uuid, public.school_status),
  public.platform_schools(),
  public.add_guardian_to_student(uuid, text, text, text),
  public.set_present_alert_guardian(uuid, uuid),
  public.join_course_run(uuid)
from public, anon, authenticated;

grant execute on function public.school_by_code(text) to anon, authenticated;
grant execute on function public.sign_in_email(text, text, text) to anon, authenticated;
grant execute on function
  public.account_deletion_effect(),
  public.current_member(),
  public.create_school(text, public.school_type, text, text, text, public.register_mode),
  public.join_school_as_student(text, text, text),
  public.set_school_status(uuid, public.school_status),
  public.platform_schools(),
  public.add_guardian_to_student(uuid, text, text, text),
  public.set_present_alert_guardian(uuid, uuid),
  public.join_course_run(uuid)
to authenticated;

-- ---------------------------------------------------------------------------
-- Housekeeping
-- ---------------------------------------------------------------------------

select cron.schedule(
  'purge-sign-in-failures',
  '17 3 * * *',
  $$delete from private.sign_in_failures where failed_at < now() - interval '1 day'$$
);
