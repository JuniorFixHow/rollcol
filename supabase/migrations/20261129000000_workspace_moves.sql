-- Part 7b: moving a workspace into a school.
--
-- The owner asks with the school's code (they must already be staff there,
-- and the workspace must be the same kind: classes into a basic or senior
-- high school, courses into a tertiary school). The school's admin sees a
-- preview and approves or declines. On approval everything moves across in
-- one transaction and the workspace is deleted:
--
--   * terms or semesters: records go to the school's term or semester that
--     overlaps most (the school must have one for every term in use);
--   * classes and venues: a name the school already uses gets " (moved)";
--   * courses: a code the school already has is the same course, so its
--     classes (runs) join the school's, merging when the semester matches;
--   * students: the same person already at the school is merged (same
--     account; or, without accounts, same school ID and same name); a
--     school ID used by someone else gets a "W" added;
--   * guardians: the same phone number is the same guardian;
--   * the owner's workspace staff record becomes their school staff record.
--
-- Nothing is sent to guardians by the move itself. From then on the school's
-- own settings (alerts, SMS) apply.

-- Every link between school records is checked at the end of the
-- transaction when asked, so school IDs can change table by table. Normal
-- statements still check them at once (INITIALLY IMMEDIATE).
do $$
declare
  r record;
begin
  for r in
    select n.nspname, c.relname, k.conname
    from pg_constraint k
    join pg_class c on c.oid = k.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    where k.contype = 'f' and not k.condeferrable and n.nspname in ('public', 'private')
  loop
    execute format('alter table %I.%I alter constraint %I deferrable initially immediate', r.nspname, r.relname, r.conname);
  end loop;
end;
$$;

create table public.workspace_moves (
  id uuid primary key default gen_random_uuid(),
  -- Kept after the move (the workspace is deleted then), so the owner can see the outcome.
  workspace_id uuid references public.schools (id) on delete set null,
  workspace_name text not null,
  school_id uuid not null references public.schools (id) on delete cascade,
  requested_by uuid references auth.users (id) on delete set null,
  requested_by_name text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined', 'cancelled')),
  reason text check (reason is null or char_length(reason) <= 500),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users (id) on delete set null
);

create unique index workspace_moves_one_pending on public.workspace_moves (workspace_id) where status = 'pending';
create index workspace_moves_school_idx on public.workspace_moves (school_id, status);

alter table public.workspace_moves enable row level security;

create policy "Owners and the school's admins see moves" on public.workspace_moves
  for select to authenticated
  using (requested_by = (select auth.uid()) or private.is_school_admin(school_id));

grant select on public.workspace_moves to authenticated;

-- While a workspace moves, joining duplicate records deletes and changes
-- guardian links. Those are not real changes for guardians, so nothing is
-- logged (and so nothing is texted). approve_workspace_move turns this on for
-- its own transaction only; apps cannot set it.
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
  if current_setting('rollcol.moving_workspace', true) = 'on' then
    return coalesce(new, old);
  end if;

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

create or replace function private.log_removals_before_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_setting('rollcol.moving_workspace', true) = 'on' then
    return old;
  end if;

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

-- "1 class", "3 classes", "1 session", "2 sessions".
create function private.count_label(p_count bigint, p_word text)
returns text
language sql
immutable
set search_path = ''
as $$
  select p_count || ' ' || case when p_count = 1 then p_word when p_word like '%s' then p_word || 'es' else p_word || 's' end;
$$;

-- ---------------------------------------------------------------------------
-- Planning: works out what will happen, for the preview and the move itself.
-- Fills temporary tables (dropped at the end of the transaction).
-- ---------------------------------------------------------------------------

create function private.plan_workspace_move(p_move_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
set client_min_messages = warning
as $$
declare
  v_move public.workspace_moves;
  v_ws public.schools;
  v_school public.schools;
  v_owner uuid;
  r record;
  v_candidate text;
  v_n integer;
  v_word text;
  v_new integer;
  v_limit integer;
  v_used integer;
begin
  select * into v_move from public.workspace_moves where id = p_move_id;
  select * into v_ws from public.schools where id = v_move.workspace_id;
  select * into v_school from public.schools where id = v_move.school_id;
  v_owner := v_ws.created_by;
  v_word := case when v_ws.type = 'tertiary' then 'semester' else 'term' end;

  drop table if exists pg_temp._wm_issues, pg_temp._wm_period, pg_temp._wm_subject, pg_temp._wm_class,
    pg_temp._wm_venue, pg_temp._wm_course, pg_temp._wm_student, pg_temp._wm_guardian;
  create temp table _wm_issues (sort serial, severity text, message text) on commit drop;
  create temp table _wm_period (ws_id uuid primary key, target uuid, name text, starts_on date, ends_on date, used boolean) on commit drop;
  create temp table _wm_subject (ws_id uuid primary key, target uuid) on commit drop;
  create temp table _wm_class (id uuid primary key, old_name text, new_name text) on commit drop;
  create temp table _wm_venue (id uuid primary key, old_name text, new_name text) on commit drop;
  create temp table _wm_course (ws_id uuid primary key, target uuid, code text) on commit drop;
  create temp table _wm_student (ws_id uuid primary key, target uuid, new_number text, name text, number text, active boolean) on commit drop;
  create temp table _wm_guardian (ws_id uuid primary key, target uuid) on commit drop;

  if v_ws.id is null then
    insert into _wm_issues (severity, message) values ('blocker', 'The workspace no longer exists.');
    return;
  end if;
  if v_school.status = 'suspended' then
    insert into _wm_issues (severity, message) values ('blocker', v_school.name || ' is suspended.');
  end if;
  if not exists (select 1 from public.staff where school_id = v_school.id and user_id = v_owner and status = 'active') then
    insert into _wm_issues (severity, message)
    values ('blocker', v_move.requested_by_name || ' is no longer active staff at ' || v_school.name || '.');
  end if;

  -- Terms or semesters.
  insert into _wm_period
  select p.id,
         (select sp.id from public.academic_periods sp
          where sp.school_id = v_school.id and sp.kind = p.kind
            and greatest(sp.starts_on, p.starts_on) <= least(sp.ends_on, p.ends_on)
          order by least(sp.ends_on, p.ends_on) - greatest(sp.starts_on, p.starts_on) desc, sp.starts_on
          limit 1),
         p.name, p.starts_on, p.ends_on,
         exists (select 1 from public.registers g where g.academic_period_id = p.id)
           or exists (select 1 from public.course_runs cr where cr.academic_period_id = p.id)
  from public.academic_periods p where p.school_id = v_ws.id;

  insert into _wm_issues (severity, message)
  select 'blocker', 'The school has no ' || v_word || ' covering ' || m.name || ' (' ||
         to_char(m.starts_on, 'FMDD Mon YYYY') || ' to ' || to_char(m.ends_on, 'FMDD Mon YYYY') ||
         '). An admin adds it under Academics first.'
  from _wm_period m where m.target is null and m.used order by m.starts_on;

  insert into _wm_issues (severity, message)
  select 'change', 'Your ' || v_word || ' "' || m.name || '" becomes the school''s ' || v_word || ' "' || sp.name || '".'
  from _wm_period m join public.academic_periods sp on sp.id = m.target where m.used order by m.starts_on;

  -- Subjects: the same name is the same subject.
  insert into _wm_subject
  select s.id, (select t.id from public.subjects t where t.school_id = v_school.id and lower(t.name) = lower(s.name) limit 1)
  from public.subjects s where s.school_id = v_ws.id;

  -- Classes: a clashing name gets " (moved)".
  for r in select c.id, c.name from public.classes c where c.school_id = v_ws.id order by c.name loop
    v_candidate := r.name;
    v_n := 1;
    while exists (select 1 from public.classes c where c.school_id = v_school.id and lower(c.name) = lower(v_candidate))
       or exists (select 1 from _wm_class m where lower(m.new_name) = lower(v_candidate)) loop
      v_candidate := left(r.name, 48) || case when v_n = 1 then ' (moved)' else ' (moved ' || v_n || ')' end;
      v_n := v_n + 1;
    end loop;
    insert into _wm_class values (r.id, r.name, v_candidate);
  end loop;
  insert into _wm_issues (severity, message)
  select 'change', 'The school already has a class called ' || old_name || ', so this one becomes ' || new_name || '.'
  from _wm_class where new_name <> old_name;

  -- Venues: the same.
  for r in select v.id, v.name from public.venues v where v.school_id = v_ws.id order by v.name loop
    v_candidate := r.name;
    v_n := 1;
    while exists (select 1 from public.venues v where v.school_id = v_school.id
                  and lower(regexp_replace(btrim(v.name), '\s+', ' ', 'g')) = lower(regexp_replace(btrim(v_candidate), '\s+', ' ', 'g')))
       or exists (select 1 from _wm_venue m where lower(m.new_name) = lower(v_candidate)) loop
      v_candidate := left(r.name, 68) || case when v_n = 1 then ' (moved)' else ' (moved ' || v_n || ')' end;
      v_n := v_n + 1;
    end loop;
    insert into _wm_venue values (r.id, r.name, v_candidate);
  end loop;
  insert into _wm_issues (severity, message)
  select 'change', 'The school already has a venue called ' || old_name || ', so this one becomes ' || new_name || '.'
  from _wm_venue where new_name <> old_name;

  -- Courses: the same code is the same course.
  insert into _wm_course
  select c.id, (select t.id from public.courses t where t.school_id = v_school.id and upper(btrim(t.code)) = upper(btrim(c.code)) limit 1), c.code
  from public.courses c where c.school_id = v_ws.id;
  insert into _wm_issues (severity, message)
  select 'change', code || ' is already a course at the school, so its sessions, students and records join the school''s ' || code || '.'
  from _wm_course where target is not null order by code;

  -- Students.
  for r in select st.* from public.students st where st.school_id = v_ws.id order by st.full_name loop
    insert into _wm_student (ws_id, target, new_number, name, number, active)
    values (
      r.id,
      case
        when r.user_id is not null then
          coalesce(
            (select t.id from public.students t where t.school_id = v_school.id and t.user_id = r.user_id),
            (select t.id from public.students t where t.school_id = v_school.id and t.school_number = r.school_number and t.user_id is null)
          )
        else
          (select t.id from public.students t where t.school_id = v_school.id and t.school_number = r.school_number
             and t.user_id is null
             and lower(regexp_replace(btrim(t.full_name), '\s+', ' ', 'g')) = lower(regexp_replace(btrim(r.full_name), '\s+', ' ', 'g')))
      end,
      null, r.full_name, r.school_number, r.status <> 'disabled'
    );
  end loop;

  -- A school ID the school already uses for someone else gets a "W".
  for r in select m.ws_id, m.number from _wm_student m
           where m.target is null and m.number is not null
             and exists (select 1 from public.students t where t.school_id = v_school.id and t.school_number = m.number) loop
    v_n := 1;
    loop
      v_candidate := left(r.number, 30) || 'W' || case when v_n = 1 then '' else v_n::text end;
      exit when not exists (select 1 from public.students t where t.school_id = v_school.id and t.school_number = v_candidate)
            and not exists (select 1 from public.staff t where t.school_id = v_school.id and t.school_number = v_candidate)
            and not exists (select 1 from public.students t where t.school_id = v_ws.id and t.school_number = v_candidate)
            and not exists (select 1 from _wm_student m where m.new_number = v_candidate);
      v_n := v_n + 1;
    end loop;
    update _wm_student set new_number = v_candidate where ws_id = r.ws_id;
  end loop;

  insert into _wm_issues (severity, message)
  select 'change', name || ' (' || number || ') is already a student at the school, so the records are joined.'
  from _wm_student where target is not null order by name;
  insert into _wm_issues (severity, message)
  select 'change', 'The school ID ' || number || ' is used by someone else at the school, so ' || name || ' gets ' || new_number || '.'
  from _wm_student where new_number is not null order by name;
  if v_ws.type = 'non_tertiary' and exists (select 1 from _wm_student m where m.target is not null) then
    insert into _wm_issues (severity, message)
    values ('info', 'Pupils already at the school stay in their school class. Their attendance in the moved classes is kept.');
  end if;

  -- Someone who is staff at the school cannot be a student there too.
  insert into _wm_issues (severity, message)
  select 'blocker', st.full_name || ' is staff at ' || v_school.name || ', so cannot be a student there. Remove them from the workspace first.'
  from public.students st
  where st.school_id = v_ws.id and st.user_id is not null
    and exists (select 1 from public.staff sf where sf.school_id = v_school.id and sf.user_id = st.user_id);

  -- The school's student limit.
  select count(*) into v_new from _wm_student where target is null and active;
  select count(*) into v_used from public.students where school_id = v_school.id and status <> 'disabled';
  v_limit := private.school_student_limit(v_school.id);
  if v_limit is not null and v_used + v_new > v_limit then
    insert into _wm_issues (severity, message)
    values ('blocker', v_school.name || ' can have up to ' || v_limit || ' students and has ' || v_used ||
            '. The move adds ' || v_new || '. Turn off students who have left, or ask RollCol for a higher limit.');
  end if;

  -- Guardians: the same phone number is the same guardian.
  insert into _wm_guardian
  select g.id, (select t.id from public.guardians t where t.school_id = v_school.id and t.phone = g.phone)
  from public.guardians g where g.school_id = v_ws.id;
  if exists (select 1 from _wm_guardian where target is not null) then
    insert into _wm_issues (severity, message)
    select 'change', count(*) || case when count(*) = 1 then ' guardian is' else ' guardians are' end ||
           ' already at the school (same phone number), so the records are joined.'
    from _wm_guardian where target is not null;
  end if;

  -- What moves.
  insert into _wm_issues (severity, message)
  select 'info', concat_ws(', ',
    case when v_ws.type = 'tertiary'
      then (select private.count_label(count(*), 'course') from public.courses where school_id = v_ws.id)
      else (select private.count_label(count(*), 'class') from public.classes where school_id = v_ws.id) end,
    (select private.count_label(count(*), 'student') || ' (' || count(*) filter (where target is null) || ' new to the school)' from _wm_student),
    case when v_ws.type = 'tertiary'
      then (select private.count_label(count(*), 'session') from public.attendance_sessions where school_id = v_ws.id)
      else (select private.count_label(count(*), 'register') from public.registers where school_id = v_ws.id) end,
    case when v_ws.type = 'tertiary' then null
      else (select private.count_label(count(*), 'guardian') from public.guardians where school_id = v_ws.id) end
  ) || ' move into ' || v_school.name || '.';
  if v_ws.type = 'non_tertiary' and v_school.status = 'verified' then
    insert into _wm_issues (severity, message)
    values ('info', 'After the move, guardians get the school''s attendance alerts. Nothing is sent by the move itself.');
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Asking, cancelling, previewing, declining
-- ---------------------------------------------------------------------------

create function public.request_workspace_move(p_workspace_id uuid, p_school_code text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_ws public.schools;
  v_school public.schools;
  v_name text;
  v_id uuid;
begin
  select * into v_ws from public.schools where id = p_workspace_id;
  if v_ws.id is null or not v_ws.is_workspace or v_ws.created_by is distinct from auth.uid() then
    raise exception 'Only the owner can move this workspace.' using errcode = '42501';
  end if;
  select * into v_school from public.schools where code = upper(btrim(coalesce(p_school_code, '')));
  if v_school.id is null or v_school.is_workspace then
    raise exception 'No school has that code. Check it with the school''s admin.' using errcode = 'P0001';
  end if;
  if v_school.type <> v_ws.type then
    raise exception '%', case when v_ws.type = 'tertiary'
      then 'A courses workspace can only move into a university or college.'
      else 'A classes workspace can only move into a basic or senior high school.' end using errcode = 'P0001';
  end if;
  select full_name into v_name from public.staff where school_id = v_school.id and user_id = auth.uid() and status = 'active';
  if v_name is null then
    raise exception 'You need to be staff at % first. Ask its admin to invite you, then try again.', v_school.name using errcode = 'P0001';
  end if;
  if exists (select 1 from public.workspace_moves where workspace_id = v_ws.id and status = 'pending') then
    raise exception 'This workspace is already waiting to move. Cancel that request first.' using errcode = 'P0001';
  end if;

  insert into public.workspace_moves (workspace_id, workspace_name, school_id, requested_by, requested_by_name)
  values (v_ws.id, v_ws.name, v_school.id, auth.uid(), v_name)
  returning id into v_id;

  perform private.queue_push(sf.user_id, 'Workspace move request',
    v_name || ' asks to move the workspace ' || v_ws.name || ' into ' || v_school.name || '. Review it on the RollCol website.',
    jsonb_build_object('moveId', v_id))
  from public.staff sf where sf.school_id = v_school.id and sf.role = 'admin' and sf.status = 'active' and sf.user_id is not null;
  return v_id;
end;
$$;

create function public.cancel_workspace_move(p_move_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  update public.workspace_moves set status = 'cancelled', decided_at = now(), decided_by = auth.uid()
  where id = p_move_id and requested_by = auth.uid() and status = 'pending';
  if not found then
    raise exception 'There is no waiting request of yours to cancel.' using errcode = 'P0001';
  end if;
end;
$$;

-- The preview, for the owner and the school's admins.
create function public.workspace_move_preview(p_move_id uuid)
returns table (severity text, message text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_move public.workspace_moves;
begin
  select * into v_move from public.workspace_moves where id = p_move_id;
  if v_move.id is null or not (v_move.requested_by = auth.uid() or private.is_school_admin(v_move.school_id)) then
    raise exception 'You cannot see this request.' using errcode = '42501';
  end if;
  if v_move.status <> 'pending' then
    return;
  end if;
  perform private.plan_workspace_move(v_move.id);
  return query
    select i.severity, i.message from pg_temp._wm_issues i
    order by case i.severity when 'blocker' then 0 when 'info' then 1 else 2 end, i.sort;
end;
$$;

create function public.decline_workspace_move(p_move_id uuid, p_reason text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_move public.workspace_moves;
  v_school text;
begin
  select * into v_move from public.workspace_moves where id = p_move_id and status = 'pending';
  if v_move.id is null or not private.is_school_admin(v_move.school_id) then
    raise exception 'Only the school''s admins can decline this request.' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Tell the owner why, so they know what to do.' using errcode = '22023';
  end if;
  update public.workspace_moves
  set status = 'declined', reason = btrim(p_reason), decided_at = now(), decided_by = auth.uid()
  where id = v_move.id;
  select name into v_school from public.schools where id = v_move.school_id;
  if v_move.requested_by is not null then
    perform private.queue_push(v_move.requested_by, 'Workspace not moved',
      v_school || ' declined moving ' || v_move.workspace_name || ': ' || btrim(p_reason), jsonb_build_object('moveId', v_move.id));
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- The move
-- ---------------------------------------------------------------------------

create function public.approve_workspace_move(p_move_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_move public.workspace_moves;
  v_w uuid;
  v_s uuid;
  v_school_name text;
  v_wstaff uuid;
  v_staff uuid;
  v_blockers text;
  r record;
  v_course uuid;
  v_period uuid;
  v_target_run uuid;
begin
  select * into v_move from public.workspace_moves where id = p_move_id and status = 'pending' for update;
  if v_move.id is null or not private.is_school_admin(v_move.school_id) then
    raise exception 'Only the school''s admins can approve this request.' using errcode = '42501';
  end if;

  perform private.plan_workspace_move(v_move.id);
  select string_agg(message, ' ' order by sort) into v_blockers from pg_temp._wm_issues where severity = 'blocker';
  if v_blockers is not null then
    raise exception '%', v_blockers using errcode = 'P0001';
  end if;

  v_w := v_move.workspace_id;
  v_s := v_move.school_id;
  select name into v_school_name from public.schools where id = v_s;
  select sf.id into v_wstaff from public.staff sf join public.schools s on s.id = sf.school_id
  where sf.school_id = v_w and sf.user_id = s.created_by;
  select sf.id into v_staff from public.staff sf join public.schools s on s.id = v_w
  where sf.school_id = v_s and sf.user_id = s.created_by;

  set constraints all deferred;
  -- Joining duplicates is not a change for guardians: log nothing (see log_guardian_link_event).
  perform set_config('rollcol.moving_workspace', 'on', true);

  -- The workspace's guardian changes were never texted (workspaces are not
  -- verified). Mark them done, so the school's SMS job does not send them now.
  update public.guardian_events set processed_at = coalesce(processed_at, now()) where school_id = v_w;

  -- Queues and undelivered messages of the workspace (free workspaces send no SMS).
  delete from public.sms_outbox where school_id = v_w;
  delete from public.sms_messages where school_id = v_w;
  delete from public.sms_credit_entries where school_id = v_w;
  delete from private.attendance_alerts where school_id = v_w;
  delete from private.sign_in_failures where school_id = v_w;

  -- The owner's records point to their staff record at the school.
  update public.class_subjects set teacher_id = v_staff where teacher_id = v_wstaff;
  update public.registers set opened_by = case when opened_by = v_wstaff then v_staff else opened_by end,
                              submitted_by = case when submitted_by = v_wstaff then v_staff else submitted_by end
  where school_id = v_w;
  update public.register_entries set marked_by = v_staff where marked_by = v_wstaff;
  update public.attendance_sessions set started_by = case when started_by = v_wstaff then v_staff else started_by end,
                                        voided_by = case when voided_by = v_wstaff then v_staff else voided_by end
  where school_id = v_w;
  update public.session_checkins set added_by = v_staff where added_by = v_wstaff;
  update public.session_adjustments set staff_id = v_staff where staff_id = v_wstaff;
  delete from public.course_run_staff where staff_id = v_wstaff;

  -- Terms or semesters.
  update public.registers g set academic_period_id = m.target
  from pg_temp._wm_period m where g.academic_period_id = m.ws_id;

  -- Subjects.
  update public.class_subjects cs set subject_id = m.target
  from pg_temp._wm_subject m where cs.subject_id = m.ws_id and m.target is not null;
  delete from public.subjects s using pg_temp._wm_subject m where s.id = m.ws_id and m.target is not null;
  update public.subjects set school_id = v_s where school_id = v_w;

  -- Classes (renamed where needed; the owner stays their teacher) and venues.
  update public.classes c set school_id = v_s, name = m.new_name, class_teacher_id = v_staff
  from pg_temp._wm_class m where c.id = m.id;
  update public.class_subjects set school_id = v_s where school_id = v_w;
  update public.venues v set school_id = v_s, name = m.new_name from pg_temp._wm_venue m where v.id = m.id;

  -- Courses and their runs.
  update public.courses c set school_id = v_s from pg_temp._wm_course m where c.id = m.ws_id and m.target is null;
  for r in select cr.id, cr.course_id, cr.academic_period_id from public.course_runs cr where cr.school_id = v_w loop
    select coalesce(m.target, m.ws_id) into v_course from pg_temp._wm_course m where m.ws_id = r.course_id;
    select m.target into v_period from pg_temp._wm_period m where m.ws_id = r.academic_period_id;
    select cr.id into v_target_run from public.course_runs cr
    where cr.course_id = v_course and cr.academic_period_id = v_period and cr.school_id = v_s;
    if v_target_run is null then
      update public.course_runs set course_id = v_course, academic_period_id = v_period, school_id = v_s where id = r.id;
      v_target_run := r.id;
    else
      update public.attendance_sessions set course_run_id = v_target_run, school_id = v_s where course_run_id = r.id;
      update public.enrolments set course_run_id = v_target_run, school_id = v_s where course_run_id = r.id;
      delete from public.course_runs where id = r.id;
    end if;
    insert into public.course_run_staff (course_run_id, staff_id, school_id)
    values (v_target_run, v_staff, v_s) on conflict do nothing;
  end loop;
  delete from public.courses c using pg_temp._wm_course m where c.id = m.ws_id and m.target is not null;

  -- Students: new school IDs, then joins into existing records, then the rest move.
  update public.students st set school_number = m.new_number
  from pg_temp._wm_student m where st.id = m.ws_id and m.new_number is not null;

  for r in select m.ws_id, m.target from pg_temp._wm_student m where m.target is not null loop
    delete from public.enrolments e
    where e.student_id = r.ws_id
      and exists (select 1 from public.enrolments t where t.course_run_id = e.course_run_id and t.student_id = r.target);
    update public.enrolments set student_id = r.target, school_id = v_s where student_id = r.ws_id;
    update public.register_entries set student_id = r.target where student_id = r.ws_id;
    update public.session_checkins set student_id = r.target where student_id = r.ws_id;
    update public.session_adjustments set student_id = r.target where student_id = r.ws_id;
    update public.guardian_events set student_id = r.target where student_id = r.ws_id;
    delete from private.qr_passes where student_id = r.ws_id;
    -- A student who joined the workspace with their account claims the school's record without one.
    update public.students t set user_id = s.user_id
    from public.students s where s.id = r.ws_id and t.id = r.target and t.user_id is null and s.user_id is not null;
  end loop;

  -- Guardian links, with both sides mapped; duplicates go, one present-alert guardian per student stays.
  create temp table _wm_link on commit drop as
  select l.id,
         coalesce(gm.target, l.guardian_id) as guardian_id,
         coalesce(sm.target, l.student_id) as student_id,
         l.receives_present_alerts
  from public.guardian_links l
  left join pg_temp._wm_guardian gm on gm.ws_id = l.guardian_id
  left join pg_temp._wm_student sm on sm.ws_id = l.student_id
  where l.school_id = v_w;

  delete from public.guardian_links l using pg_temp._wm_link m
  where l.id = m.id and exists (
    select 1 from public.guardian_links t where t.school_id = v_s and t.guardian_id = m.guardian_id and t.student_id = m.student_id
  );
  update public.guardian_links l
  set guardian_id = m.guardian_id,
      student_id = m.student_id,
      school_id = v_s,
      receives_present_alerts = l.receives_present_alerts and not exists (
        select 1 from public.guardian_links t
        where t.school_id = v_s and t.student_id = m.student_id and t.receives_present_alerts and t.id <> l.id)
  from pg_temp._wm_link m where l.id = m.id;

  update public.guardian_events e set guardian_id = m.target
  from pg_temp._wm_guardian m where e.guardian_id = m.ws_id and m.target is not null;
  update public.sms_outbox o set guardian_id = m.target
  from pg_temp._wm_guardian m where o.guardian_id = m.ws_id and m.target is not null;

  -- Duplicates have no links left, so removing them logs nothing for guardians.
  delete from public.guardians g using pg_temp._wm_guardian m where g.id = m.ws_id and m.target is not null;
  delete from public.students s using pg_temp._wm_student m where s.id = m.ws_id and m.target is not null;

  update public.guardians set school_id = v_s where school_id = v_w;
  update public.students set school_id = v_s where school_id = v_w;

  -- Everything else follows.
  update public.course_runs set school_id = v_s where school_id = v_w;
  update public.course_run_staff set school_id = v_s where school_id = v_w;
  update public.enrolments set school_id = v_s where school_id = v_w;
  update public.registers set school_id = v_s where school_id = v_w;
  update public.register_entries set school_id = v_s where school_id = v_w;
  update public.attendance_sessions set school_id = v_s where school_id = v_w;
  update public.session_checkins set school_id = v_s where school_id = v_w;
  update public.session_adjustments set school_id = v_s where school_id = v_w;
  update public.guardian_events set school_id = v_s where school_id = v_w;

  -- Every link must hold now, before the workspace goes.
  set constraints all immediate;

  update public.workspace_moves set status = 'approved', decided_at = now(), decided_by = auth.uid(), workspace_id = null
  where id = v_move.id;
  update public.workspace_moves set status = 'cancelled', decided_at = now()
  where workspace_id = v_w and status = 'pending';

  -- What is left (settings, the old terms, the owner's workspace record) goes with the workspace.
  delete from public.schools where id = v_w;
  perform set_config('rollcol.moving_workspace', 'off', true);

  if v_move.requested_by is not null then
    perform private.queue_push(v_move.requested_by, 'Workspace moved',
      v_move.workspace_name || ' is now part of ' || v_school_name || '.', jsonb_build_object('moveId', v_move.id));
  end if;
end;
$$;

revoke all on all functions in schema private from public, anon;
revoke all on function
  public.request_workspace_move(uuid, text),
  public.cancel_workspace_move(uuid),
  public.workspace_move_preview(uuid),
  public.decline_workspace_move(uuid, text),
  public.approve_workspace_move(uuid)
from public, anon;
grant execute on function
  public.request_workspace_move(uuid, text),
  public.cancel_workspace_move(uuid),
  public.workspace_move_preview(uuid),
  public.decline_workspace_move(uuid, text),
  public.approve_workspace_move(uuid)
to authenticated;
