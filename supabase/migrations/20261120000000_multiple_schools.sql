-- Part 2 patch: one account can belong to several schools.
--
-- A person can be staff at one school and a student at another, staff at two
-- schools, or a student at two schools. Within one school they have one role.
--
-- Access rules no longer ask "which school is mine?" but "is this one of my
-- schools?". The apps choose which school is on screen; the database allows
-- every school the person belongs to, with the right role in each.
--
-- Also fixed here: guardian delegation is now limited to the school that
-- granted it (before, a delegation in one school counted in every school).
-- Unverified schools now have the same student limit as Stediis (10).

-- ---------------------------------------------------------------------------
-- 1. Policies depend on the helpers being replaced, so drop them first.
--    Every policy is recreated below.
-- ---------------------------------------------------------------------------

do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname from pg_policies where schemaname = 'public'
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end;
$$;

drop function private.my_school_id();
drop function private.my_staff_id();
drop function private.my_student_id();
drop function private.my_staff_school_id();
drop function private.my_admin_school_id();
drop function private.has_guardian_delegation();
drop function public.current_member();
drop function public.account_deletion_effect();

-- ---------------------------------------------------------------------------
-- 2. Tables: unique per school instead of unique overall.
-- ---------------------------------------------------------------------------

alter table public.staff drop constraint staff_user_id_key;
alter table public.staff add constraint staff_school_user_unique unique (school_id, user_id);
create index staff_user_idx on public.staff (user_id);

alter table public.students drop constraint students_user_id_key;
alter table public.students add constraint students_school_user_unique unique (school_id, user_id);
create index students_user_idx on public.students (user_id) where user_id is not null;

-- ---------------------------------------------------------------------------
-- 3. Membership helpers
-- ---------------------------------------------------------------------------

create or replace function private.unverified_limit(p_kind text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_kind when 'students' then 10 when 'staff' then 10 end;
$$;

-- Schools where the signed-in person is active staff or a student who is not disabled.
create function private.my_school_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.school_id from public.staff s
  where s.user_id = (select auth.uid()) and s.status = 'active'
  union
  select st.school_id from public.students st
  where st.user_id = (select auth.uid()) and st.status <> 'disabled';
$$;

create function private.my_staff_school_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.school_id from public.staff s
  where s.user_id = (select auth.uid()) and s.status = 'active';
$$;

create function private.my_admin_school_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.school_id from public.staff s
  where s.user_id = (select auth.uid()) and s.status = 'active' and s.role = 'admin';
$$;

-- The signed-in person's active staff rows, in any school.
create function private.my_staff_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.id from public.staff s
  where s.user_id = (select auth.uid()) and s.status = 'active';
$$;

-- Active student rows only: pending students cannot join courses or check in.
create function private.my_student_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select st.id from public.students st
  where st.user_id = (select auth.uid()) and st.status = 'active';
$$;

-- A delegation counts only in the school that granted it.
create function private.has_guardian_delegation(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.guardian_delegations d
    join public.staff me on me.id = d.staff_id
    where me.user_id = (select auth.uid())
      and me.status = 'active'
      and me.school_id = p_school_id
      and d.school_id = p_school_id
      and d.revoked_at is null
      and d.expires_at > now()
  );
$$;

create or replace function private.can_manage_guardians_for_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.students st
    where st.id = p_student_id
      and (
        private.is_school_admin(st.school_id)
        or (private.has_guardian_delegation(st.school_id) and private.teaches_student(st.id))
      )
  );
$$;

create or replace function private.can_manage_guardian(p_guardian_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.guardians g
    where g.id = p_guardian_id
      and (
        private.is_school_admin(g.school_id)
        or (
          private.has_guardian_delegation(g.school_id)
          and exists (
            select 1 from public.guardian_links l
            where l.guardian_id = g.id and private.teaches_student(l.student_id)
          )
        )
      )
  );
$$;

create or replace function private.lectures_run(p_course_run_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.course_run_staff crs
    join public.staff me on me.id = crs.staff_id
    where crs.course_run_id = p_course_run_id
      and me.user_id = (select auth.uid())
      and me.status = 'active'
  );
$$;

revoke all on all functions in schema private from public, anon;
grant execute on function
  private.my_school_ids(),
  private.my_staff_school_ids(),
  private.my_admin_school_ids(),
  private.my_staff_ids(),
  private.my_student_ids(),
  private.has_guardian_delegation(uuid)
to authenticated;

-- ---------------------------------------------------------------------------
-- 4. One role per person within a school; school IDs stay unique across
--    staff and student accounts in a school.
-- ---------------------------------------------------------------------------

create or replace function private.check_member_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.school_number is not null then
    perform pg_advisory_xact_lock(hashtextextended(new.school_id::text || ':' || new.school_number, 0));
  end if;

  if tg_table_name = 'staff' then
    if exists (select 1 from public.students
               where school_id = new.school_id and school_number = new.school_number
                 and user_id is not null) then
      raise exception 'That school ID is already used by a student account.' using errcode = '23505';
    end if;
    if exists (select 1 from public.students
               where school_id = new.school_id and user_id = new.user_id) then
      raise exception 'This person is a student at this school, so they cannot also be staff here.'
        using errcode = '23505';
    end if;
  else
    if new.user_id is not null then
      if new.school_number is null then
        raise exception 'Student accounts need a school ID.' using errcode = '23514';
      end if;
      if exists (select 1 from public.staff
                 where school_id = new.school_id and school_number = new.school_number) then
        raise exception 'That school ID is already used by a staff account.' using errcode = '23505';
      end if;
      if exists (select 1 from public.staff
                 where school_id = new.school_id and user_id = new.user_id) then
        raise exception 'You are staff at this school, so you cannot also join it as a student.'
          using errcode = '23505';
      end if;
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Policies (same rules as before, now for every school the person is in)
-- ---------------------------------------------------------------------------

create policy "Platform admins see their own row" on public.platform_admins
  for select to authenticated using (user_id = (select auth.uid()));

-- Schools
create policy "Members and the platform owner see the school" on public.schools
  for select to authenticated
  using (id in (select private.my_school_ids()) or (select private.is_platform_admin()));
create policy "Admins edit their school" on public.schools
  for update to authenticated
  using (id in (select private.my_admin_school_ids()))
  with check (id in (select private.my_admin_school_ids()));

create policy "Members see school settings" on public.school_settings
  for select to authenticated using (school_id in (select private.my_school_ids()));
create policy "Admins edit school settings" on public.school_settings
  for update to authenticated
  using (school_id in (select private.my_admin_school_ids()))
  with check (school_id in (select private.my_admin_school_ids()));

-- Staff. Students cannot list staff (lecturer names reach them through RPCs).
create policy "Staff see colleagues; everyone sees themselves" on public.staff
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or school_id in (select private.my_staff_school_ids())
    or (select private.is_platform_admin())
  );
create policy "Admins add staff" on public.staff
  for insert to authenticated with check (school_id in (select private.my_admin_school_ids()));
create policy "Admins edit staff" on public.staff
  for update to authenticated
  using (school_id in (select private.my_admin_school_ids()))
  with check (school_id in (select private.my_admin_school_ids()));
create policy "Admins remove staff" on public.staff
  for delete to authenticated using (school_id in (select private.my_admin_school_ids()));

-- School structure: every member can read it; admins change records that
-- RollCol owns. Records synced from Stediis are read-only here.
do $$
declare
  t text;
begin
  foreach t in array array['academic_periods', 'programmes', 'batches', 'courses', 'course_runs']
  loop
    execute format(
      'create policy "Members see %1$s" on public.%1$I for select to authenticated
         using (school_id in (select private.my_school_ids()))', t);
    execute format(
      'create policy "Admins add %1$s" on public.%1$I for insert to authenticated
         with check (school_id in (select private.my_admin_school_ids()) and source = ''rollcol'')', t);
    execute format(
      'create policy "Admins edit %1$s" on public.%1$I for update to authenticated
         using (school_id in (select private.my_admin_school_ids()) and source = ''rollcol'')
         with check (school_id in (select private.my_admin_school_ids()) and source = ''rollcol'')', t);
    execute format(
      'create policy "Admins remove %1$s" on public.%1$I for delete to authenticated
         using (school_id in (select private.my_admin_school_ids()) and source = ''rollcol'')', t);
  end loop;

  foreach t in array array['course_run_staff', 'classes', 'subjects', 'class_subjects']
  loop
    execute format(
      'create policy "Members see %1$s" on public.%1$I for select to authenticated
         using (school_id in (select private.my_school_ids()))', t);
    execute format(
      'create policy "Admins add %1$s" on public.%1$I for insert to authenticated
         with check (school_id in (select private.my_admin_school_ids()))', t);
    execute format(
      'create policy "Admins edit %1$s" on public.%1$I for update to authenticated
         using (school_id in (select private.my_admin_school_ids()))
         with check (school_id in (select private.my_admin_school_ids()))', t);
    execute format(
      'create policy "Admins remove %1$s" on public.%1$I for delete to authenticated
         using (school_id in (select private.my_admin_school_ids()))', t);
  end loop;
end;
$$;

-- Students
create policy "Staff see students; students see themselves" on public.students
  for select to authenticated
  using (user_id = (select auth.uid()) or school_id in (select private.my_staff_school_ids()));
create policy "Admins add students" on public.students
  for insert to authenticated
  with check (school_id in (select private.my_admin_school_ids()));
create policy "Admins edit students" on public.students
  for update to authenticated
  using (school_id in (select private.my_admin_school_ids()) and source = 'rollcol')
  with check (school_id in (select private.my_admin_school_ids()) and source = 'rollcol');
create policy "Admins remove students" on public.students
  for delete to authenticated
  using (school_id in (select private.my_admin_school_ids()) and source = 'rollcol');

-- Enrolments: students join through join_course_run().
create policy "Staff see enrolments; students see their own" on public.enrolments
  for select to authenticated
  using (
    student_id in (select private.my_student_ids())
    or school_id in (select private.my_staff_school_ids())
  );
create policy "Admins and the run's lecturers update enrolments" on public.enrolments
  for update to authenticated
  using (
    source = 'rollcol'
    and (school_id in (select private.my_admin_school_ids()) or private.lectures_run(course_run_id))
  )
  with check (
    source = 'rollcol'
    and (school_id in (select private.my_admin_school_ids()) or private.lectures_run(course_run_id))
  );

-- Guardians: admins see all; teachers see the guardians of students they
-- teach. Guardians are added through add_guardian_to_student().
create policy "Admins and the student's teachers see guardians" on public.guardians
  for select to authenticated using (private.can_view_guardian(id));
create policy "Guardian managers edit guardians" on public.guardians
  for update to authenticated
  using (private.can_manage_guardian(id)) with check (private.can_manage_guardian(id));
create policy "Admins remove guardians" on public.guardians
  for delete to authenticated using (school_id in (select private.my_admin_school_ids()));

create policy "Admins and the student's teachers see guardian links" on public.guardian_links
  for select to authenticated
  using (school_id in (select private.my_admin_school_ids()) or private.teaches_student(student_id));
create policy "Guardian managers edit links" on public.guardian_links
  for update to authenticated
  using (private.can_manage_guardians_for_student(student_id))
  with check (private.can_manage_guardians_for_student(student_id));
create policy "Guardian managers remove links" on public.guardian_links
  for delete to authenticated using (private.can_manage_guardians_for_student(student_id));

create policy "Admins see delegations; teachers see their own" on public.guardian_delegations
  for select to authenticated
  using (
    school_id in (select private.my_admin_school_ids())
    or staff_id in (select private.my_staff_ids())
  );
create policy "Admins grant delegations" on public.guardian_delegations
  for insert to authenticated with check (school_id in (select private.my_admin_school_ids()));
create policy "Admins change delegations" on public.guardian_delegations
  for update to authenticated
  using (school_id in (select private.my_admin_school_ids()))
  with check (school_id in (select private.my_admin_school_ids()));
create policy "Admins remove delegations" on public.guardian_delegations
  for delete to authenticated using (school_id in (select private.my_admin_school_ids()));

create policy "Admins see guardian changes" on public.guardian_events
  for select to authenticated using (school_id in (select private.my_admin_school_ids()));

-- ---------------------------------------------------------------------------
-- 6. RPC functions
-- ---------------------------------------------------------------------------

-- Every school the signed-in person belongs to, one row each.
-- The apps pick which one is on screen.
create function public.my_memberships()
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
  school_status public.school_status
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.kind, m.id, m.status, m.role, m.full_name, m.school_number,
         sc.id, sc.name, sc.code, sc.type, sc.register_mode, sc.status
  from (
    select 'staff'::text as kind, s.id, s.status, s.role, s.full_name, s.school_number, s.school_id
    from public.staff s where s.user_id = (select auth.uid())
    union all
    select 'student', st.id, st.status, null, st.full_name, st.school_number, st.school_id
    from public.students st where st.user_id = (select auth.uid())
  ) as m
  join public.schools sc on sc.id = m.school_id
  order by sc.name;
$$;

create function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_platform_admin();
$$;

-- School sign-up. The caller becomes the school's first admin. People who
-- already belong to other schools can register another one.
create or replace function public.create_school(
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
  if (select count(*) from public.schools
      where created_by = v_user and status = 'unverified') >= 3 then
    raise exception 'You already have 3 schools waiting for verification. RollCol will verify them first.'
      using errcode = 'P0001';
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

-- Tertiary students join a school with its code and their school ID. They can
-- join more than one school, but each school only once.
create or replace function public.join_school_as_student(
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

  select * into v_school from public.schools where code = upper(trim(p_school_code));
  if v_school.id is null or v_school.status = 'suspended' then
    raise exception 'No school uses that code. Check it with your school.' using errcode = 'P0002';
  end if;
  if v_school.type <> 'tertiary' then
    raise exception 'Students at this school do not need accounts.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.staff where school_id = v_school.id and user_id = v_user) then
    raise exception 'You are staff at this school, so you cannot also join it as a student.'
      using errcode = '23505';
  end if;
  if exists (select 1 from public.students where school_id = v_school.id and user_id = v_user) then
    raise exception 'You have already joined this school.' using errcode = '23505';
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

-- A student joins a course run in the current or a coming semester, as a
-- student of the run's school.
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
  if v_run.id is null then
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

-- What deleting the signed-in account would do, school by school, so the apps
-- can warn first. Only schools that are affected are listed:
--   deletes_school   the only staff member: the school and all its records go too
--   last_admin       blocked until another staff member is made an admin
create function public.account_deletion_effects()
returns table (school_id uuid, school_name text, effect text)
language sql
stable
security definer
set search_path = ''
as $$
  select sc.id, sc.name,
         case
           when exists (select 1 from public.staff o
                        where o.school_id = me.school_id and o.id <> me.id) then 'last_admin'
           else 'deletes_school'
         end
  from public.staff me
  join public.schools sc on sc.id = me.school_id
  where me.user_id = (select auth.uid())
    and me.role = 'admin'
    and me.status = 'active'
    and not exists (select 1 from public.staff o
                    where o.school_id = me.school_id and o.id <> me.id
                      and o.role = 'admin' and o.status = 'active')
  order by sc.name;
$$;

-- Server-only helpers for the web app's service role (inviting someone who
-- already has an account, and removing staff without deleting accounts that
-- other schools still use). Never callable by signed-in users.
create function public.find_user_id_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from auth.users where lower(email) = lower(trim(p_email)) limit 1;
$$;

create function public.membership_count(p_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select ((select count(*) from public.staff where user_id = p_user_id)
        + (select count(*) from public.students where user_id = p_user_id))::integer;
$$;

revoke all on function
  public.my_memberships(),
  public.is_platform_admin(),
  public.create_school(text, public.school_type, text, text, text, public.register_mode),
  public.join_school_as_student(text, text, text),
  public.join_course_run(uuid),
  public.account_deletion_effects(),
  public.find_user_id_by_email(text),
  public.membership_count(uuid)
from public, anon, authenticated;

grant execute on function
  public.my_memberships(),
  public.is_platform_admin(),
  public.create_school(text, public.school_type, text, text, text, public.register_mode),
  public.join_school_as_student(text, text, text),
  public.join_course_run(uuid),
  public.account_deletion_effects()
to authenticated;

grant execute on function
  public.find_user_id_by_email(text),
  public.membership_count(uuid)
to service_role;
