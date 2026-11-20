-- Fix: deleting a school that has guardians failed.
--
-- When a school is deleted, its guardians and students are deleted with it.
-- Their delete triggers then tried to record "guardian removed" events against
-- the school that was being deleted, which the database refused. That blocked
-- deleting a school, including when its only staff member deletes their account.
--
-- Now nothing is recorded when the whole school is going: there is nobody left
-- to tell, and the school's history goes with it.

create or replace function private.log_removals_before_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- The whole school is being deleted.
  if not exists (select 1 from public.schools where id = old.school_id) then
    return old;
  end if;

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

create or replace function private.log_guardian_link_event()
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

  -- The whole school is being deleted.
  if not exists (select 1 from public.schools where id = v_link.school_id) then
    return coalesce(new, old);
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

create or replace function private.log_guardian_phone_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.schools where id = new.school_id) then
    return new;
  end if;
  insert into public.guardian_events
    (school_id, guardian_id, kind, phone, previous_phone, guardian_name,
     actor_user_id, via_delegation)
  values
    (new.school_id, new.id, 'phone_changed', new.phone, old.phone, new.full_name,
     auth.uid(), private.actor_is_delegate(new.school_id));
  return new;
end;
$$;
