-- Free plan student limits for verified schools.
--
--   * Basic and senior high schools: 100 students.
--   * Tertiary: 200 students.
--   * Workspaces: 50 students across all of one person's workspaces (Part 7).
--   * Unverified schools stay at 10 students and 10 staff until verified.
--
-- Disabled students do not count. The RollCol team can give one school a
-- different limit (schools.student_limit), for example a pilot; billing
-- (Part 8) sets it from the school's paid plan. The defaults can be changed with:
--   insert into private.config (key, value) values ('free_students_tertiary', '250')
--   on conflict (key) do update set value = excluded.value;

alter table public.schools add column student_limit integer check (student_limit is null or student_limit > 0);

create function private.free_student_limit(p_type public.school_type)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case p_type
    when 'tertiary' then coalesce((select value::integer from private.config where key = 'free_students_tertiary'), 200)
    else coalesce((select value::integer from private.config where key = 'free_students_non_tertiary'), 100)
  end;
$$;

-- The limit that applies to a school now (null for workspaces, which are
-- limited per owner instead).
create function private.school_student_limit(p_school_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when s.is_workspace then null
    when s.status = 'unverified' then private.unverified_limit('students')
    else coalesce(s.student_limit, private.free_student_limit(s.type))
  end
  from public.schools s where s.id = p_school_id;
$$;

create or replace function private.enforce_school_limits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_school public.schools;
  v_count integer;
  v_limit integer;
begin
  -- Re-enabling a disabled student counts as adding one; other changes do not.
  if tg_op = 'UPDATE' then
    if tg_table_name <> 'students' or old.status <> 'disabled' or new.status = 'disabled' then
      return new;
    end if;
  end if;

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

  if tg_table_name = 'staff' then
    if v_school.status = 'unverified' then
      select count(*) into v_count from public.staff where school_id = new.school_id;
      if v_count >= private.unverified_limit('staff') then
        raise exception 'Unverified schools can have up to % staff. RollCol will lift this limit when your school is verified.',
          private.unverified_limit('staff') using errcode = 'P0001';
      end if;
    end if;
    return new;
  end if;

  select count(*) into v_count from public.students where school_id = new.school_id and status <> 'disabled';
  v_limit := private.school_student_limit(v_school.id);
  if v_count >= v_limit then
    if v_school.status = 'unverified' then
      raise exception 'Unverified schools can have up to % students. RollCol will lift this limit when your school is verified.',
        v_limit using errcode = 'P0001';
    end if;
    raise exception 'This school can have up to % students on its current plan. Turn off students who have left, or contact RollCol to add more.',
      v_limit using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger students_limits_reenable before update of status on public.students
  for each row execute function private.enforce_school_limits();

-- Students counted against the limit, and the limit, for the school's staff.
create function public.school_student_usage(p_school_id uuid)
returns table (used integer, student_limit integer, plan text)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_school public.schools;
begin
  select * into v_school from public.schools where id = p_school_id;
  if v_school.id is null or not private.is_school_staff(p_school_id) then
    raise exception 'You cannot see this school.' using errcode = '42501';
  end if;
  return query select
    case when v_school.is_workspace then
      (select count(*)::integer from public.students st join public.schools s on s.id = st.school_id
       where s.is_workspace and s.created_by = v_school.created_by and st.status <> 'disabled')
    else
      (select count(*)::integer from public.students where school_id = p_school_id and status <> 'disabled')
    end,
    case when v_school.is_workspace then private.workspace_student_limit() else private.school_student_limit(p_school_id) end,
    case
      when v_school.is_workspace then 'workspace'
      when v_school.status = 'unverified' then 'unverified'
      when v_school.student_limit is not null then 'custom'
      else 'free'
    end;
end;
$$;

-- The RollCol team sets a school's own limit, or clears it (null) to use the free plan.
create function public.set_school_student_limit(p_school_id uuid, p_limit integer)
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
  if p_limit is not null and (p_limit < 1 or p_limit > 100000) then
    raise exception 'Enter a number of students from 1 to 100000.' using errcode = '22023';
  end if;
  if exists (select 1 from public.schools where id = p_school_id and is_workspace) then
    raise exception 'Workspace limits are set for their owner, not per workspace.' using errcode = 'P0001';
  end if;
  update public.schools set student_limit = p_limit where id = p_school_id;
end;
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
  is_workspace boolean,
  student_limit integer,
  custom_limit boolean
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
           s.is_workspace,
           case when s.is_workspace then private.workspace_student_limit() else private.school_student_limit(s.id) end,
           s.student_limit is not null
    from public.schools s
    order by s.is_workspace, (s.status = 'unverified') desc, s.created_at desc;
end;
$$;

revoke all on all functions in schema private from public, anon;
revoke all on function
  public.school_student_usage(uuid),
  public.set_school_student_limit(uuid, integer),
  public.platform_schools()
from public, anon;
grant execute on function
  public.school_student_usage(uuid),
  public.set_school_student_limit(uuid, integer),
  public.platform_schools()
to authenticated;
