-- Part 3: registers for basic and senior high schools.
--
-- Daily registers: the class teacher marks each child once a day.
-- Per-period registers: a subject teacher marks their period (SHS).
-- The school's register mode decides which one its teachers take.
--
-- Marks are present, late or absent. A child with no mark is "not marked" and
-- is never treated as absent. A register is open until the teacher submits it
-- or it closes on its own; teachers can still correct marks for the rest of the
-- day (for example absent to late), and admins at any time.
--
-- Writes go through RPC functions only (they check permissions and the edit
-- window). The SMS alerts that follow a closed register come in Part 4.

create type public.register_status as enum ('open', 'submitted', 'closed');
create type public.attendance_mark as enum ('present', 'late', 'absent');

-- ---------------------------------------------------------------------------
-- Settings: when registers close on their own
-- ---------------------------------------------------------------------------

alter table public.school_settings
  add column daily_register_closes_at time not null default '10:00',
  add column period_register_minutes smallint not null default 60
    check (period_register_minutes between 10 and 240);

grant update (daily_register_closes_at, period_register_minutes) on public.school_settings to authenticated;

-- Lets registers reference a class subject together with its school.
alter table public.class_subjects add constraint class_subjects_id_school unique (id, school_id);

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.registers (
  -- Apps may create the id themselves, so a register can be started offline.
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  class_id uuid not null,
  -- Set for per-period registers only.
  class_subject_id uuid,
  period_number smallint check (period_number between 1 and 12),
  register_date date not null,
  -- The term the date falls in, for totals per term. Null if no term covers it.
  academic_period_id uuid,
  status public.register_status not null default 'open',
  -- Optional marks every child marked present or late earns.
  reward_marks numeric(5, 2) not null default 0 check (reward_marks between 0 and 100),
  opened_by uuid,
  opened_at timestamptz not null default now(),
  closes_at timestamptz not null,
  submitted_by uuid,
  submitted_at timestamptz,
  closed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint registers_kind check ((class_subject_id is null) = (period_number is null)),
  constraint registers_id_school unique (id, school_id),
  foreign key (class_id, school_id) references public.classes (id, school_id) on delete cascade,
  foreign key (class_subject_id, school_id) references public.class_subjects (id, school_id) on delete cascade,
  foreign key (academic_period_id, school_id)
    references public.academic_periods (id, school_id) on delete set null (academic_period_id),
  foreign key (opened_by, school_id) references public.staff (id, school_id) on delete set null (opened_by),
  foreign key (submitted_by, school_id) references public.staff (id, school_id) on delete set null (submitted_by)
);

-- One daily register per class per day; one register per class, day and period.
create unique index registers_daily_unique on public.registers (class_id, register_date)
  where class_subject_id is null;
create unique index registers_period_unique on public.registers (class_id, register_date, period_number)
  where class_subject_id is not null;
create index registers_school_date_idx on public.registers (school_id, register_date);
create index registers_open_idx on public.registers (closes_at) where status = 'open';
create index registers_term_idx on public.registers (academic_period_id);

create trigger registers_touch before update on public.registers
  for each row execute function private.touch_updated_at();
create trigger registers_non_tertiary before insert or update on public.registers
  for each row execute function private.require_school_type('non_tertiary');

create table public.register_entries (
  register_id uuid not null,
  student_id uuid not null,
  school_id uuid not null references public.schools (id) on delete cascade,
  mark public.attendance_mark not null,
  marked_by uuid,
  marked_at timestamptz not null default now(),
  primary key (register_id, student_id),
  foreign key (register_id, school_id) references public.registers (id, school_id) on delete cascade,
  foreign key (student_id, school_id) references public.students (id, school_id) on delete cascade,
  foreign key (marked_by, school_id) references public.staff (id, school_id) on delete set null (marked_by)
);

create index register_entries_student_idx on public.register_entries (student_id);

-- ---------------------------------------------------------------------------
-- Who can take and see registers
-- ---------------------------------------------------------------------------

-- The signed-in person's active staff row in a school.
create function private.my_staff_id_in(p_school_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.id from public.staff s
  where s.user_id = (select auth.uid()) and s.school_id = p_school_id and s.status = 'active';
$$;

-- Class teacher, or teaches any subject to the class.
create function private.teaches_class(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.classes c
    join public.staff me
      on me.user_id = (select auth.uid()) and me.school_id = c.school_id and me.status = 'active'
    where c.id = p_class_id
      and (
        c.class_teacher_id = me.id
        or exists (select 1 from public.class_subjects cs where cs.class_id = c.id and cs.teacher_id = me.id)
      )
  );
$$;

-- Daily register: the class teacher. Per-period register: the subject's teacher,
-- or the class teacher covering. Admins can take any register.
create function private.can_take_register(p_class_id uuid, p_class_subject_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.classes c
    join public.staff me
      on me.user_id = (select auth.uid()) and me.school_id = c.school_id and me.status = 'active'
    where c.id = p_class_id
      and (
        me.role = 'admin'
        or c.class_teacher_id = me.id
        or (
          p_class_subject_id is not null
          and exists (select 1 from public.class_subjects cs
                      where cs.id = p_class_subject_id and cs.class_id = c.id and cs.teacher_id = me.id)
        )
      )
  );
$$;

create function private.can_view_register(p_register_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.registers r
    where r.id = p_register_id
      and (private.is_school_admin(r.school_id) or private.teaches_class(r.class_id))
  );
$$;

revoke all on function
  private.my_staff_id_in(uuid),
  private.teaches_class(uuid),
  private.can_take_register(uuid, uuid),
  private.can_view_register(uuid)
from public, anon;
grant execute on function
  private.my_staff_id_in(uuid),
  private.teaches_class(uuid),
  private.can_take_register(uuid, uuid),
  private.can_view_register(uuid)
to authenticated;

-- ---------------------------------------------------------------------------
-- Access: read with RLS, write through the functions below
-- ---------------------------------------------------------------------------

alter table public.registers enable row level security;
alter table public.register_entries enable row level security;

grant select on public.registers, public.register_entries to authenticated;

create policy "Admins and the class's teachers see registers" on public.registers
  for select to authenticated
  using (school_id in (select private.my_admin_school_ids()) or private.teaches_class(class_id));

create policy "Admins and the class's teachers see marks" on public.register_entries
  for select to authenticated
  using (private.can_view_register(register_id));

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create function private.ghana_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Africa/Accra')::date;
$$;

-- ---------------------------------------------------------------------------
-- Open a register (or get today's one if it already exists)
-- ---------------------------------------------------------------------------

create function public.open_register(
  p_id uuid,
  p_class_id uuid,
  p_class_subject_id uuid default null,
  p_period_number smallint default null,
  p_reward_marks numeric default 0
)
returns public.registers
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_class public.classes;
  v_school public.schools;
  v_settings public.school_settings;
  v_today date := private.ghana_today();
  v_existing public.registers;
  v_closes_at timestamptz;
  v_staff_id uuid;
  v_term_id uuid;
  v_result public.registers;
begin
  if auth.uid() is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;

  -- Retried from a phone that went offline: return what was created.
  select * into v_existing from public.registers where id = p_id;
  if v_existing.id is not null then
    if not private.can_view_register(v_existing.id) then
      raise exception 'You cannot open this register.' using errcode = '42501';
    end if;
    return v_existing;
  end if;

  select * into v_class from public.classes where id = p_class_id;
  if v_class.id is null or v_class.archived_at is not null then
    raise exception 'Class not found.' using errcode = 'P0002';
  end if;
  select * into v_school from public.schools where id = v_class.school_id;
  if v_school.status = 'suspended' then
    raise exception 'This school is suspended. Contact RollCol support.' using errcode = 'P0001';
  end if;

  if v_school.register_mode = 'daily' and p_class_subject_id is not null then
    raise exception 'Your school takes one register a day, so registers are not taken per subject.' using errcode = 'P0001';
  end if;
  if v_school.register_mode = 'per_period' and p_class_subject_id is null then
    raise exception 'Your school takes registers every period. Choose the subject.' using errcode = 'P0001';
  end if;
  if p_class_subject_id is not null then
    if p_period_number is null then
      raise exception 'Choose the period.' using errcode = '23514';
    end if;
    if not exists (select 1 from public.class_subjects
                   where id = p_class_subject_id and class_id = v_class.id) then
      raise exception 'That subject is not taught to this class.' using errcode = 'P0002';
    end if;
  end if;

  if not private.can_take_register(v_class.id, p_class_subject_id) then
    raise exception 'You cannot take this register.' using errcode = '42501';
  end if;

  -- Another device already started today's register: use that one.
  select * into v_existing from public.registers r
  where r.class_id = v_class.id and r.register_date = v_today
    and (
      (p_class_subject_id is null and r.class_subject_id is null)
      or (p_class_subject_id is not null and r.class_subject_id is not null and r.period_number = p_period_number)
    );
  if v_existing.id is not null then
    if p_class_subject_id is not null and v_existing.class_subject_id <> p_class_subject_id then
      raise exception 'Period % already has a register for this class today.', p_period_number using errcode = '23505';
    end if;
    return v_existing;
  end if;

  select * into v_settings from public.school_settings where school_id = v_school.id;
  if p_class_subject_id is null then
    -- Closes at the school's daily time, or 30 minutes from now if that has passed.
    v_closes_at := greatest(
      (v_today + coalesce(v_settings.daily_register_closes_at, time '10:00')) at time zone 'Africa/Accra',
      now() + interval '30 minutes'
    );
  else
    v_closes_at := now() + make_interval(mins => coalesce(v_settings.period_register_minutes, 60));
  end if;

  select ap.id into v_term_id from public.academic_periods ap
  where ap.school_id = v_school.id and v_today between ap.starts_on and ap.ends_on;

  v_staff_id := private.my_staff_id_in(v_school.id);

  insert into public.registers
    (id, school_id, class_id, class_subject_id, period_number, register_date, academic_period_id,
     reward_marks, opened_by, closes_at)
  values
    (p_id, v_school.id, v_class.id, p_class_subject_id, p_period_number, v_today, v_term_id,
     greatest(coalesce(p_reward_marks, 0), 0), v_staff_id, v_closes_at)
  returning * into v_result;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Save marks. p_marks is a JSON array of {"student_id": "...", "mark": "present" | "late" | "absent" | null}.
-- A null mark clears it (back to not marked). Returns how many marks changed.
-- Teachers can change marks on the register's own day; admins at any time.
-- ---------------------------------------------------------------------------

create function public.save_register_marks(p_register_id uuid, p_marks jsonb)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_register public.registers;
  v_staff_id uuid;
  v_is_admin boolean;
  v_cleared integer;
  v_count integer;
begin
  select * into v_register from public.registers where id = p_register_id for update;
  if v_register.id is null then
    raise exception 'Register not found.' using errcode = 'P0002';
  end if;
  if not private.can_take_register(v_register.class_id, v_register.class_subject_id) then
    raise exception 'You cannot mark this register.' using errcode = '42501';
  end if;

  v_is_admin := private.is_school_admin(v_register.school_id);
  if not v_is_admin and v_register.register_date <> private.ghana_today() then
    raise exception 'This register is from an earlier day. Ask an admin to correct it.' using errcode = 'P0001';
  end if;

  if jsonb_typeof(p_marks) <> 'array' or jsonb_array_length(p_marks) > 500 then
    raise exception 'Send marks as a list of up to 500 students.' using errcode = '22023';
  end if;

  v_staff_id := private.my_staff_id_in(v_register.school_id);

  create temporary table if not exists pg_temp.incoming_marks (
    student_id uuid primary key,
    mark public.attendance_mark
  ) on commit drop;
  delete from pg_temp.incoming_marks;

  insert into pg_temp.incoming_marks (student_id, mark)
  select distinct on ((e ->> 'student_id')::uuid)
         (e ->> 'student_id')::uuid,
         nullif(e ->> 'mark', '')::public.attendance_mark
  from jsonb_array_elements(p_marks) as e;

  -- Every student must be in this class (and not turned off).
  if exists (
    select 1 from pg_temp.incoming_marks m
    left join public.students st
      on st.id = m.student_id and st.class_id = v_register.class_id and st.status <> 'disabled'
    where st.id is null
  ) then
    raise exception 'Some of those students are not in this class. Refresh and try again.' using errcode = 'P0001';
  end if;

  delete from public.register_entries e
  using pg_temp.incoming_marks m
  where e.register_id = v_register.id and e.student_id = m.student_id and m.mark is null;
  get diagnostics v_cleared = row_count;

  insert into public.register_entries (register_id, student_id, school_id, mark, marked_by, marked_at)
  select v_register.id, m.student_id, v_register.school_id, m.mark, v_staff_id, now()
  from pg_temp.incoming_marks m
  where m.mark is not null
  on conflict (register_id, student_id) do update
    set mark = excluded.mark, marked_by = excluded.marked_by, marked_at = excluded.marked_at
    where public.register_entries.mark is distinct from excluded.mark;

  get diagnostics v_count = row_count;
  update public.registers set updated_at = now() where id = v_register.id;
  -- How many marks changed.
  return v_count + v_cleared;
end;
$$;

-- ---------------------------------------------------------------------------
-- Submit: the teacher is done. Submitting again does nothing.
-- ---------------------------------------------------------------------------

create function public.submit_register(p_register_id uuid)
returns public.registers
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_register public.registers;
begin
  select * into v_register from public.registers where id = p_register_id for update;
  if v_register.id is null then
    raise exception 'Register not found.' using errcode = 'P0002';
  end if;
  if not private.can_take_register(v_register.class_id, v_register.class_subject_id) then
    raise exception 'You cannot submit this register.' using errcode = '42501';
  end if;
  if v_register.status = 'open' then
    update public.registers
    set status = 'submitted', submitted_at = now(), submitted_by = private.my_staff_id_in(school_id)
    where id = v_register.id
    returning * into v_register;
  end if;
  return v_register;
end;
$$;

-- ---------------------------------------------------------------------------
-- Today's registers for the signed-in teacher (or every class, for admins),
-- in one school. One row per register to take: for per-period schools, one
-- row per subject the teacher teaches, plus a row for each register already
-- started today.
-- ---------------------------------------------------------------------------

create function public.registers_today(p_school_id uuid)
returns table (
  class_id uuid,
  class_name text,
  class_subject_id uuid,
  subject_name text,
  register_id uuid,
  period_number smallint,
  status public.register_status,
  closes_at timestamptz,
  marked_count integer,
  student_count integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_me public.staff;
  v_mode public.register_mode;
  v_today date := private.ghana_today();
begin
  select * into v_me from public.staff
  where user_id = auth.uid() and school_id = p_school_id and status = 'active';
  if v_me.id is null then
    raise exception 'You are not on the staff of this school.' using errcode = '42501';
  end if;
  select register_mode into v_mode from public.schools where id = p_school_id;

  return query
  with my_slots as (
    -- Daily: classes I am class teacher of (all classes for admins).
    select c.id as class_id, c.name as class_name, null::uuid as class_subject_id, null::text as subject_name
    from public.classes c
    where v_mode = 'daily' and c.school_id = p_school_id and c.archived_at is null
      and (v_me.role = 'admin' or c.class_teacher_id = v_me.id)
    union all
    -- Per period: subjects I teach (every class subject for admins and class teachers).
    select c.id, c.name, cs.id, sub.name
    from public.class_subjects cs
    join public.classes c on c.id = cs.class_id
    join public.subjects sub on sub.id = cs.subject_id
    where v_mode = 'per_period' and cs.school_id = p_school_id and c.archived_at is null
      and (v_me.role = 'admin' or cs.teacher_id = v_me.id or c.class_teacher_id = v_me.id)
  ),
  counts as (
    select c.id as class_id, count(st.id)::integer as students
    from public.classes c
    left join public.students st on st.class_id = c.id and st.status <> 'disabled'
    where c.school_id = p_school_id
    group by c.id
  ),
  started as (
    select r.*, (select count(*)::integer from public.register_entries e where e.register_id = r.id) as marked
    from public.registers r
    where r.school_id = p_school_id and r.register_date = v_today
  )
  -- Registers already started today that I can see.
  select r.class_id, c.name, r.class_subject_id, sub.name, r.id, r.period_number, r.status, r.closes_at,
         r.marked, coalesce(n.students, 0)
  from started r
  join public.classes c on c.id = r.class_id
  left join public.class_subjects cs on cs.id = r.class_subject_id
  left join public.subjects sub on sub.id = cs.subject_id
  left join counts n on n.class_id = r.class_id
  where v_me.role = 'admin' or private.can_take_register(r.class_id, r.class_subject_id)
  union all
  -- Slots without a register yet. Per-period slots always stay, to start another period.
  select s.class_id, s.class_name, s.class_subject_id, s.subject_name, null::uuid, null::smallint,
         null::public.register_status, null::timestamptz, 0, coalesce(n.students, 0)
  from my_slots s
  left join counts n on n.class_id = s.class_id
  where s.class_subject_id is not null
     or not exists (select 1 from started r where r.class_id = s.class_id and r.class_subject_id is null)
  order by 2, 4 nulls first, 6 nulls last;
end;
$$;

-- ---------------------------------------------------------------------------
-- Attendance totals per student in a class for a term (or all time when no
-- term is given): present, late, absent, registers taken and marks earned.
-- Present and late both earn the register's reward marks.
-- ---------------------------------------------------------------------------

create function public.class_attendance_summary(p_class_id uuid, p_academic_period_id uuid default null)
returns table (
  student_id uuid,
  full_name text,
  school_number text,
  present integer,
  late integer,
  absent integer,
  registers integer,
  marks numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_class public.classes;
begin
  select * into v_class from public.classes where id = p_class_id;
  if v_class.id is null then
    raise exception 'Class not found.' using errcode = 'P0002';
  end if;
  if not (private.is_school_admin(v_class.school_id) or private.teaches_class(v_class.id)) then
    raise exception 'You cannot see this class.' using errcode = '42501';
  end if;

  return query
  with regs as (
    select r.id, r.reward_marks from public.registers r
    where r.class_id = v_class.id
      and (p_academic_period_id is null or r.academic_period_id = p_academic_period_id)
  )
  select st.id, st.full_name, st.school_number,
         count(*) filter (where e.mark = 'present')::integer,
         count(*) filter (where e.mark = 'late')::integer,
         count(*) filter (where e.mark = 'absent')::integer,
         (select count(*)::integer from regs),
         coalesce(sum(rg.reward_marks) filter (where e.mark in ('present', 'late')), 0)
  from public.students st
  left join public.register_entries e on e.student_id = st.id and e.register_id in (select id from regs)
  left join regs rg on rg.id = e.register_id
  where st.class_id = v_class.id and st.status <> 'disabled'
  group by st.id, st.full_name, st.school_number
  order by st.full_name;
end;
$$;

-- ---------------------------------------------------------------------------
-- Close registers whose time is up (every minute).
-- ---------------------------------------------------------------------------

create function private.close_due_registers()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.registers set status = 'closed', closed_at = now()
  where status = 'open' and closes_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function private.close_due_registers() from public, anon, authenticated;

select cron.schedule('close-due-registers', '* * * * *', $$select private.close_due_registers()$$);

-- ---------------------------------------------------------------------------
-- Grants for the functions
-- ---------------------------------------------------------------------------

revoke all on function
  public.open_register(uuid, uuid, uuid, smallint, numeric),
  public.save_register_marks(uuid, jsonb),
  public.submit_register(uuid),
  public.registers_today(uuid),
  public.class_attendance_summary(uuid, uuid)
from public, anon, authenticated;

grant execute on function
  public.open_register(uuid, uuid, uuid, smallint, numeric),
  public.save_register_marks(uuid, jsonb),
  public.submit_register(uuid),
  public.registers_today(uuid),
  public.class_attendance_summary(uuid, uuid)
to authenticated;
