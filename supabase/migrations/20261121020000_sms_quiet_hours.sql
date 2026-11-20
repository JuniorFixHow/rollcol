-- Quiet hours become a school setting.
--
-- Until now no SMS went out between 21:00 and 07:00 for every school. Schools
-- with evening classes, or that want alerts at a set time, now choose their own
-- hours on the Settings page, or turn quiet hours off. Messages that would fall
-- inside the quiet hours wait until they end.

alter table public.school_settings
  add column sms_quiet_hours boolean not null default true,
  add column sms_quiet_start time not null default '21:00',
  add column sms_quiet_end time not null default '07:00',
  add constraint school_settings_quiet_hours check (sms_quiet_start <> sms_quiet_end);

grant update (sms_quiet_hours, sms_quiet_start, sms_quiet_end) on public.school_settings to authenticated;

-- The next time a school may send: now, unless that is inside its quiet hours,
-- then when they end. Quiet hours can run past midnight (21:00 to 07:00) or
-- sit within one day (13:00 to 14:00).
create function private.sms_send_time(p_school_id uuid, p_at timestamptz default now())
returns timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_on boolean;
  v_start time;
  v_end time;
  v_local timestamp := p_at at time zone 'Africa/Accra';
  v_time time := (p_at at time zone 'Africa/Accra')::time;
  v_day date := (p_at at time zone 'Africa/Accra')::date;
begin
  select sms_quiet_hours, sms_quiet_start, sms_quiet_end into v_on, v_start, v_end
  from public.school_settings where school_id = p_school_id;
  if not coalesce(v_on, false) then
    return p_at;
  end if;

  if v_start > v_end then
    -- Past midnight.
    if v_time >= v_start then
      return ((v_day + 1) + v_end) at time zone 'Africa/Accra';
    elsif v_time < v_end then
      return (v_day + v_end) at time zone 'Africa/Accra';
    end if;
  elsif v_time >= v_start and v_time < v_end then
    return (v_day + v_end) at time zone 'Africa/Accra';
  end if;
  return p_at;
end;
$$;

create or replace function private.queue_sms(
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
     v_status, private.sms_send_time(p_school_id), p_created_by)
  returning id into v_id;

  if not v_free and v_status = 'queued' then
    insert into public.sms_credit_entries (school_id, amount, reason, sms_id)
    values (p_school_id, -v_segments, 'SMS', v_id);
  end if;
  return v_id;
end;
$$;

create or replace function public.finish_sms(p_id bigint, p_ok boolean, p_provider_id text default null, p_error text default null)
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
    set status = 'queued', send_after = private.sms_send_time(v_sms.school_id, now() + interval '5 minutes'), error = left(p_error, 500)
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

drop function private.sms_send_time(timestamptz);

-- When a school changes its quiet hours, messages already waiting follow the new hours.
create function private.reschedule_waiting_sms()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.sms_outbox
  set send_after = private.sms_send_time(school_id)
  where school_id = new.school_id and status = 'queued';
  return new;
end;
$$;

create trigger school_settings_quiet_hours
  after update of sms_quiet_hours, sms_quiet_start, sms_quiet_end on public.school_settings
  for each row
  when (old.sms_quiet_hours is distinct from new.sms_quiet_hours
        or old.sms_quiet_start is distinct from new.sms_quiet_start
        or old.sms_quiet_end is distinct from new.sms_quiet_end)
  execute function private.reschedule_waiting_sms();

revoke all on function private.sms_send_time(uuid, timestamptz) from public, anon, authenticated;
revoke all on function private.reschedule_waiting_sms() from public, anon, authenticated;
