-- Part 7: teacher and lecturer workspaces.
--
-- A workspace lets one teacher or lecturer use RollCol without a school, like
-- Google Classroom. It is a school row with is_workspace = true, so classes,
-- students, guardians, registers, courses, sessions and reports all work the
-- same way. The differences:
--   * one person only (the owner, as admin), no other staff;
--   * never verified, so no SMS (free workspaces send no attendance SMS);
--   * a free student limit counted across every workspace the owner has;
--   * the owner is made class teacher of every class and lecturer of every
--     course, so the teacher and lecturer screens in the app just work;
--   * the owner can delete it.

alter table public.schools add column is_workspace boolean not null default false;

-- The free limit, counted across all workspaces one person owns. Part 8
-- (billing) raises it for paid plans. Change it with:
--   insert into private.config (key, value) values ('workspace_free_students', '80')
--   on conflict (key) do update set value = excluded.value;
create function private.workspace_student_limit()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select value::integer from private.config where key = 'workspace_free_students'), 50);
$$;

create function private.workspace_owner(p_school_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select created_by from public.schools where id = p_school_id and is_workspace;
$$;

-- ---------------------------------------------------------------------------
-- Limits: unverified schools as before; workspaces their own rules.
-- ---------------------------------------------------------------------------

create or replace function private.enforce_school_limits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_school public.schools;
  v_count integer;
begin
  select * into v_school from public.schools where id = new.school_id;
  if v_school.status = 'suspended' then
    raise exception 'This school is suspended. Contact RollCol support.' using errcode = 'P0001';
  end if;

  if v_school.is_workspace then
    if tg_table_name = 'staff' then
      if exists (select 1 from public.staff where school_id = new.school_id) then
        raise exception 'A workspace is for one person. To work with colleagues, register a school.' using errcode = 'P0001';
      end if;
    else
      select count(*) into v_count
      from public.students st join public.schools s on s.id = st.school_id
      where s.is_workspace and s.created_by = v_school.created_by and st.status <> 'disabled';
      if v_count >= private.workspace_student_limit() then
        raise exception 'Free workspaces can have up to % students in all. Remove students you no longer teach to add others.',
          private.workspace_student_limit() using errcode = 'P0001';
      end if;
    end if;
    return new;
  end if;

  if v_school.status = 'unverified' then
    if tg_table_name = 'staff' then
      select count(*) into v_count from public.staff where school_id = new.school_id;
      if v_count >= private.unverified_limit('staff') then
        raise exception 'Unverified schools can have up to % staff. RollCol will lift this limit when your school is verified.',
          private.unverified_limit('staff') using errcode = 'P0001';
      end if;
    else
      select count(*) into v_count from public.students
      where school_id = new.school_id and status <> 'disabled';
      if v_count >= private.unverified_limit('students') then
        raise exception 'Unverified schools can have up to % students. RollCol will lift this limit when your school is verified.',
          private.unverified_limit('students') using errcode = 'P0001';
      end if;
    end if;
  end if;
  return new;
end;
$$;

-- Workspaces are never verified (verification is for schools, and turns on SMS).
create function private.workspace_not_verified()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_workspace and new.status = 'verified' then
    raise exception 'Workspaces are not verified. Only schools are.' using errcode = 'P0001';
  end if;
  if new.is_workspace is distinct from old.is_workspace then
    raise exception 'A school cannot become a workspace, or a workspace a school.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger workspace_not_verified before update on public.schools
  for each row execute function private.workspace_not_verified();

-- ---------------------------------------------------------------------------
-- The owner teaches everything in their workspace.
-- ---------------------------------------------------------------------------

create function private.workspace_class_teacher()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.schools where id = new.school_id and is_workspace) then
    new.class_teacher_id := (select id from public.staff where school_id = new.school_id order by created_at limit 1);
  end if;
  return new;
end;
$$;

create trigger workspace_class_teacher before insert or update of class_teacher_id on public.classes
  for each row execute function private.workspace_class_teacher();

create function private.workspace_course_lecturer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  if exists (select 1 from public.schools where id = new.school_id and is_workspace) then
    select id into v_owner from public.staff where school_id = new.school_id order by created_at limit 1;
    if v_owner is not null then
      insert into public.course_run_staff (course_run_id, staff_id, school_id)
      values (new.id, v_owner, new.school_id)
      on conflict do nothing;
    end if;
    -- Nothing to approve: the owner added it.
    if new.approved_at is null then
      update public.course_runs set approved_at = now() where id = new.id;
    end if;
  end if;
  return null;
end;
$$;

-- Deferred to the end of the transaction, so it never clashes with functions
-- that add the lecturer themselves (lecturer_add_course).
create constraint trigger workspace_course_lecturer after insert on public.course_runs
  deferrable initially deferred
  for each row execute function private.workspace_course_lecturer();

-- ---------------------------------------------------------------------------
-- Creating and deleting a workspace
-- ---------------------------------------------------------------------------

create function public.create_workspace(
  p_name text,
  p_type public.school_type,
  p_contact_phone text,
  p_full_name text,
  p_register_mode public.register_mode default null
)
returns table (school_id uuid, school_code text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user uuid := auth.uid();
  v_email text;
  v_school public.schools;
begin
  if v_user is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if (select count(*) from public.schools where created_by = v_user and is_workspace) >= 5 then
    raise exception 'You already have 5 workspaces. Delete one you no longer use first.' using errcode = 'P0001';
  end if;

  select email into v_email from auth.users where id = v_user;

  insert into public.schools (name, code, type, register_mode, contact_phone, contact_email, created_by, is_workspace)
  values (
    trim(p_name),
    private.generate_school_code(),
    p_type,
    case when p_type = 'tertiary' then null else coalesce(p_register_mode, 'daily') end,
    p_contact_phone,
    v_email,
    v_user,
    true
  )
  returning * into v_school;

  -- Students join a lecturer's workspace with its code and their student ID, without approval.
  insert into public.school_settings (school_id, student_self_signup, student_approval_required, course_approval_required)
  values (v_school.id, true, false, false);

  insert into public.staff (school_id, user_id, school_number, full_name, email, role)
  values (v_school.id, v_user, 'OWNER', trim(p_full_name), v_email, 'admin');

  return query select v_school.id, v_school.code;
end;
$$;

-- Deletes the workspace and everything in it (classes, students, registers,
-- courses, sessions). Only its owner can, and only a workspace.
create function public.delete_workspace(p_school_id uuid, p_confirm_name text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_school public.schools;
begin
  select * into v_school from public.schools where id = p_school_id;
  if v_school.id is null or not v_school.is_workspace or v_school.created_by is distinct from auth.uid() then
    raise exception 'Only the owner can delete this workspace.' using errcode = '42501';
  end if;
  if lower(btrim(coalesce(p_confirm_name, ''))) <> lower(v_school.name) then
    raise exception 'Type the workspace name exactly to delete it.' using errcode = '22023';
  end if;
  delete from public.schools where id = v_school.id;
end;
$$;

-- Schools waiting for verification are limited to 3 per person; workspaces
-- (never verified) do not count.
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
      where created_by = v_user and status = 'unverified' and not is_workspace) >= 3 then
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

-- ---------------------------------------------------------------------------
-- The apps need to know which memberships are workspaces.
-- ---------------------------------------------------------------------------

drop function public.my_memberships();

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
  school_status public.school_status,
  is_workspace boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.kind, m.id, m.status, m.role, m.full_name, m.school_number,
         sc.id, sc.name, sc.code, sc.type, sc.register_mode, sc.status, sc.is_workspace
  from (
    select 'staff'::text as kind, s.id, s.status, s.role, s.full_name, s.school_number, s.school_id
    from public.staff s where s.user_id = (select auth.uid())
    union all
    select 'student', st.id, st.status, null, st.full_name, st.school_number, st.school_id
    from public.students st where st.user_id = (select auth.uid())
  ) as m
  join public.schools sc on sc.id = m.school_id
  order by sc.is_workspace, sc.name;
$$;

drop function public.platform_schools();

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
  staff_count bigint,
  sms_credits integer,
  sms_sent_30_days bigint,
  is_workspace boolean
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
           (select count(*) from public.staff sf where sf.school_id = s.id),
           private.sms_balance(s.id),
           (select count(*) from public.sms_outbox o
            where o.school_id = s.id and o.status = 'sent' and o.sent_at > now() - interval '30 days'),
           s.is_workspace
    from public.schools s
    order by s.is_workspace, (s.status = 'unverified') desc, s.created_at desc;
end;
$$;

revoke all on all functions in schema private from public, anon;
revoke all on function
  public.create_workspace(text, public.school_type, text, text, public.register_mode),
  public.delete_workspace(uuid, text),
  public.my_memberships(),
  public.platform_schools()
from public, anon;
grant execute on function
  public.create_workspace(text, public.school_type, text, text, public.register_mode),
  public.delete_workspace(uuid, text),
  public.my_memberships(),
  public.platform_schools()
to authenticated;
