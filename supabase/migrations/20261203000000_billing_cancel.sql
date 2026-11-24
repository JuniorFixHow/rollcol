-- An admin can cancel a payment they started but did not finish, so it stops
-- showing as waiting. Paystack's confirmation still wins: apply_paystack_payment
-- turns a cancelled (failed) purchase into a paid one if the money arrives later.

create function public.cancel_purchase(p_purchase_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_purchase public.billing_purchases;
begin
  select * into v_purchase from public.billing_purchases where id = p_purchase_id;
  if v_purchase.id is null or not private.is_school_admin(v_purchase.school_id) then
    raise exception 'You cannot change this payment.' using errcode = '42501';
  end if;
  if v_purchase.status <> 'pending' then
    raise exception 'This payment is already %.', case v_purchase.status when 'paid' then 'paid' else 'closed' end
      using errcode = 'P0001';
  end if;
  update public.billing_purchases set status = 'failed', failure = 'Cancelled'
  where id = p_purchase_id and status = 'pending';
end;
$$;

revoke execute on function public.cancel_purchase(uuid) from public, anon;
grant execute on function public.cancel_purchase(uuid) to authenticated;
