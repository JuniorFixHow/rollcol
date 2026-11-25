-- A child whose parent reported an absence starts as Absent on that day's
-- registers. The teacher can still change the mark (for example if the child
-- comes after all). Marks the teacher already gave are never touched.

-- Pre-marks reported children on a new register.
create function private.premark_reported_absences()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.register_entries (register_id, student_id, school_id, mark, marked_by)
  select new.id, st.id, new.school_id, 'absent', null
  from public.students st
  where st.class_id = new.class_id and st.status = 'active'
    and private.absence_reported(st.id, new.register_date)
  on conflict (register_id, student_id) do nothing;
  return new;
end;
$$;

create trigger registers_premark_absences
  after insert on public.registers
  for each row execute function private.premark_reported_absences();

-- A report made after a register was opened: pre-mark the child on the open
-- registers of those days, where the teacher has not marked them yet.
create function private.premark_on_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'active' then
    insert into public.register_entries (register_id, student_id, school_id, mark, marked_by)
    select r.id, new.student_id, new.school_id, 'absent', null
    from public.registers r
    join public.students st on st.id = new.student_id and st.class_id = r.class_id
    where r.status = 'open' and r.register_date between new.from_date and new.to_date
    on conflict (register_id, student_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger absence_reports_premark
  after insert on public.absence_reports
  for each row execute function private.premark_on_report();
