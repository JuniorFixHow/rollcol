-- Part 2: access rules.
-- Helper functions used by RLS policies, integrity triggers, the guardian audit
-- trail, grants and policies. Security is enforced here, not in the apps.
--
-- One account belongs to one school, as either a staff member or a student.

-- ---------------------------------------------------------------------------
-- Limits for schools the platform owner has not verified yet.
-- Keep in sync with UNVERIFIED_SCHOOL_LIMITS in packages/shared/src/constants.ts.
-- ---------------------------------------------------------------------------

create function private.unverified_limit(p_kind text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_kind when 'students' then 100 when 'staff' then 10 end;
$$;

-- ---------------------------------------------------------------------------
-- Membership helpers (security definer so policies can read membership
-- without recursing into the policies of the tables they read)
-- ---------------------------------------------------------------------------

create function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.platform_admins where user_id = (select auth.uid())
  );
$$;

-- The school of the signed-in user. Disabled members get null.
create function private.my_school_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select s.school_id from public.staff s
      where s.user_id = (select auth.uid()) and s.status = 'active'),
    (select st.school_id from public.students st
      where st.user_id = (select auth.uid()) and st.status <> 'disabled')
  );
$$;

create function private.my_staff_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.id from public.staff s
  where s.user_id = (select auth.uid()) and s.status = 'active';
$$;

-- Active students only: pending students cannot join courses or check in.
create function private.my_student_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select st.id from public.students st
  where st.user_id = (select auth.uid()) and st.status = 'active';
$$;

create function private.my_staff_school_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.school_id from public.staff s
  where s.user_id = (select auth.uid()) and s.status = 'active';
$$;

create function private.my_admin_school_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.school_id from public.staff s
  where s.user_id = (select auth.uid()) and s.status = 'active' and s.role = 'admin';
$$;

create function private.is_school_staff(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff s
    where s.user_id = (select auth.uid())
      and s.school_id = p_school_id
      and s.status = 'active'
  );
$$;

create function private.is_school_admin(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff s
    where s.user_id = (select auth.uid())
      and s.school_id = p_school_id
      and s.status = 'active'
      and s.role = 'admin'
  );
$$;

-- True when the signed-in teacher is the class teacher of the student's class,
-- or teaches a subject to that class.
create function private.teaches_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.students st
    join public.staff me
      on me.user_id = (select auth.uid())
     and me.school_id = st.school_id
     and me.status = 'active'
    where st.id = p_student_id
      and st.class_id is not null
      and (
        exists (select 1 from public.classes c
                where c.id = st.class_id and c.class_teacher_id = me.id)
        or exists (select 1 from public.class_subjects cs
                   where cs.class_id = st.class_id and cs.teacher_id = me.id)
      )
  );
$$;

create function private.has_guardian_delegation()
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
      and d.revoked_at is null
      and d.expires_at > now()
  );
$$;

create function private.can_manage_guardians_for_student(p_student_id uuid)
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
        or (private.has_guardian_delegation() and private.teaches_student(st.id))
      )
  );
$$;

create function private.can_view_guardian(p_guardian_id uuid)
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
        or exists (
          select 1 from public.guardian_links l
          where l.guardian_id = g.id and private.teaches_student(l.student_id)
        )
      )
  );
$$;

create function private.can_manage_guardian(p_guardian_id uuid)
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
          private.has_guardian_delegation()
          and exists (
            select 1 from public.guardian_links l
            where l.guardian_id = g.id and private.teaches_student(l.student_id)
          )
        )
      )
  );
$$;

create function private.lectures_run(p_course_run_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.course_run_staff crs
    where crs.course_run_id = p_course_run_id
      and crs.staff_id = private.my_staff_id()
  );
$$;

revoke all on all functions in schema private from public, anon;
grant usage on schema private to authenticated;
grant execute on function
  private.is_platform_admin(),
  private.my_school_id(),
  private.my_staff_id(),
  private.my_student_id(),
  private.my_staff_school_id(),
  private.my_admin_school_id(),
  private.is_school_staff(uuid),
  private.is_school_admin(uuid),
  private.teaches_student(uuid),
  private.has_guardian_delegation(),
  private.can_manage_guardians_for_student(uuid),
  private.can_view_guardian(uuid),
  private.can_manage_guardian(uuid),
  private.lectures_run(uuid)
to authenticated;

-- ---------------------------------------------------------------------------
-- Integrity triggers
-- ---------------------------------------------------------------------------

-- Rows of a table that only makes sense for one school type.
-- Usage: execute function private.require_school_type('tertiary')
create function private.require_school_type()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type public.school_type;
begin
  select type into v_type from public.schools where id = new.school_id;
  if v_type is distinct from tg_argv[0]::public.school_type then
    raise exception 'This is not available for this type of school.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger programmes_tertiary before insert or update on public.programmes
  for each row execute function private.require_school_type('tertiary');
create trigger batches_tertiary before insert or update on public.batches
  for each row execute function private.require_school_type('tertiary');
create trigger courses_tertiary before insert or update on public.courses
  for each row execute function private.require_school_type('tertiary');
create trigger course_runs_tertiary before insert or update on public.course_runs
  for each row execute function private.require_school_type('tertiary');
create trigger enrolments_tertiary before insert or update on public.enrolments
  for each row execute function private.require_school_type('tertiary');
create trigger classes_non_tertiary before insert or update on public.classes
  for each row execute function private.require_school_type('non_tertiary');
create trigger subjects_non_tertiary before insert or update on public.subjects
  for each row execute function private.require_school_type('non_tertiary');
create trigger class_subjects_non_tertiary before insert or update on public.class_subjects
  for each row execute function private.require_school_type('non_tertiary');
create trigger guardians_non_tertiary before insert or update on public.guardians
  for each row execute function private.require_school_type('non_tertiary');
create trigger guardian_delegations_non_tertiary before insert or update on public.guardian_delegations
  for each row execute function private.require_school_type('non_tertiary');

-- Terms belong to non-tertiary schools, semesters to tertiary schools.
create function private.check_period_kind()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type public.school_type;
begin
  select type into v_type from public.schools where id = new.school_id;
  if (v_type = 'tertiary') <> (new.kind = 'semester') then
    raise exception 'Use terms for basic and secondary schools, and semesters for tertiary schools.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger academic_periods_kind before insert or update on public.academic_periods
  for each row execute function private.check_period_kind();

-- School numbers are used to sign in, so they must be unique across staff and
-- student accounts in a school. One account belongs to one school, as staff or
-- as a student.
create function private.check_member_identity()
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
    if exists (select 1 from public.students where user_id = new.user_id) then
      raise exception 'This account already belongs to a school.' using errcode = '23505';
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
      if exists (select 1 from public.staff where user_id = new.user_id) then
        raise exception 'This account already belongs to a school.' using errcode = '23505';
      end if;
    end if;
  end if;
  return new;
end;
$$;

create trigger staff_identity before insert or update of school_number, user_id, school_id on public.staff
  for each row execute function private.check_member_identity();
create trigger students_identity before insert or update of school_number, user_id, school_id on public.students
  for each row execute function private.check_member_identity();

-- Unverified schools have limits; suspended schools cannot add anyone.
create function private.enforce_school_limits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.school_status;
  v_count integer;
begin
  select status into v_status from public.schools where id = new.school_id;
  if v_status = 'suspended' then
    raise exception 'This school is suspended. Contact RollCol support.' using errcode = 'P0001';
  end if;
  if v_status = 'unverified' then
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

create trigger staff_limits before insert on public.staff
  for each row execute function private.enforce_school_limits();
create trigger students_limits before insert on public.students
  for each row execute function private.enforce_school_limits();

-- A school always keeps at least one active admin while it has other staff.
create function private.protect_last_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role <> 'admin' or old.status <> 'active' then
    return coalesce(new, old);
  end if;
  if tg_op = 'UPDATE' and new.role = 'admin' and new.status = 'active' then
    return new;
  end if;
  -- The whole school is being deleted.
  if not exists (select 1 from public.schools where id = old.school_id) then
    return coalesce(new, old);
  end if;
  if exists (select 1 from public.staff
             where school_id = old.school_id and id <> old.id
               and role = 'admin' and status = 'active') then
    return coalesce(new, old);
  end if;
  -- The only staff member may leave: the school is then deleted (see below).
  if tg_op = 'DELETE' and not exists (
    select 1 from public.staff where school_id = old.school_id and id <> old.id
  ) then
    return old;
  end if;
  raise exception 'A school needs at least one admin. Make another staff member an admin first.'
    using errcode = 'P0001';
end;
$$;

create trigger staff_last_admin before update of role, status or delete on public.staff
  for each row execute function private.protect_last_admin();

-- When the last staff member deletes their account, the school and all its
-- records go with it.
create function private.delete_empty_school()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.staff where school_id = old.school_id) then
    delete from public.schools where id = old.school_id;
  end if;
  return old;
end;
$$;

create trigger staff_delete_empty_school after delete on public.staff
  for each row execute function private.delete_empty_school();

-- Students: fields must fit the school type, and approvals are stamped.
create function private.check_student()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type public.school_type;
begin
  select type into v_type from public.schools where id = new.school_id;

  if v_type = 'non_tertiary' then
    if new.user_id is not null then
      raise exception 'Students in basic and secondary schools do not have accounts.' using errcode = '23514';
    end if;
    if new.programme_id is not null or new.batch_id is not null then
      raise exception 'Programmes and batches are for tertiary schools.' using errcode = '23514';
    end if;
  else
    if new.class_id is not null then
      raise exception 'Classes are for basic and secondary schools.' using errcode = '23514';
    end if;
    if new.batch_id is not null and not exists (
      select 1 from public.batches b
      where b.id = new.batch_id and b.programme_id is not distinct from new.programme_id
    ) then
      raise exception 'That batch belongs to a different programme.' using errcode = '23514';
    end if;
  end if;

  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
    if new.status = 'active' and new.user_id is not null then
      new.approved_at := coalesce(new.approved_at, now());
    end if;
  elsif old.status = 'pending' and new.status = 'active' then
    new.approved_at := now();
    new.approved_by := auth.uid();
  end if;
  return new;
end;
$$;

create trigger students_check before insert or update on public.students
  for each row execute function private.check_student();

create function private.stamp_staff()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.created_by := coalesce(new.created_by, auth.uid());
  return new;
end;
$$;

create trigger staff_stamp before insert on public.staff
  for each row execute function private.stamp_staff();

-- Delegations record who granted them, and revocations use the database clock.
create function private.stamp_delegation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.granted_by := auth.uid();
    new.created_at := now();
    new.revoked_at := null;
    if new.expires_at <= now() then
      raise exception 'Choose an expiry date in the future.' using errcode = '23514';
    end if;
  elsif new.revoked_at is not null and old.revoked_at is null then
    new.revoked_at := now();
  elsif new.revoked_at is distinct from old.revoked_at then
    raise exception 'A stopped delegation cannot be restarted. Grant a new one.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger guardian_delegations_stamp before insert or update on public.guardian_delegations
  for each row execute function private.stamp_delegation();

-- ---------------------------------------------------------------------------
-- Guardian audit trail
-- ---------------------------------------------------------------------------

create function private.actor_is_delegate(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and not private.is_school_admin(p_school_id);
$$;

create function private.stamp_guardian_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
  end if;
  new.updated_by := auth.uid();
  return new;
end;
$$;

create trigger guardians_stamp before insert or update on public.guardians
  for each row execute function private.stamp_guardian_row();
create trigger guardian_links_stamp before insert or update on public.guardian_links
  for each row execute function private.stamp_guardian_row();

create function private.log_guardian_link_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link public.guardian_links;
  v_guardian public.guardians;
  v_student public.students;
  v_kind public.guardian_event_kind;
begin
  if tg_op = 'INSERT' then
    v_link := new; v_kind := 'guardian_added';
  elsif tg_op = 'DELETE' then
    v_link := old; v_kind := 'guardian_removed';
  elsif old.alerts_enabled is distinct from new.alerts_enabled then
    v_link := new;
    v_kind := case when new.alerts_enabled then 'alerts_on' else 'alerts_off' end;
  else
    return new;
  end if;

  select * into v_guardian from public.guardians where id = v_link.guardian_id;
  select * into v_student from public.students where id = v_link.student_id;
  -- During a cascade the parent is already gone; its own trigger logged the removal.
  if v_guardian.id is null or v_student.id is null then
    return coalesce(new, old);
  end if;

  insert into public.guardian_events
    (school_id, guardian_id, student_id, kind, phone, guardian_name, student_name,
     actor_user_id, via_delegation)
  values
    (v_link.school_id, v_guardian.id, v_student.id, v_kind, v_guardian.phone,
     v_guardian.full_name, v_student.full_name, auth.uid(),
     private.actor_is_delegate(v_link.school_id));

  return coalesce(new, old);
end;
$$;

create trigger guardian_links_events
  after insert or delete or update of alerts_enabled on public.guardian_links
  for each row execute function private.log_guardian_link_event();

-- Before a guardian or student is deleted, record a removal for each link,
-- because the cascaded link deletes can no longer see the parent row.
create function private.log_removals_before_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.guardian_events
    (school_id, guardian_id, student_id, kind, phone, guardian_name, student_name,
     actor_user_id, via_delegation)
  select l.school_id, null, null, 'guardian_removed', g.phone, g.full_name, st.full_name,
         auth.uid(), private.actor_is_delegate(l.school_id)
  from public.guardian_links l
  join public.guardians g on g.id = l.guardian_id
  join public.students st on st.id = l.student_id
  where (tg_table_name = 'guardians' and l.guardian_id = old.id)
     or (tg_table_name = 'students' and l.student_id = old.id);
  return old;
end;
$$;

create trigger guardians_log_removals before delete on public.guardians
  for each row execute function private.log_removals_before_delete();
create trigger students_log_removals before delete on public.students
  for each row execute function private.log_removals_before_delete();

create function private.log_guardian_phone_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.guardian_events
    (school_id, guardian_id, kind, phone, previous_phone, guardian_name,
     actor_user_id, via_delegation)
  values
    (new.school_id, new.id, 'phone_changed', new.phone, old.phone, new.full_name,
     auth.uid(), private.actor_is_delegate(new.school_id));
  return new;
end;
$$;

create trigger guardians_phone_change after update of phone on public.guardians
  for each row when (old.phone is distinct from new.phone)
  execute function private.log_guardian_phone_change();

-- ---------------------------------------------------------------------------
-- Grants
-- Tables are reachable only by signed-in users, and RLS decides which rows.
-- Inserts that need extra checks go through RPC functions instead.
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;

grant select on
  public.platform_admins,
  public.schools,
  public.school_settings,
  public.staff,
  public.academic_periods,
  public.programmes,
  public.batches,
  public.courses,
  public.course_runs,
  public.course_run_staff,
  public.classes,
  public.subjects,
  public.class_subjects,
  public.students,
  public.enrolments,
  public.guardians,
  public.guardian_links,
  public.guardian_delegations,
  public.guardian_events
to authenticated;

grant update (name, contact_phone, contact_email, register_mode) on public.schools to authenticated;
grant update (student_approval_required, student_self_signup) on public.school_settings to authenticated;
grant insert (school_id, user_id, school_number, full_name, email, role) on public.staff to authenticated;
grant update (school_number, full_name, role, status) on public.staff to authenticated;
grant delete on public.staff to authenticated;

grant insert, update, delete on
  public.academic_periods,
  public.programmes,
  public.batches,
  public.courses,
  public.course_runs,
  public.course_run_staff,
  public.classes,
  public.subjects,
  public.class_subjects,
  public.guardian_delegations
to authenticated;

grant insert (school_id, school_number, full_name, status, class_id, programme_id, batch_id)
  on public.students to authenticated;
grant update (school_number, full_name, status, class_id, programme_id, batch_id)
  on public.students to authenticated;
grant delete on public.students to authenticated;

grant update (status) on public.enrolments to authenticated;

grant update (full_name, phone, broadcasts_enabled) on public.guardians to authenticated;
grant delete on public.guardians to authenticated;
grant update (relationship, alerts_enabled, receives_present_alerts) on public.guardian_links to authenticated;
grant delete on public.guardian_links to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.platform_admins enable row level security;
alter table public.schools enable row level security;
alter table public.school_settings enable row level security;
alter table public.staff enable row level security;
alter table public.academic_periods enable row level security;
alter table public.programmes enable row level security;
alter table public.batches enable row level security;
alter table public.courses enable row level security;
alter table public.course_runs enable row level security;
alter table public.course_run_staff enable row level security;
alter table public.classes enable row level security;
alter table public.subjects enable row level security;
alter table public.class_subjects enable row level security;
alter table public.students enable row level security;
alter table public.enrolments enable row level security;
alter table public.guardians enable row level security;
alter table public.guardian_links enable row level security;
alter table public.guardian_delegations enable row level security;
alter table public.guardian_events enable row level security;

create policy "Platform admins see their own row" on public.platform_admins
  for select to authenticated using (user_id = (select auth.uid()));

-- Schools
create policy "Members and the platform owner see the school" on public.schools
  for select to authenticated
  using (id = (select private.my_school_id()) or (select private.is_platform_admin()));
create policy "Admins edit their school" on public.schools
  for update to authenticated
  using (id = (select private.my_admin_school_id())) with check (id = (select private.my_admin_school_id()));

create policy "Members see school settings" on public.school_settings
  for select to authenticated using (school_id = (select private.my_school_id()));
create policy "Admins edit school settings" on public.school_settings
  for update to authenticated
  using (school_id = (select private.my_admin_school_id())) with check (school_id = (select private.my_admin_school_id()));

-- Staff. Students cannot list staff (lecturer names reach them through RPCs).
create policy "Staff see colleagues; everyone sees themselves" on public.staff
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or school_id = (select private.my_staff_school_id())
    or (select private.is_platform_admin())
  );
create policy "Admins add staff" on public.staff
  for insert to authenticated with check (school_id = (select private.my_admin_school_id()));
create policy "Admins edit staff" on public.staff
  for update to authenticated
  using (school_id = (select private.my_admin_school_id())) with check (school_id = (select private.my_admin_school_id()));
create policy "Admins remove staff" on public.staff
  for delete to authenticated using (school_id = (select private.my_admin_school_id()));

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
         using (school_id = (select private.my_school_id()))', t);
    execute format(
      'create policy "Admins add %1$s" on public.%1$I for insert to authenticated
         with check (school_id = (select private.my_admin_school_id()) and source = ''rollcol'')', t);
    execute format(
      'create policy "Admins edit %1$s" on public.%1$I for update to authenticated
         using (school_id = (select private.my_admin_school_id()) and source = ''rollcol'')
         with check (school_id = (select private.my_admin_school_id()) and source = ''rollcol'')', t);
    execute format(
      'create policy "Admins remove %1$s" on public.%1$I for delete to authenticated
         using (school_id = (select private.my_admin_school_id()) and source = ''rollcol'')', t);
  end loop;

  foreach t in array array['course_run_staff', 'classes', 'subjects', 'class_subjects']
  loop
    execute format(
      'create policy "Members see %1$s" on public.%1$I for select to authenticated
         using (school_id = (select private.my_school_id()))', t);
    execute format(
      'create policy "Admins add %1$s" on public.%1$I for insert to authenticated
         with check (school_id = (select private.my_admin_school_id()))', t);
    execute format(
      'create policy "Admins edit %1$s" on public.%1$I for update to authenticated
         using (school_id = (select private.my_admin_school_id()))
         with check (school_id = (select private.my_admin_school_id()))', t);
    execute format(
      'create policy "Admins remove %1$s" on public.%1$I for delete to authenticated
         using (school_id = (select private.my_admin_school_id()))', t);
  end loop;
end;
$$;

-- Students
create policy "Staff see students; students see themselves" on public.students
  for select to authenticated
  using (user_id = (select auth.uid()) or school_id = (select private.my_staff_school_id()));
create policy "Admins add students" on public.students
  for insert to authenticated
  with check (school_id = (select private.my_admin_school_id()));
create policy "Admins edit students" on public.students
  for update to authenticated
  using (school_id = (select private.my_admin_school_id()) and source = 'rollcol')
  with check (school_id = (select private.my_admin_school_id()) and source = 'rollcol');
create policy "Admins remove students" on public.students
  for delete to authenticated
  using (school_id = (select private.my_admin_school_id()) and source = 'rollcol');

-- Enrolments: students join through join_course_run().
create policy "Staff see enrolments; students see their own" on public.enrolments
  for select to authenticated
  using (
    student_id = (select private.my_student_id())
    or school_id = (select private.my_staff_school_id())
  );
create policy "Admins and the run's lecturers update enrolments" on public.enrolments
  for update to authenticated
  using (
    source = 'rollcol'
    and (school_id = (select private.my_admin_school_id()) or private.lectures_run(course_run_id))
  )
  with check (
    source = 'rollcol'
    and (school_id = (select private.my_admin_school_id()) or private.lectures_run(course_run_id))
  );

-- Guardians: admins see all; teachers see the guardians of students they
-- teach. Guardians are added through add_guardian_to_student().
create policy "Admins and the student's teachers see guardians" on public.guardians
  for select to authenticated using (private.can_view_guardian(id));
create policy "Guardian managers edit guardians" on public.guardians
  for update to authenticated
  using (private.can_manage_guardian(id)) with check (private.can_manage_guardian(id));
create policy "Admins remove guardians" on public.guardians
  for delete to authenticated using (school_id = (select private.my_admin_school_id()));

create policy "Admins and the student's teachers see guardian links" on public.guardian_links
  for select to authenticated
  using (school_id = (select private.my_admin_school_id()) or private.teaches_student(student_id));
create policy "Guardian managers edit links" on public.guardian_links
  for update to authenticated
  using (private.can_manage_guardians_for_student(student_id))
  with check (private.can_manage_guardians_for_student(student_id));
create policy "Guardian managers remove links" on public.guardian_links
  for delete to authenticated using (private.can_manage_guardians_for_student(student_id));

create policy "Admins see delegations; teachers see their own" on public.guardian_delegations
  for select to authenticated
  using (school_id = (select private.my_admin_school_id()) or staff_id = (select private.my_staff_id()));
create policy "Admins grant delegations" on public.guardian_delegations
  for insert to authenticated with check (school_id = (select private.my_admin_school_id()));
create policy "Admins change delegations" on public.guardian_delegations
  for update to authenticated
  using (school_id = (select private.my_admin_school_id())) with check (school_id = (select private.my_admin_school_id()));
create policy "Admins remove delegations" on public.guardian_delegations
  for delete to authenticated using (school_id = (select private.my_admin_school_id()));

create policy "Admins see guardian changes" on public.guardian_events
  for select to authenticated using (school_id = (select private.my_admin_school_id()));
