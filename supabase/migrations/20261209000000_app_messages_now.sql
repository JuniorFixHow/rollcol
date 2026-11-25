-- The school's quiet hours ("Hold SMS during quiet hours" on Settings) are
-- for SMS. Until now they also held messages and alerts for parents who use
-- the app: an absence marked at 05:29 reached the app only at 07:00. In the
-- app a message now arrives at once. An SMS, including the SMS sent when a
-- push cannot be delivered, still waits for the quiet hours to end.

create or replace function private.deliver_to_guardian(
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
  -- Quiet hours hold SMS only. In the app it arrives at once; the parent's
  -- own phone settings decide whether it makes a sound.
  v_send_after timestamptz := now();
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

-- Release what is being held now.
update public.sms_outbox set send_after = now()
where status = 'in_app' and send_after > now();

update public.push_outbox set send_after = now()
where status = 'queued' and send_after > now() and data ? 'smsId';

revoke all on function private.deliver_to_guardian(uuid, public.sms_kind, text, text, uuid, bigint, uuid, text) from public, anon, authenticated;
