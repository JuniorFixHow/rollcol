-- Part 4: SMS to parents and guardians (basic and senior high schools).
--
-- Everything that goes out is a row in sms_outbox, one per phone number:
--   attendance  absent, late and present alerts after a register closes,
--               and "arrived" updates when absent changes to late or present
--   system      guardian added, removed, phone changed, alerts on or off (free)
--   broadcast   admin messages to every guardian (or chosen classes)
--   custom      a teacher's or admin's message to one student's guardians
--
-- A job every minute turns new attendance marks and guardian changes into
-- messages; the send-sms Edge Function then sends what is due. Messages are
-- held during quiet hours (21:00 to 07:00 Ghana time). Every message is cleaned
-- to plain GSM characters (so ɛ and ɔ do not make it cost double).
--
-- Credits: one credit per SMS segment. Schools get credits from RollCol (the
-- platform owner adds them; plans come in Part 7). System messages are free.
-- Only verified schools send SMS, so a new school cannot be used to spam numbers.

create extension if not exists unaccent with schema extensions;

create type public.sms_kind as enum ('attendance', 'system', 'broadcast', 'custom');
create type public.sms_status as enum ('queued', 'sending', 'sent', 'failed', 'no_credit', 'cancelled');

-- ---------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------

alter table public.school_settings
  -- The school name used at the start of every SMS. Shorter is cheaper.
  add column sms_name text check (sms_name is null or char_length(sms_name) between 2 and 30),
  add column sms_absence_alerts boolean not null default true,
  add column sms_present_alerts boolean not null default false;

grant update (sms_name, sms_absence_alerts, sms_present_alerts) on public.school_settings to authenticated;

alter table public.registers add column alerts_queued_at timestamptz;

-- RollCol-wide settings for the sender (the Edge Function's address and secret).
-- Set once in the SQL Editor; see the README.
create table private.config (
  key text primary key,
  value text not null
);

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- A message a staff member wrote (broadcast or custom), sent to one or more phones.
create table public.sms_messages (
  id bigint generated always as identity primary key,
  school_id uuid not null references public.schools (id) on delete cascade,
  kind public.sms_kind not null check (kind in ('broadcast', 'custom')),
  body text not null,
  -- Who it went to, in words: "All guardians", "Basic 4, Basic 5", "Guardians of Ama Mensah".
  audience text not null,
  student_id uuid references public.students (id) on delete set null,
  recipients integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index sms_messages_school_idx on public.sms_messages (school_id, created_at desc);

create table public.sms_outbox (
  id bigint generated always as identity primary key,
  school_id uuid not null references public.schools (id) on delete cascade,
  kind public.sms_kind not null,
  to_phone text not null check (to_phone ~ '^\+[1-9][0-9]{7,14}$'),
  guardian_id uuid references public.guardians (id) on delete set null,
  message_id bigint references public.sms_messages (id) on delete set null,
  body text not null,
  segments smallint not null check (segments between 1 and 10),
  -- Credits taken for this message (0 for free system messages).
  credits smallint not null default 0,
  status public.sms_status not null default 'queued',
  send_after timestamptz not null default now(),
  attempts smallint not null default 0,
  -- Set by the sender: the provider's id, or "test" when RollCol is in test mode.
  provider_id text,
  error text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  updated_at timestamptz not null default now()
);

create index sms_outbox_due_idx on public.sms_outbox (send_after) where status = 'queued';
create index sms_outbox_school_idx on public.sms_outbox (school_id, created_at desc);
create index sms_outbox_message_idx on public.sms_outbox (message_id);

create trigger sms_outbox_touch before update on public.sms_outbox
  for each row execute function private.touch_updated_at();

-- Credits ledger: positive amounts add credits, negative amounts use them.
create table public.sms_credit_entries (
  id bigint generated always as identity primary key,
  school_id uuid not null references public.schools (id) on delete cascade,
  amount integer not null check (amount <> 0),
  reason text not null check (char_length(reason) between 2 and 200),
  sms_id bigint references public.sms_outbox (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index sms_credit_entries_school_idx on public.sms_credit_entries (school_id, created_at desc);

-- Attendance alerts waiting to be turned into messages (internal).
create table private.attendance_alerts (
  id bigint generated always as identity primary key,
  school_id uuid not null references public.schools (id) on delete cascade,
  register_id uuid not null references public.registers (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  guardian_id uuid not null references public.guardians (id) on delete cascade,
  kind text not null check (kind in ('absent', 'late', 'present', 'arrived')),
  created_at timestamptz not null default now(),
  sms_id bigint references public.sms_outbox (id) on delete set null,
  done_at timestamptz,
  constraint attendance_alerts_once unique (register_id, student_id, guardian_id, kind)
);

create index attendance_alerts_pending_idx on private.attendance_alerts (guardian_id) where done_at is null;

-- ---------------------------------------------------------------------------
-- Access
-- ---------------------------------------------------------------------------

alter table public.sms_messages enable row level security;
alter table public.sms_outbox enable row level security;
alter table public.sms_credit_entries enable row level security;

grant select on public.sms_messages, public.sms_outbox, public.sms_credit_entries to authenticated;

create policy "Admins see all messages; staff see their own" on public.sms_messages
  for select to authenticated
  using (school_id in (select private.my_admin_school_ids()) or created_by = (select auth.uid()));

create policy "Admins see the outbox; staff see what they sent" on public.sms_outbox
  for select to authenticated
  using (school_id in (select private.my_admin_school_ids()) or created_by = (select auth.uid()));

create policy "Admins see credits" on public.sms_credit_entries
  for select to authenticated
  using (school_id in (select private.my_admin_school_ids()) or (select private.is_platform_admin()));

-- ---------------------------------------------------------------------------
-- Text helpers
-- ---------------------------------------------------------------------------

-- Plain GSM text: Ghanaian letters and curly quotes replaced, accents removed,
-- anything else that would force a costly Unicode SMS dropped.
create function private.sms_clean(p_text text)
returns text
language sql
stable
set search_path = ''
as $$
  select btrim(regexp_replace(
    regexp_replace(
      extensions.unaccent('extensions.unaccent'::regdictionary,
        replace(replace(replace(
          translate(p_text, 'ɛƐɔƆŋŊ‘’“”–—', 'eEoOnN''''""--'),
          '…', '...'), '₵', 'GHS '), E' ', ' ')
      ),
      '[^A-Za-z0-9 @£$¥!"#%&''()*+,\-./:;<=>?_\n¡¿ÄÖÑÜäöñüàèéùìòÇØøÅåÆæßÉ§€\^{}\\\[~\]|]', '', 'g'),
    ' {2,}', ' ', 'g'));
$$;

-- SMS segments for a GSM message: 160 characters in one, 153 each when split.
-- Characters from the extension table count twice.
create function private.sms_segments(p_text text)
returns smallint
language sql
immutable
set search_path = ''
as $$
  select case
    when n <= 160 then 1
    else ceil(n / 153.0)
  end::smallint
  from (
    select char_length(p_text) + char_length(regexp_replace(p_text, '[^\^{}\\\[~\]|€]', '', 'g')) as n
  ) as t;
$$;

-- The next time a message may go out: straight away, unless it is between
-- 21:00 and 07:00 in Ghana, then 07:00.
create function private.sms_send_time(p_at timestamptz default now())
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select case
    when extract(hour from p_at at time zone 'Africa/Accra') >= 21
      then ((p_at at time zone 'Africa/Accra')::date + 1 + time '07:00') at time zone 'Africa/Accra'
    when extract(hour from p_at at time zone 'Africa/Accra') < 7
      then ((p_at at time zone 'Africa/Accra')::date + time '07:00') at time zone 'Africa/Accra'
    else p_at
  end;
$$;

-- "Ama", "Ama and Kofi", "Ama, Kofi and Esi".
create function private.join_names(p_names text[])
returns text
language sql
immutable
set search_path = ''
as $$
  select case coalesce(array_length(p_names, 1), 0)
    when 0 then ''
    when 1 then p_names[1]
    else array_to_string(p_names[1:array_length(p_names, 1) - 1], ', ') || ' and ' || p_names[array_length(p_names, 1)]
  end;
$$;

create function private.sms_school_name(p_school_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(ss.sms_name, s.name)
  from public.schools s
  left join public.school_settings ss on ss.school_id = s.id
  where s.id = p_school_id;
$$;

create function private.sms_balance(p_school_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(amount), 0)::integer from public.sms_credit_entries where school_id = p_school_id;
$$;

-- Queues one message. Charged messages need enough credits, otherwise they are
-- kept with status "no_credit" (visible to admins) and not sent.
create function private.queue_sms(
  p_school_id uuid,
  p_kind public.sms_kind,
  p_phone text,
  p_body text,
  p_guardian_id uuid default null,
  p_message_id bigint default null,
  p_created_by uuid default null
)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_body text := private.sms_clean(p_body);
  v_segments smallint := private.sms_segments(private.sms_clean(p_body));
  v_free boolean := p_kind = 'system';
  v_status public.sms_status := 'queued';
  v_id bigint;
begin
  -- One school at a time, so two messages cannot spend the same credits.
  perform pg_advisory_xact_lock(hashtextextended('sms-credits:' || p_school_id::text, 0));
  if not v_free and private.sms_balance(p_school_id) < v_segments then
    v_status := 'no_credit';
  end if;

  insert into public.sms_outbox
    (school_id, kind, to_phone, guardian_id, message_id, body, segments, credits, status, send_after, created_by)
  values
    (p_school_id, p_kind, p_phone, p_guardian_id, p_message_id, v_body, v_segments,
     case when v_free or v_status = 'no_credit' then 0 else v_segments end,
     v_status, private.sms_send_time(), p_created_by)
  returning id into v_id;

  if not v_free and v_status = 'queued' then
    insert into public.sms_credit_entries (school_id, amount, reason, sms_id)
    values (p_school_id, -v_segments, 'SMS', v_id);
  end if;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Attendance alerts
-- ---------------------------------------------------------------------------

-- Alerts wait this long after a register is submitted or closes, so teachers
-- can fix mistakes before parents are told.
create function private.alert_grace()
returns interval
language sql
immutable
as $$ select interval '15 minutes' $$;

-- Registers whose grace period has passed: queue an alert per guardian.
-- Only today's registers send alerts (older ones, such as imported history,
-- are just marked as done).
create function private.queue_attendance_alerts()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
  v_more integer := 0;
  v_ready uuid[];
begin
  select coalesce(array_agg(r.id), '{}') into v_ready
  from public.registers r
  where r.alerts_queued_at is null
    and r.status in ('submitted', 'closed')
    and coalesce(r.submitted_at, r.closed_at, r.closes_at) + private.alert_grace() <= now();

  if array_length(v_ready, 1) is null then
    return 0;
  end if;

  -- Daily registers: absent and late, and present for the one chosen guardian.
  insert into private.attendance_alerts (school_id, register_id, student_id, guardian_id, kind)
  select r.school_id, r.id, e.student_id, l.guardian_id, e.mark::text
  from public.registers r
  join public.schools s on s.id = r.school_id and s.status = 'verified'
  join public.school_settings ss on ss.school_id = r.school_id
  join public.register_entries e on e.register_id = r.id
  join public.students st on st.id = e.student_id and st.status = 'active'
  join public.guardian_links l on l.student_id = e.student_id and l.alerts_enabled
  where r.id = any (v_ready)
    and r.class_subject_id is null
    and r.register_date = private.ghana_today()
    and (
      (e.mark in ('absent', 'late') and ss.sms_absence_alerts)
      or (e.mark = 'present' and ss.sms_present_alerts and l.receives_present_alerts)
    )
  on conflict on constraint attendance_alerts_once do nothing;
  get diagnostics v_count = row_count;

  -- Period registers: only the first period a child misses each day. Later
  -- periods and late marks show in reports, so a guardian is not sent ten SMS.
  insert into private.attendance_alerts (school_id, register_id, student_id, guardian_id, kind)
  select distinct on (e.student_id, l.guardian_id)
         r.school_id, r.id, e.student_id, l.guardian_id, 'absent'
  from public.registers r
  join public.schools s on s.id = r.school_id and s.status = 'verified'
  join public.school_settings ss on ss.school_id = r.school_id and ss.sms_absence_alerts
  join public.register_entries e on e.register_id = r.id and e.mark = 'absent'
  join public.students st on st.id = e.student_id and st.status = 'active'
  join public.guardian_links l on l.student_id = e.student_id and l.alerts_enabled
  where r.id = any (v_ready)
    and r.class_subject_id is not null
    and r.register_date = private.ghana_today()
    and not exists (
      select 1 from private.attendance_alerts a
      join public.registers r2 on r2.id = a.register_id
      where a.student_id = e.student_id and a.guardian_id = l.guardian_id
        and a.kind = 'absent' and r2.register_date = r.register_date
    )
  order by e.student_id, l.guardian_id, r.period_number
  on conflict on constraint attendance_alerts_once do nothing;
  get diagnostics v_more = row_count;
  v_count := v_count + v_more;

  update public.registers set alerts_queued_at = now() where id = any (v_ready);
  return v_count;
end;
$$;

-- After alerts went out: a child marked absent who turns up gets an "arrived"
-- update; a child marked absent late in the day gets an absent alert.
create function private.attendance_change_alert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_register public.registers;
begin
  select * into v_register from public.registers where id = new.register_id;
  if v_register.alerts_queued_at is null or v_register.register_date <> private.ghana_today() then
    return new;
  end if;
  if not exists (
    select 1 from public.schools s join public.school_settings ss on ss.school_id = s.id
    where s.id = v_register.school_id and s.status = 'verified' and ss.sms_absence_alerts
  ) then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.mark = 'absent' and new.mark in ('present', 'late') then
    insert into private.attendance_alerts (school_id, register_id, student_id, guardian_id, kind)
    select new.school_id, new.register_id, new.student_id, l.guardian_id, 'arrived'
    from public.guardian_links l
    where l.student_id = new.student_id and l.alerts_enabled
      -- Only if they were told the child was absent.
      and exists (select 1 from private.attendance_alerts a
                  where a.register_id = new.register_id and a.student_id = new.student_id
                    and a.guardian_id = l.guardian_id and a.kind = 'absent')
    on conflict on constraint attendance_alerts_once do nothing;
  elsif new.mark = 'absent' and (tg_op = 'INSERT' or old.mark <> 'absent') then
    insert into private.attendance_alerts (school_id, register_id, student_id, guardian_id, kind)
    select new.school_id, new.register_id, new.student_id, l.guardian_id, 'absent'
    from public.guardian_links l
    where l.student_id = new.student_id and l.alerts_enabled
      -- Period registers: only if they have not been told about today already.
      and not exists (
        select 1 from private.attendance_alerts a
        join public.registers r2 on r2.id = a.register_id
        where a.student_id = new.student_id and a.guardian_id = l.guardian_id
          and a.kind = 'absent' and r2.register_date = v_register.register_date
      )
    on conflict on constraint attendance_alerts_once do nothing;
  end if;
  return new;
end;
$$;

create trigger register_entries_alerts after insert or update of mark on public.register_entries
  for each row execute function private.attendance_change_alert();

-- Turns waiting attendance alerts into one message per guardian.
create function private.build_attendance_sms()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  g record;
  v_items text[];
  v_names text[];
  v_body text;
  v_prefix text;
  v_count integer := 0;
  v_sms bigint;
begin
  for g in
    select a.school_id, a.guardian_id, gu.phone, array_agg(a.id order by a.id) as alert_ids
    from private.attendance_alerts a
    join public.guardians gu on gu.id = a.guardian_id
    where a.done_at is null
    group by a.school_id, a.guardian_id, gu.phone
  loop
    select
      array_agg(
        case a.kind
          when 'absent' then st.full_name || ' was absent'
            || coalesce(' from ' || sub.name || ' (period ' || r.period_number || ')', ' from school')
          when 'late' then st.full_name || ' was late'
            || coalesce(' for ' || sub.name || ' (period ' || r.period_number || ')', ' to school')
          when 'present' then st.full_name || ' is in school'
          when 'arrived' then st.full_name || ' has now arrived'
            || coalesce(' for ' || sub.name, ' at school')
            || ' (' || to_char(now() at time zone 'Africa/Accra', 'FMHH12:MIam') || ')'
        end
        order by st.full_name, r.period_number nulls first
      ),
      array_agg(distinct split_part(st.full_name, ' ', 1))
    into v_items, v_names
    from private.attendance_alerts a
    join public.students st on st.id = a.student_id
    join public.registers r on r.id = a.register_id
    left join public.class_subjects cs on cs.id = r.class_subject_id
    left join public.subjects sub on sub.id = cs.subject_id
    where a.id = any (g.alert_ids);

    v_prefix := private.sms_school_name(g.school_id) || ', '
      || to_char(now() at time zone 'Africa/Accra', 'FMDD Mon') || ': ';
    v_body := v_prefix || array_to_string(v_items, '; ') || '.';
    -- Too long for one SMS: summarise instead.
    if private.sms_segments(private.sms_clean(v_body)) > 1 and array_length(v_items, 1) > 1 then
      v_body := v_prefix || array_length(v_items, 1) || ' attendance updates for '
        || private.join_names(v_names) || '. Please contact the school for details.';
    end if;

    v_sms := private.queue_sms(g.school_id, 'attendance', g.phone, v_body, g.guardian_id);
    update private.attendance_alerts set sms_id = v_sms, done_at = now() where id = any (g.alert_ids);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- System messages from guardian changes (free)
-- ---------------------------------------------------------------------------

create function private.build_system_sms()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  e record;
  v_school text;
  v_body text;
  v_count integer := 0;
begin
  -- Changes made in unverified schools are recorded but never texted.
  update public.guardian_events ge set processed_at = now()
  where ge.processed_at is null
    and not exists (select 1 from public.schools s where s.id = ge.school_id and s.status = 'verified');

  -- Wait a minute so several changes for one guardian travel together.
  for e in
    select ge.school_id, ge.kind, ge.phone, max(ge.previous_phone) as previous_phone,
           array_agg(distinct ge.student_name) filter (where ge.student_name is not null) as students,
           array_agg(ge.id) as event_ids
    from public.guardian_events ge
    where ge.processed_at is null and ge.created_at <= now() - interval '1 minute'
    group by ge.school_id, ge.kind, ge.phone
  loop
    v_school := private.sms_school_name(e.school_id);
    v_body := case e.kind
      when 'guardian_added' then
        v_school || ': You have been added as a guardian of ' || private.join_names(e.students)
        || '. You will get attendance messages by SMS from the school.'
      when 'guardian_removed' then
        v_school || ': You have been removed as a guardian of ' || private.join_names(e.students)
        || '. You will no longer get attendance messages about them.'
      when 'alerts_off' then
        v_school || ': Attendance SMS for ' || private.join_names(e.students)
        || ' have been turned off. Contact the school to turn them back on.'
      when 'alerts_on' then
        v_school || ': Attendance SMS for ' || private.join_names(e.students) || ' are on again.'
      when 'phone_changed' then
        v_school || ': The school will now send messages about your children to this number.'
    end;
    perform private.queue_sms(e.school_id, 'system', e.phone, v_body);

    -- The old number is told too.
    if e.kind = 'phone_changed' and e.previous_phone is not null then
      perform private.queue_sms(e.school_id, 'system', e.previous_phone,
        v_school || ': This number will no longer get messages about your children. The school now has a new number for you.');
    end if;

    update public.guardian_events set processed_at = now() where id = any (e.event_ids);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Broadcasts and custom messages
-- ---------------------------------------------------------------------------

-- Guardians a broadcast would reach: every guardian who allows broadcasts and
-- has an active child in the school (or in the chosen classes).
create function private.broadcast_guardians(p_school_id uuid, p_class_ids uuid[])
returns table (guardian_id uuid, phone text)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct g.id, g.phone
  from public.guardians g
  join public.guardian_links l on l.guardian_id = g.id
  join public.students st on st.id = l.student_id and st.status = 'active'
  where g.school_id = p_school_id
    and g.broadcasts_enabled
    and (p_class_ids is null or cardinality(p_class_ids) = 0 or st.class_id = any (p_class_ids));
$$;

-- How many guardians and credits a broadcast would take (for the compose screen).
create function public.broadcast_preview(p_school_id uuid, p_body text, p_class_ids uuid[] default null)
returns table (recipients integer, segments smallint, credits integer, balance integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_full text := private.sms_clean(private.sms_school_name(p_school_id) || ': ' || coalesce(p_body, ''));
begin
  if not private.is_school_admin(p_school_id) then
    raise exception 'Only admins send broadcasts.' using errcode = '42501';
  end if;
  return query
  select count(*)::integer, private.sms_segments(v_full),
         (count(*) * private.sms_segments(v_full))::integer, private.sms_balance(p_school_id)
  from private.broadcast_guardians(p_school_id, p_class_ids);
end;
$$;

create function public.send_broadcast(p_school_id uuid, p_body text, p_class_ids uuid[] default null)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_body text;
  v_segments smallint;
  v_recipients integer;
  v_message bigint;
  v_audience text;
  g record;
begin
  if not private.is_school_admin(p_school_id) then
    raise exception 'Only admins send broadcasts.' using errcode = '42501';
  end if;
  if (select status from public.schools where id = p_school_id) <> 'verified' then
    raise exception 'Your school must be verified by RollCol before it can send SMS.' using errcode = 'P0001';
  end if;
  if char_length(btrim(coalesce(p_body, ''))) < 5 then
    raise exception 'Write the message first.' using errcode = '23514';
  end if;

  v_body := private.sms_school_name(p_school_id) || ': ' || btrim(p_body);
  v_segments := private.sms_segments(private.sms_clean(v_body));
  if v_segments > 3 then
    raise exception 'Keep the message to 3 SMS (about 450 characters).' using errcode = '23514';
  end if;

  select count(*) into v_recipients from private.broadcast_guardians(p_school_id, p_class_ids);
  if v_recipients = 0 then
    raise exception 'No guardians would get this message.' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('sms-credits:' || p_school_id::text, 0));
  if private.sms_balance(p_school_id) < v_recipients * v_segments then
    raise exception 'This message needs % SMS credits, but the school has %.',
      v_recipients * v_segments, private.sms_balance(p_school_id) using errcode = 'P0001';
  end if;

  select case when p_class_ids is null or cardinality(p_class_ids) = 0 then 'All guardians'
              else string_agg(c.name, ', ' order by c.name) end
  into v_audience
  from public.classes c where c.id = any (coalesce(p_class_ids, '{}')) and c.school_id = p_school_id;

  insert into public.sms_messages (school_id, kind, body, audience, recipients, created_by)
  values (p_school_id, 'broadcast', btrim(p_body), coalesce(v_audience, 'All guardians'), v_recipients, auth.uid())
  returning id into v_message;

  for g in select * from private.broadcast_guardians(p_school_id, p_class_ids) loop
    perform private.queue_sms(p_school_id, 'broadcast', g.phone, v_body, g.guardian_id, v_message, auth.uid());
  end loop;
  return v_recipients;
end;
$$;

-- A message to one student's guardians, from an admin or one of the student's teachers.
-- It reaches the guardians who get that child's attendance SMS.
create function public.send_student_message(p_student_id uuid, p_body text)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_student public.students;
  v_body text;
  v_segments smallint;
  v_recipients integer;
  v_message bigint;
  g record;
begin
  select * into v_student from public.students where id = p_student_id;
  if v_student.id is null then
    raise exception 'Student not found.' using errcode = 'P0002';
  end if;
  if not (private.is_school_admin(v_student.school_id) or private.teaches_student(v_student.id)) then
    raise exception 'Only admins and this student''s teachers can message their guardians.' using errcode = '42501';
  end if;
  if (select status from public.schools where id = v_student.school_id) <> 'verified' then
    raise exception 'Your school must be verified by RollCol before it can send SMS.' using errcode = 'P0001';
  end if;
  if char_length(btrim(coalesce(p_body, ''))) < 5 then
    raise exception 'Write the message first.' using errcode = '23514';
  end if;

  v_body := private.sms_school_name(v_student.school_id) || ': ' || btrim(p_body);
  v_segments := private.sms_segments(private.sms_clean(v_body));
  if v_segments > 3 then
    raise exception 'Keep the message to 3 SMS (about 450 characters).' using errcode = '23514';
  end if;

  select count(*) into v_recipients
  from public.guardian_links l where l.student_id = v_student.id and l.alerts_enabled;
  if v_recipients = 0 then
    raise exception 'This student has no guardians who receive SMS.' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('sms-credits:' || v_student.school_id::text, 0));
  if private.sms_balance(v_student.school_id) < v_recipients * v_segments then
    raise exception 'This message needs % SMS credits, but the school has %.',
      v_recipients * v_segments, private.sms_balance(v_student.school_id) using errcode = 'P0001';
  end if;

  insert into public.sms_messages (school_id, kind, body, audience, student_id, recipients, created_by)
  values (v_student.school_id, 'custom', btrim(p_body), 'Guardians of ' || v_student.full_name, v_student.id,
          v_recipients, auth.uid())
  returning id into v_message;

  for g in
    select gu.id, gu.phone from public.guardian_links l
    join public.guardians gu on gu.id = l.guardian_id
    where l.student_id = v_student.id and l.alerts_enabled
  loop
    perform private.queue_sms(v_student.school_id, 'custom', g.phone, v_body, g.id, v_message, auth.uid());
  end loop;
  return v_recipients;
end;
$$;

-- Credits left, for admins.
create function public.sms_credit_balance(p_school_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (private.is_school_admin(p_school_id) or private.is_platform_admin()) then
    raise exception 'Only admins can see SMS credits.' using errcode = '42501';
  end if;
  return private.sms_balance(p_school_id);
end;
$$;

-- The platform owner adds (or takes back) credits. Plans and payments come in Part 7.
create function public.grant_sms_credits(p_school_id uuid, p_amount integer, p_reason text)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not private.is_platform_admin() then
    raise exception 'Only the RollCol owner can add credits.' using errcode = '42501';
  end if;
  if p_amount = 0 or abs(p_amount) > 1000000 then
    raise exception 'Enter a number of credits.' using errcode = '23514';
  end if;
  insert into public.sms_credit_entries (school_id, amount, reason, created_by)
  values (p_school_id, p_amount, coalesce(nullif(btrim(p_reason), ''), 'Added by RollCol'), auth.uid());
  return private.sms_balance(p_school_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- For the sender (service role only)
-- ---------------------------------------------------------------------------

-- Takes up to p_limit due messages and marks them as sending.
create function public.claim_sms(p_limit integer default 50)
returns table (id bigint, to_phone text, body text)
language sql
volatile
security definer
set search_path = ''
as $$
  update public.sms_outbox o
  set status = 'sending', attempts = o.attempts + 1
  where o.id in (
    select q.id from public.sms_outbox q
    where q.status = 'queued' and q.send_after <= now()
    order by q.send_after, q.id
    limit greatest(1, least(p_limit, 200))
    for update skip locked
  )
  returning o.id, o.to_phone, o.body;
$$;

-- Records what happened. Failures are retried twice, five minutes apart; a
-- message that finally fails gets its credits back.
create function public.finish_sms(p_id bigint, p_ok boolean, p_provider_id text default null, p_error text default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_sms public.sms_outbox;
begin
  select * into v_sms from public.sms_outbox where id = p_id for update;
  if v_sms.id is null then
    return;
  end if;
  if p_ok then
    update public.sms_outbox
    set status = 'sent', sent_at = now(), provider_id = left(p_provider_id, 200), error = null
    where id = p_id;
  elsif v_sms.attempts < 3 then
    update public.sms_outbox
    set status = 'queued', send_after = private.sms_send_time(now() + interval '5 minutes'), error = left(p_error, 500)
    where id = p_id;
  else
    update public.sms_outbox set status = 'failed', error = left(p_error, 500) where id = p_id;
    if v_sms.credits > 0 then
      insert into public.sms_credit_entries (school_id, amount, reason, sms_id)
      values (v_sms.school_id, v_sms.credits, 'Refund for a failed SMS', v_sms.id);
    end if;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- The every-minute job
-- ---------------------------------------------------------------------------

create function private.run_sms_pipeline()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  perform private.queue_attendance_alerts();
  perform private.build_attendance_sms();
  perform private.build_system_sms();

  -- Messages stuck in "sending" (the sender stopped part way) go back in the queue.
  update public.sms_outbox set status = 'queued'
  where status = 'sending' and updated_at < now() - interval '10 minutes';

  -- Wake the sender if anything is due.
  select value into v_url from private.config where key = 'sms_sender_url';
  select value into v_secret from private.config where key = 'cron_secret';
  if v_url is not null and v_secret is not null
     and exists (select 1 from public.sms_outbox where status = 'queued' and send_after <= now()) then
    perform net.http_post(
      url := v_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
  end if;
end;
$$;

select cron.schedule('sms-pipeline', '* * * * *', $$select private.run_sms_pipeline()$$);

-- ---------------------------------------------------------------------------
-- Platform owner: SMS credits beside each school
-- ---------------------------------------------------------------------------

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
  sms_sent_30_days bigint
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
            where o.school_id = s.id and o.status = 'sent' and o.sent_at > now() - interval '30 days')
    from public.schools s
    order by (s.status = 'unverified') desc, s.created_at desc;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on all functions in schema private from public, anon;
revoke all on function
  private.queue_sms(uuid, public.sms_kind, text, text, uuid, bigint, uuid),
  private.queue_attendance_alerts(),
  private.build_attendance_sms(),
  private.build_system_sms(),
  private.run_sms_pipeline(),
  private.broadcast_guardians(uuid, uuid[]),
  private.sms_balance(uuid)
from authenticated;

revoke all on function public.platform_schools() from public, anon;
grant execute on function public.platform_schools() to authenticated;

revoke all on function
  public.broadcast_preview(uuid, text, uuid[]),
  public.send_broadcast(uuid, text, uuid[]),
  public.send_student_message(uuid, text),
  public.sms_credit_balance(uuid),
  public.grant_sms_credits(uuid, integer, text),
  public.claim_sms(integer),
  public.finish_sms(bigint, boolean, text, text)
from public, anon, authenticated;

grant execute on function
  public.broadcast_preview(uuid, text, uuid[]),
  public.send_broadcast(uuid, text, uuid[]),
  public.send_student_message(uuid, text),
  public.sms_credit_balance(uuid),
  public.grant_sms_credits(uuid, integer, text)
to authenticated;

grant execute on function
  public.claim_sms(integer),
  public.finish_sms(bigint, boolean, text, text)
to service_role;
