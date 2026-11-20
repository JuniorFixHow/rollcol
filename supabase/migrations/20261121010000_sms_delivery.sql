-- Delivery reports from the SMS provider (Sailup).
--
-- "sent" means the provider accepted the message. The phone network reports
-- later whether it reached the phone; the sms-delivery Edge Function receives
-- that report and records it here. Messages in test mode stay without a report.

create type public.sms_delivery as enum ('pending', 'delivered', 'failed', 'expired', 'rejected');

alter table public.sms_outbox
  add column delivery public.sms_delivery,
  add column delivered_at timestamptz;

create index sms_outbox_provider_idx on public.sms_outbox (provider_id) where provider_id is not null;

-- A sent message waits for its report, except in test mode.
create or replace function private.sms_outbox_delivery_pending()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'sent' and old.status <> 'sent' and new.provider_id is distinct from 'test' then
    new.delivery := 'pending';
  end if;
  return new;
end;
$$;

create trigger sms_outbox_delivery_pending before update of status on public.sms_outbox
  for each row execute function private.sms_outbox_delivery_pending();

-- Called by the sms-delivery Edge Function. Reports can arrive more than once
-- or out of order; "delivered" is final.
create function public.record_sms_delivery(p_provider_id text, p_delivery public.sms_delivery)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.sms_outbox
  set delivery = p_delivery,
      delivered_at = case when p_delivery = 'delivered' then now() else delivered_at end
  where provider_id = p_provider_id
    and delivery is distinct from 'delivered';
  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;

revoke all on function public.record_sms_delivery(text, public.sms_delivery) from public, anon, authenticated;
grant execute on function public.record_sms_delivery(text, public.sms_delivery) to service_role;
revoke all on function private.sms_outbox_delivery_pending() from public, anon, authenticated;

-- Guardians of a student whose most recent reported SMS did not reach the phone,
-- so admins and the student's teachers can check the number.
create function public.guardians_not_reached(p_student_id uuid)
returns table (guardian_id uuid, delivery public.sms_delivery, reported_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_school uuid := (select school_id from public.students where id = p_student_id);
begin
  if v_school is null or not (private.is_school_admin(v_school) or private.teaches_student(p_student_id)) then
    return;
  end if;
  return query
  select last.guardian_id, last.delivery, last.updated_at
  from (
    select distinct on (o.guardian_id) o.guardian_id, o.delivery, o.updated_at
    from public.sms_outbox o
    join public.guardian_links l on l.guardian_id = o.guardian_id and l.student_id = p_student_id
    where o.school_id = v_school and o.delivery is not null and o.delivery <> 'pending'
    order by o.guardian_id, o.sent_at desc
  ) as last
  where last.delivery <> 'delivered';
end;
$$;

revoke all on function public.guardians_not_reached(uuid) from public, anon;
grant execute on function public.guardians_not_reached(uuid) to authenticated;
