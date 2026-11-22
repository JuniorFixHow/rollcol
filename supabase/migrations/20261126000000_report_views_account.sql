-- Report views and editing your own account.
--
-- 1. The per-subject summary can be limited to dates (a week or a date range),
--    like the register.
-- 2. Staff change their own name (every school they belong to) and email.

-- 1. -------------------------------------------------------------------------

drop function public.class_subject_summary(uuid, uuid);

create function public.class_subject_summary(
  p_class_id uuid,
  p_period_id uuid default null,
  p_from date default null,
  p_to date default null
)
returns table (
  student_id uuid,
  full_name text,
  subject text,
  held integer,
  present integer,
  late integer,
  absent integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_class public.classes;
  v_from date;
  v_to date;
begin
  select * into v_class from public.classes where id = p_class_id;
  if v_class.id is null or not (private.is_school_admin(v_class.school_id) or private.teaches_class(v_class.id)) then
    raise exception 'You cannot see this class.' using errcode = '42501';
  end if;
  select starts_on, ends_on into v_from, v_to from private.period_range(v_class.school_id, p_period_id);
  v_from := greatest(v_from, coalesce(p_from, v_from));
  v_to := least(v_to, coalesce(p_to, v_to));

  return query
  with lessons as (
    select r.id, r.class_subject_id from public.registers r
    where r.class_id = v_class.id and r.class_subject_id is not null and r.register_date between v_from and v_to
  )
  select st.id, st.full_name, sub.name,
         (select count(*)::integer from lessons l where l.class_subject_id = cs.id),
         count(e.*) filter (where e.mark = 'present')::integer,
         count(e.*) filter (where e.mark = 'late')::integer,
         count(e.*) filter (where e.mark = 'absent')::integer
  from public.students st
  cross join public.class_subjects cs
  join public.subjects sub on sub.id = cs.subject_id
  left join lessons l on l.class_subject_id = cs.id
  left join public.register_entries e on e.register_id = l.id and e.student_id = st.id
  where st.class_id = v_class.id and st.status <> 'disabled' and cs.class_id = v_class.id
  group by st.id, st.full_name, sub.name, cs.id
  having (select count(*) from lessons l2 where l2.class_subject_id = cs.id) > 0
  order by st.full_name, sub.name;
end;
$$;

revoke all on function public.class_subject_summary(uuid, uuid, date, date) from public, anon;
grant execute on function public.class_subject_summary(uuid, uuid, date, date) to authenticated;

-- 2. -------------------------------------------------------------------------

-- Your name as colleagues, students and guardians see it, in every school you
-- belong to. Your school ID and role stay with the admin.
create function public.update_my_name(p_full_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(regexp_replace(coalesce(p_full_name, ''), '\s+', ' ', 'g'));
begin
  if auth.uid() is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'Enter your full name.' using errcode = '22023';
  end if;
  update public.staff set full_name = v_name, updated_at = now() where user_id = auth.uid();
end;
$$;

revoke all on function public.update_my_name(text) from public, anon;
grant execute on function public.update_my_name(text) to authenticated;

-- After a new email is confirmed, the staff records follow it, so admins see
-- the address the person really signs in with. Called by the website when the
-- confirmation link is opened and when the account page loads.
create function public.sync_my_email()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := (select email from auth.users where id = auth.uid());
begin
  if auth.uid() is null or v_email is null then
    return;
  end if;
  update public.staff set email = v_email, updated_at = now() where user_id = auth.uid() and email is distinct from v_email;
end;
$$;

revoke all on function public.sync_my_email() from public, anon;
grant execute on function public.sync_my_email() to authenticated;
