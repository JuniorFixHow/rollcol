-- Part 9b: attendance alerts and school messages reach parents in the app first.
--
-- Each guardian record has a channel, set by the school:
--   app_first (default): a push to the parent's RollCol app when they use it on
--     a phone; by SMS when they do not, or when the push cannot be delivered.
--   sms: SMS only (for example a parent without a smartphone).
--   app: the app only, never SMS.
-- A message delivered in the app is kept in sms_outbox with status 'in_app'
-- (no credits), so the school's history and the parent's Messages tab list
-- every message the same way. Its SMS is only sent, and charged, if the push
-- fails.
--
-- Parents choose which notifications they get (absences, arrivals, school
-- messages). A muted notification still appears in the app's Messages, and is
-- not sent by SMS instead.
--
-- Notifications and SMS are also sent the moment they are queued, instead of
-- waiting for the next minute's run.

-- ---------------------------------------------------------------------------
-- The guardian's channel
-- ---------------------------------------------------------------------------

create type public.guardian_channel as enum ('app_first', 'sms', 'app');

alter table public.guardians add column channel public.guardian_channel not null default 'app_first';

-- Where a message to this guardian goes now: 'app' or 'sms'.
create function private.guardian_route(p_guardian_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when g.channel = 'sms' then 'sms'
    when not private.parents_allowed(g.school_id) then 'sms'
    when g.channel = 'app' then 'app'
    when exists (
      select 1 from public.parent_links pl
      join public.push_tokens t on t.user_id = pl.user_id
      where pl.guardian_id = g.id and pl.status = 'active'
    ) then 'app'
    else 'sms'
  end
  from public.guardians g where g.id = p_guardian_id;
$$;

-- Sends a guardian's message the way their channel says: in the app (a push to
-- each linked parent account), or by SMS. Returns the sms_outbox id.
create function private.deliver_to_guardian(
  p_school_id uuid,
  p_kind public.sms_kind,
  p_phone text,
  p_body text,
  p_guardian_id uuid,
  p_message_id bigint,
  p_created_by uuid,
  p_alert_kind text
)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id bigint;
  v_body text := private.sms_clean(p_body);
  v_send_after timestamptz := private.sms_send_time(p_school_id);
  v_name text := private.sms_school_name(p_school_id);
  v_text text := v_body;
  r record;
begin
  -- The notification's title is the school, so drop the "School, 24 Nov: " or
  -- "School: " start that an SMS needs.
  if left(v_body, char_length(v_name)) = v_name then
    v_text := regexp_replace(substr(v_body, char_length(v_name) + 1), '^(, [0-9]{1,2} [A-Za-z]{3})?:\s*', '');
  end if;

  if p_guardian_id is null or coalesce(private.guardian_route(p_guardian_id), 'sms') = 'sms' then
    return private.queue_sms(p_school_id, p_kind, p_phone, p_body, p_guardian_id, p_message_id, p_created_by);
  end if;

  insert into public.sms_outbox
    (school_id, kind, to_phone, guardian_id, message_id, body, segments, credits, status, send_after, created_by)
  values
    (p_school_id, p_kind, p_phone, p_guardian_id, p_message_id, v_body, private.sms_segments(v_body), 0, 'in_app',
     v_send_after, p_created_by)
  returning id into v_id;

  for r in
    select distinct pl.user_id from public.parent_links pl
    where pl.guardian_id = p_guardian_id and pl.status = 'active'
  loop
    insert into public.push_outbox (user_id, title, body, data, send_after)
    values (
      r.user_id,
      left(v_name, 100),
      left(v_text, 300),
      jsonb_build_object('smsId', v_id, 'alertKind', p_alert_kind),
      v_send_after
    );
  end loop;
  return v_id;
end;
$$;

create index push_outbox_sms_idx on public.push_outbox (((data ->> 'smsId'))) where data ? 'smsId';

-- A push that could not be delivered (no phone, or the app was removed): send
-- the SMS instead, for guardians on "app first", unless another of the
-- guardian's parent accounts got it or chose to mute it.
create function private.push_sms_fallback(p_sms_id bigint)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_sms public.sms_outbox;
  v_channel public.guardian_channel;
  v_credits smallint;
  v_status public.sms_status := 'queued';
begin
  select o.* into v_sms from public.sms_outbox o where o.id = p_sms_id and o.status = 'in_app' for update;
  if v_sms.id is null then
    return;
  end if;
  select g.channel into v_channel from public.guardians g where g.id = v_sms.guardian_id;
  if v_channel is distinct from 'app_first' then
    return;
  end if;
  if exists (
    select 1 from public.push_outbox p
    where p.data ? 'smsId' and p.data ->> 'smsId' = p_sms_id::text
      and p.status in ('queued', 'sending', 'sent', 'muted')
  ) then
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('sms-credits:' || v_sms.school_id::text, 0));
  v_credits := case when v_sms.kind = 'system' then 0 else v_sms.segments end;
  if v_credits > 0 and private.sms_balance(v_sms.school_id) < v_credits then
    v_status := 'no_credit';
    v_credits := 0;
  end if;
  update public.sms_outbox
  set status = v_status, credits = v_credits, send_after = private.sms_send_time(v_sms.school_id)
  where id = v_sms.id;
  if v_status = 'queued' and v_credits > 0 then
    insert into public.sms_credit_entries (school_id, amount, reason, sms_id)
    values (v_sms.school_id, -v_credits, 'SMS', v_sms.id);
  end if;
end;
$$;

create function private.on_push_undelivered()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.push_sms_fallback((new.data ->> 'smsId')::bigint);
  return new;
end;
$$;

create trigger push_outbox_sms_fallback
  after update of status on public.push_outbox
  for each row
  when (new.status in ('failed', 'no_device') and old.status is distinct from new.status and new.data ? 'smsId')
  execute function private.on_push_undelivered();

-- The school changes a guardian's channel; the guardian is told on both the
-- old and the new way, so nobody silently stops getting alerts.
create function public.set_guardian_channel(p_guardian_id uuid, p_channel public.guardian_channel)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_guardian public.guardians;
  v_school text;
  v_text text;
  r record;
begin
  select * into v_guardian from public.guardians where id = p_guardian_id;
  if v_guardian.id is null or not private.can_manage_guardian(p_guardian_id) then
    raise exception 'You cannot change this guardian.' using errcode = '42501';
  end if;
  if p_channel is null or v_guardian.channel = p_channel then
    return;
  end if;
  update public.guardians set channel = p_channel where id = p_guardian_id;

  v_school := private.sms_school_name(v_guardian.school_id);
  v_text := case p_channel
    when 'app_first' then 'From now on we send attendance alerts and messages to your RollCol app, and by SMS when the app cannot be reached.'
    when 'sms' then 'From now on we send attendance alerts and messages by SMS only.'
    else 'From now on we send attendance alerts and messages only in the RollCol app. Install RollCol and sign in with this number to get them.'
  end;

  if private.plan_allows(v_guardian.school_id, 'sms') then
    perform private.queue_sms(v_guardian.school_id, 'system', v_guardian.phone, v_school || ': ' || v_text, v_guardian.id);
  end if;
  for r in select distinct pl.user_id from public.parent_links pl where pl.guardian_id = p_guardian_id and pl.status = 'active' loop
    perform private.queue_push(r.user_id, left(v_school, 100), v_text, '{}'::jsonb);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Alerts and messages use the channel
-- ---------------------------------------------------------------------------

-- Swaps exact pieces of existing functions, and stops if one is not found.
create function private.swap_in_function(p_function regprocedure, p_old text, p_new text, p_times integer default 1)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_source text := pg_get_functiondef(p_function);
  v_found integer := (char_length(v_source) - char_length(replace(v_source, p_old, ''))) / char_length(p_old);
begin
  if v_found <> p_times then
    raise exception 'Expected % of "%" in %, found %.', p_times, p_old, p_function, v_found;
  end if;
  execute replace(v_source, p_old, p_new);
end;
$$;

select private.swap_in_function('private.build_attendance_sms()'::regprocedure,
  $old$v_sms := private.queue_sms(g.school_id, 'attendance', g.phone, v_body, g.guardian_id);$old$,
  $new$v_sms := private.deliver_to_guardian(g.school_id, 'attendance', g.phone, v_body, g.guardian_id, null, null,
      (select case when bool_or(a.kind in ('absent', 'late')) then 'absences' else 'arrivals' end
       from private.attendance_alerts a where a.id = any (g.alert_ids)));$new$);

select private.swap_in_function('public.send_broadcast(uuid, text, uuid[])'::regprocedure,
  $old$perform private.queue_sms(p_school_id, 'broadcast', g.phone, v_body, g.guardian_id, v_message, auth.uid());$old$,
  $new$perform private.deliver_to_guardian(p_school_id, 'broadcast', g.phone, v_body, g.guardian_id, v_message, auth.uid(), 'messages');$new$);

-- Only guardians who will get an SMS need credits.
select private.swap_in_function('public.send_broadcast(uuid, text, uuid[])'::regprocedure,
  $old$if private.sms_balance(p_school_id) < v_recipients * v_segments then
    raise exception 'This message needs % SMS credits, but the school has %.',
      v_recipients * v_segments, private.sms_balance(p_school_id) using errcode = 'P0001';$old$,
  $new$if private.sms_balance(p_school_id) < v_segments * (select count(*) from private.broadcast_guardians(p_school_id, p_class_ids) bg
                                                          where coalesce(private.guardian_route(bg.guardian_id), 'sms') = 'sms') then
    raise exception 'This message needs % SMS credits, but the school has %.',
      v_segments * (select count(*) from private.broadcast_guardians(p_school_id, p_class_ids) bg
                    where coalesce(private.guardian_route(bg.guardian_id), 'sms') = 'sms'),
      private.sms_balance(p_school_id) using errcode = 'P0001';$new$);

select private.swap_in_function('public.send_student_message(uuid, text)'::regprocedure,
  $old$perform private.queue_sms(v_student.school_id, 'custom', g.phone, v_body, g.id, v_message, auth.uid());$old$,
  $new$perform private.deliver_to_guardian(v_student.school_id, 'custom', g.phone, v_body, g.id, v_message, auth.uid(), 'messages');$new$);

select private.swap_in_function('public.send_student_message(uuid, text)'::regprocedure,
  $old$if private.sms_balance(v_student.school_id) < v_recipients * v_segments then
    raise exception 'This message needs % SMS credits, but the school has %.',
      v_recipients * v_segments, private.sms_balance(v_student.school_id) using errcode = 'P0001';$old$,
  $new$if private.sms_balance(v_student.school_id) < v_segments * (select count(*) from public.guardian_links l
                                                                  where l.student_id = v_student.id and l.alerts_enabled
                                                                    and coalesce(private.guardian_route(l.guardian_id), 'sms') = 'sms') then
    raise exception 'This message needs % SMS credits, but the school has %.',
      v_segments * (select count(*) from public.guardian_links l
                    where l.student_id = v_student.id and l.alerts_enabled
                      and coalesce(private.guardian_route(l.guardian_id), 'sms') = 'sms'),
      private.sms_balance(v_student.school_id) using errcode = 'P0001';$new$);

-- Parents see messages delivered in the app as well as by SMS.
select private.swap_in_function('public.parent_messages(bigint, integer)'::regprocedure,
  $old$and o.status = 'sent'$old$,
  $new$and (o.status = 'sent' or (o.status = 'in_app' and o.send_after <= now()))$new$);

drop function private.swap_in_function(regprocedure, text, text, integer);

-- ---------------------------------------------------------------------------
-- Parent notification settings
-- ---------------------------------------------------------------------------

alter table public.notification_settings drop constraint notification_settings_kind_check;
alter table public.notification_settings add constraint notification_settings_kind_check
  check (kind in ('sessions', 'reminders', 'moves', 'absences', 'arrivals', 'messages'));

create or replace function private.push_kind(p_title text, p_data jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_data ? 'alertKind' and p_data ->> 'alertKind' in ('absences', 'arrivals', 'messages') then p_data ->> 'alertKind'
    when p_data ? 'moveId' then 'moves'
    when p_data ? 'sessionId' and p_title like '%: 5 minutes left' then 'reminders'
    when p_data ? 'sessionId' then 'sessions'
    else 'general'
  end;
$$;

create or replace function public.set_notification_setting(p_kind text, p_enabled boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if p_kind not in ('sessions', 'reminders', 'moves', 'absences', 'arrivals', 'messages') then
    raise exception 'This notification cannot be turned off.' using errcode = '22023';
  end if;
  insert into public.notification_settings (user_id, kind, enabled) values (auth.uid(), p_kind, coalesce(p_enabled, true))
  on conflict (user_id, kind) do update set enabled = excluded.enabled, updated_at = now();
end;
$$;

-- ---------------------------------------------------------------------------
-- Name check: only a real wrong name counts, and a correct one clears the count
-- ---------------------------------------------------------------------------

create or replace function public.parent_link_children(p_name text)
returns table (linked integer, pending integer, remaining integer)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user uuid := auth.uid();
  v_phone text := private.my_phone();
  v_key text := private.name_key(p_name);
  v_candidates integer;
  v_linked integer := 0;
  v_pending integer := 0;
  r record;
begin
  if v_user is null or v_phone is null then
    raise exception 'Sign in with your phone number first.' using errcode = '42501';
  end if;
  if char_length(v_key) < 2 or char_length(coalesce(p_name, '')) > 60 then
    raise exception 'Type one of your child''s names.' using errcode = '22023';
  end if;

  select count(*) into v_candidates
  from public.guardians g
  where g.phone = v_phone and private.parents_allowed(g.school_id)
    and not exists (select 1 from public.parent_links pl where pl.guardian_id = g.id and pl.user_id = v_user);
  if v_candidates = 0 then
    raise exception 'Your children are already linked at every school that has this number.' using errcode = 'P0001';
  end if;

  if (select count(*) from private.parent_link_attempts a
      where a.user_id = v_user and not a.matched and a.attempted_at > now() - interval '24 hours') >= 5 then
    raise exception 'Too many tries. Try again tomorrow, or ask the school to check your child''s name.'
      using errcode = 'P0001';
  end if;

  for r in
    select g.id as guardian_id, g.school_id, coalesce(ss.parent_link_approval, false) as needs_approval
    from public.guardians g
    left join public.school_settings ss on ss.school_id = g.school_id
    where g.phone = v_phone
      and private.parents_allowed(g.school_id)
      and not exists (select 1 from public.parent_links pl where pl.guardian_id = g.id and pl.user_id = v_user)
      and exists (
        select 1 from public.guardian_links gl
        join public.students st on st.id = gl.student_id and st.status = 'active'
        where gl.guardian_id = g.id
          and v_key = any (select private.name_key(w) from regexp_split_to_table(st.full_name, '\s+') w)
      )
  loop
    insert into public.parent_links (school_id, guardian_id, user_id, status)
    values (r.school_id, r.guardian_id, v_user, case when r.needs_approval then 'pending' else 'active' end::public.parent_link_status);
    if r.needs_approval then v_pending := v_pending + 1; else v_linked := v_linked + 1; end if;
  end loop;

  if v_linked + v_pending > 0 then
    -- A correct name: earlier typing mistakes no longer count.
    delete from private.parent_link_attempts where user_id = v_user and not matched;
  end if;
  insert into private.parent_link_attempts (user_id, matched) values (v_user, v_linked + v_pending > 0);

  return query select v_linked, v_pending, v_candidates - v_linked - v_pending;
end;
$$;

-- ---------------------------------------------------------------------------
-- Send at once instead of on the next minute
-- ---------------------------------------------------------------------------

-- Calls a sender Edge Function in the background (pg_net sends it after the
-- transaction commits, so a rolled-back insert sends nothing).
create function private.wake_sender(p_url_key text)
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
  select value into v_url from private.config where key = p_url_key;
  select value into v_secret from private.config where key = 'cron_secret';
  if v_url is not null and v_secret is not null then
    perform net.http_post(
      url := v_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
  end if;
end;
$$;

create function private.on_push_queued()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from new_rows where status = 'queued' and send_after <= now()) then
    perform private.wake_sender('push_sender_url');
  end if;
  return null;
end;
$$;

create trigger push_outbox_wake
  after insert on public.push_outbox
  referencing new table as new_rows
  for each statement
  execute function private.on_push_queued();

create function private.on_sms_queued()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from new_rows where status = 'queued' and send_after <= now()) then
    perform private.wake_sender('sms_sender_url');
  end if;
  return null;
end;
$$;

create trigger sms_outbox_wake
  after insert on public.sms_outbox
  referencing new table as new_rows
  for each statement
  execute function private.on_sms_queued();

-- A fallback SMS (an update, not an insert) is also sent at once.
create function private.on_sms_requeued()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from new_rows n join old_rows o on o.id = n.id
             where o.status = 'in_app' and n.status = 'queued' and n.send_after <= now()) then
    perform private.wake_sender('sms_sender_url');
  end if;
  return null;
end;
$$;

create trigger sms_outbox_wake_fallback
  after update on public.sms_outbox
  referencing old table as old_rows new table as new_rows
  for each statement
  execute function private.on_sms_requeued();

-- ---------------------------------------------------------------------------
-- For the message composer: guardians who get messages in the app (no credits)
-- ---------------------------------------------------------------------------

create function public.guardians_in_app(p_school_id uuid)
returns setof uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_school_staff(p_school_id) then
    raise exception 'You cannot see this school.' using errcode = '42501';
  end if;
  return query
  select g.id from public.guardians g
  where g.school_id = p_school_id and private.guardian_route(g.id) = 'app';
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke execute on function public.guardians_in_app(uuid) from public, anon;
grant execute on function public.guardians_in_app(uuid) to authenticated;

revoke execute on function public.set_guardian_channel(uuid, public.guardian_channel) from public, anon;
grant execute on function public.set_guardian_channel(uuid, public.guardian_channel) to authenticated;
