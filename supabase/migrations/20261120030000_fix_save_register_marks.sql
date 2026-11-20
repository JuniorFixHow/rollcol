-- Fix: saving marks failed on Supabase with "DELETE requires a WHERE clause".
--
-- Supabase blocks DELETE and UPDATE statements without a WHERE clause for API
-- requests (the safeupdate extension). save_register_marks() emptied a scratch
-- table that way. It now reads the marks straight from the JSON instead, with
-- no scratch table.

create or replace function public.save_register_marks(p_register_id uuid, p_marks jsonb)
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

  -- Every student must be in this class (and not turned off).
  if exists (
    select 1
    from jsonb_array_elements(p_marks) as e
    left join public.students st
      on st.id = (e ->> 'student_id')::uuid
     and st.class_id = v_register.class_id
     and st.status <> 'disabled'
    where st.id is null
  ) then
    raise exception 'Some of those students are not in this class. Refresh and try again.' using errcode = 'P0001';
  end if;

  -- A null mark clears it (back to not marked).
  delete from public.register_entries re
  where re.register_id = v_register.id
    and re.student_id in (
      select (e ->> 'student_id')::uuid
      from jsonb_array_elements(p_marks) as e
      where nullif(e ->> 'mark', '') is null
    );
  get diagnostics v_cleared = row_count;

  insert into public.register_entries (register_id, student_id, school_id, mark, marked_by, marked_at)
  select distinct on ((e ->> 'student_id')::uuid)
         v_register.id, (e ->> 'student_id')::uuid, v_register.school_id,
         (e ->> 'mark')::public.attendance_mark, v_staff_id, now()
  from jsonb_array_elements(p_marks) as e
  where nullif(e ->> 'mark', '') is not null
  on conflict (register_id, student_id) do update
    set mark = excluded.mark, marked_by = excluded.marked_by, marked_at = excluded.marked_at
    where public.register_entries.mark is distinct from excluded.mark;
  get diagnostics v_count = row_count;

  update public.registers set updated_at = now() where id = v_register.id;
  -- How many marks changed.
  return v_count + v_cleared;
end;
$$;
