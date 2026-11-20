-- The platform page shows the sender's last replies, so a problem such as a
-- wrong secret or a missing setting is visible without opening SQL Editor.
-- pg_net keeps each reply for about six hours.

create function public.platform_sms_sender_log()
returns table (replied_at timestamptz, status_code integer, reply text, error text, configured boolean, waiting integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_configured boolean := exists (select 1 from private.config where key = 'sms_sender_url')
                      and exists (select 1 from private.config where key = 'cron_secret');
  v_waiting integer := (select count(*) from public.sms_outbox
                        where status = 'queued' and send_after <= now() - interval '2 minutes')::integer;
begin
  if not private.is_platform_admin() then
    raise exception 'Only the RollCol team can do this.' using errcode = '42501';
  end if;
  return query
  select r.created, r.status_code, left(r.content, 300), left(r.error_msg, 300), v_configured, v_waiting
  from net._http_response r
  order by r.created desc
  limit 5;
  if not found then
    return query select null::timestamptz, null::integer, null::text, null::text, v_configured, v_waiting;
  end if;
end;
$$;

revoke all on function public.platform_sms_sender_log() from public, anon;
grant execute on function public.platform_sms_sender_log() to authenticated;
