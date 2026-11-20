-- Periods per day: schools set how many periods their day has (1 to 20,
-- default 10), and a class can have its own number (for example a class with
-- a longer day). Registers allow periods up to the class's number.

alter table public.school_settings
  add column periods_per_day smallint not null default 10 check (periods_per_day between 1 and 20);
grant update (periods_per_day) on public.school_settings to authenticated;

-- Null means the class follows the school's number.
alter table public.classes
  add column periods_per_day smallint check (periods_per_day between 1 and 20);

alter table public.registers drop constraint registers_period_number_check;
alter table public.registers add constraint registers_period_number_check check (period_number between 1 and 20);

-- The number of periods a class has in a day.
create function private.class_periods(p_class_id uuid)
returns smallint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(c.periods_per_day, ss.periods_per_day, 10)::smallint
  from public.classes c
  left join public.school_settings ss on ss.school_id = c.school_id
  where c.id = p_class_id;
$$;

revoke all on function private.class_periods(uuid) from public, anon;
grant execute on function private.class_periods(uuid) to authenticated;

-- Reject periods beyond the class's day.
create function private.check_register_period()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_periods smallint;
begin
  if new.period_number is not null then
    v_periods := private.class_periods(new.class_id);
    if new.period_number > v_periods then
      raise exception 'This class has % periods a day. Choose a period from 1 to %.', v_periods, v_periods
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger registers_period_in_day before insert on public.registers
  for each row execute function private.check_register_period();

-- registers_today() now also returns how many periods each class has, for the
-- period picker. Its return type changes, so it is dropped and created again.
drop function public.registers_today(uuid);

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
  student_count integer,
  periods_per_day smallint
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
    select c.id as class_id, c.name as class_name, null::uuid as class_subject_id, null::text as subject_name
    from public.classes c
    where v_mode = 'daily' and c.school_id = p_school_id and c.archived_at is null
      and (v_me.role = 'admin' or c.class_teacher_id = v_me.id)
    union all
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
  select r.class_id, c.name, r.class_subject_id, sub.name, r.id, r.period_number, r.status, r.closes_at,
         r.marked, coalesce(n.students, 0), private.class_periods(r.class_id)
  from started r
  join public.classes c on c.id = r.class_id
  left join public.class_subjects cs on cs.id = r.class_subject_id
  left join public.subjects sub on sub.id = cs.subject_id
  left join counts n on n.class_id = r.class_id
  where v_me.role = 'admin' or private.can_take_register(r.class_id, r.class_subject_id)
  union all
  select s.class_id, s.class_name, s.class_subject_id, s.subject_name, null::uuid, null::smallint,
         null::public.register_status, null::timestamptz, 0, coalesce(n.students, 0), private.class_periods(s.class_id)
  from my_slots s
  left join counts n on n.class_id = s.class_id
  where s.class_subject_id is not null
     or not exists (select 1 from started r where r.class_id = s.class_id and r.class_subject_id is null)
  order by 2, 4 nulls first, 6 nulls last;
end;
$$;

revoke all on function public.registers_today(uuid) from public, anon, authenticated;
grant execute on function public.registers_today(uuid) to authenticated;
