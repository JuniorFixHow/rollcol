-- Messages and notifications are separate lists.
--
-- A school message or attendance alert delivered in the app still alerts the
-- parent's phone like any notification, but it is listed only in Messages (with
-- its own unread count), not again in Notifications. Notifications keep the
-- notices about the parent's account and links.
--
-- Parents can delete messages from their own Messages list. The school's
-- record of the message is not touched.

-- ---------------------------------------------------------------------------
-- Notifications leave messages alone
-- ---------------------------------------------------------------------------

create or replace function public.mark_notifications_read(p_ids bigint[] default null)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.push_outbox set read_at = now()
  where user_id = (select auth.uid()) and read_at is null
    and (case when p_ids is null then not (data ? 'smsId') else id = any (p_ids) end);
$$;

create or replace function public.dismiss_notifications(p_ids bigint[] default null)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.push_outbox set dismissed_at = now(), read_at = coalesce(read_at, now())
  where user_id = (select auth.uid()) and dismissed_at is null
    and (case when p_ids is null then not (data ? 'smsId') else id = any (p_ids) end);
$$;

-- Opening Messages clears its unread count; opening one message clears its own.
create function public.mark_messages_read(p_sms_id bigint default null)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.push_outbox set read_at = now()
  where user_id = (select auth.uid()) and read_at is null and data ? 'smsId'
    and (p_sms_id is null or data ->> 'smsId' = p_sms_id::text);
$$;

-- ---------------------------------------------------------------------------
-- Parents delete messages from their list
-- ---------------------------------------------------------------------------

create table private.parent_hidden_messages (
  user_id uuid not null references auth.users (id) on delete cascade deferrable initially immediate,
  sms_id bigint not null references public.sms_outbox (id) on delete cascade deferrable initially immediate,
  hidden_at timestamptz not null default now(),
  primary key (user_id, sms_id)
);

drop function public.parent_messages(bigint, integer);

-- The parent's messages, newest first; or one message with p_id.
create function public.parent_messages(p_before bigint default null, p_limit integer default 50, p_id bigint default null)
returns table (id bigint, school_name text, kind text, body text, sent_at timestamptz, unread boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_phone text := private.my_phone();
begin
  if v_phone is null then
    raise exception 'Sign in with your phone number first.' using errcode = '42501';
  end if;
  return query
  select o.id, s.name, o.kind::text, o.body, coalesce(o.sent_at, o.send_after),
         exists (
           select 1 from public.push_outbox p
           where p.user_id = auth.uid() and p.data ? 'smsId' and p.data ->> 'smsId' = o.id::text and p.read_at is null
         )
  from public.sms_outbox o
  join public.schools s on s.id = o.school_id
  where o.to_phone = v_phone
    and (o.status = 'sent' or (o.status = 'in_app' and o.send_after <= now()))
    and o.school_id in (
      select pl.school_id from public.parent_links pl
      where pl.user_id = auth.uid() and pl.status = 'active' and private.parents_allowed(pl.school_id)
    )
    and not exists (select 1 from private.parent_hidden_messages h where h.user_id = auth.uid() and h.sms_id = o.id)
    and (p_id is null or o.id = p_id)
    and (p_before is null or o.id < p_before)
  order by o.id desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
end;
$$;

-- Deletes messages from the parent's list (all of them when p_ids is null).
create function public.parent_delete_messages(p_ids bigint[] default null)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if private.my_phone() is null then
    raise exception 'Sign in with your phone number first.' using errcode = '42501';
  end if;
  insert into private.parent_hidden_messages (user_id, sms_id)
  select auth.uid(), o.id from public.sms_outbox o
  where o.to_phone = private.my_phone()
    and o.school_id in (select pl.school_id from public.parent_links pl where pl.user_id = auth.uid())
    and (p_ids is null or o.id = any (p_ids))
  on conflict do nothing;
  get diagnostics v_count = row_count;
  -- Their notifications count as read too.
  update public.push_outbox set read_at = coalesce(read_at, now()), dismissed_at = coalesce(dismissed_at, now())
  where user_id = auth.uid() and data ? 'smsId'
    and (data ->> 'smsId')::bigint in (select h.sms_id from private.parent_hidden_messages h where h.user_id = auth.uid());
  return v_count;
end;
$$;

revoke execute on function public.parent_messages(bigint, integer, bigint), public.parent_delete_messages(bigint[]),
  public.mark_messages_read(bigint)
from public, anon;
grant execute on function public.parent_messages(bigint, integer, bigint), public.parent_delete_messages(bigint[]),
  public.mark_messages_read(bigint)
to authenticated;
