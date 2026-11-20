-- Term totals now follow the term's dates instead of a stored link.
--
-- Before, each register remembered the term it was taken in. Removing a term
-- (or changing its dates) left registers without a term for good. Now
-- class_attendance_summary() counts the registers whose date falls inside the
-- term, so removing, re-adding or editing a term never loses attendance.

create or replace function public.class_attendance_summary(p_class_id uuid, p_academic_period_id uuid default null)
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
  v_term public.academic_periods;
begin
  select * into v_class from public.classes where id = p_class_id;
  if v_class.id is null then
    raise exception 'Class not found.' using errcode = 'P0002';
  end if;
  if not (private.is_school_admin(v_class.school_id) or private.teaches_class(v_class.id)) then
    raise exception 'You cannot see this class.' using errcode = '42501';
  end if;
  if p_academic_period_id is not null then
    select * into v_term from public.academic_periods
    where id = p_academic_period_id and school_id = v_class.school_id;
    if v_term.id is null then
      raise exception 'Term not found.' using errcode = 'P0002';
    end if;
  end if;

  return query
  with regs as (
    select r.id, r.reward_marks from public.registers r
    where r.class_id = v_class.id
      and (v_term.id is null or r.register_date between v_term.starts_on and v_term.ends_on)
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
