-- Part 8b: billing with Paystack.
--
-- Plans are paid per student, up front, for one term (basic and senior high
-- schools, classes workspaces) or one semester (tertiary, courses
-- workspaces). A plan covers its term's dates as they were when paid. When it
-- ends the school is back on the free plan until it pays again.
--
--   School type        Plan        Price per student   Adds
--   Basic or SHS       Free        GHS 0               up to 100 students, system SMS only
--                      Trial       GHS 0               4 weeks after verification: everything in Complete
--                      Alerts      GHS 3 per term      absence and late SMS
--                      Complete    GHS 6 per term      present SMS too, and 2 SMS credits per student
--   Tertiary           Free        GHS 0               up to 200 students
--                      Standard    GHS 3 per semester  more students
--   Classes workspace  Free        GHS 0               50 students across the owner's free workspaces, no SMS
--                      Alerts      GHS 4 per term      SMS (absence and late alerts, messages)
--   Courses workspace  Free        GHS 0               the same 50
--                      Standard    GHS 3 per semester  more students
--   SMS packs                      100 GHS 20, 500 GHS 90, 1,000 GHS 150
--
-- Every feature stays free; plans differ by students and SMS. Prices are in
-- pesewas and can be changed in private.config (key price_<plan>, for example
-- price_alerts = 300; trial_days; complete_credits_per_student; sms_packs as
-- JSON). Payments are confirmed only by Paystack (the paystack Edge Function,
-- which holds the secret key) through apply_paystack_payment.

-- ---------------------------------------------------------------------------
-- Prices and the catalogue
-- ---------------------------------------------------------------------------

create function private.config_int(p_key text, p_default integer)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select value::integer from private.config where key = p_key), p_default);
$$;

-- Plans and their price per student, in pesewas.
create function private.plan_price(p_plan text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case p_plan
    when 'alerts' then private.config_int('price_alerts', 300)
    when 'complete' then private.config_int('price_complete', 600)
    when 'standard' then private.config_int('price_standard', 300)
    when 'workspace_alerts' then private.config_int('price_workspace_alerts', 400)
    when 'workspace_standard' then private.config_int('price_workspace_standard', 300)
  end;
$$;

-- The plans a school can buy.
create function private.plans_for(p_school_id uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when s.is_workspace and s.type = 'tertiary' then array['workspace_standard']
    when s.is_workspace then array['workspace_alerts']
    when s.type = 'tertiary' then array['standard']
    else array['alerts', 'complete']
  end
  from public.schools s where s.id = p_school_id;
$$;

create function private.sms_packs()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select value::jsonb from private.config where key = 'sms_packs'),
    '[{"credits": 100, "price": 2000}, {"credits": 500, "price": 9000}, {"credits": 1000, "price": 15000}]'::jsonb
  );
$$;

-- Everything the pricing and billing pages show. Public: no school data.
create function public.billing_catalog()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'currency', 'GHS',
    'trialDays', private.config_int('trial_days', 28),
    'completeCreditsPerStudent', private.config_int('complete_credits_per_student', 2),
    'free', jsonb_build_object(
      'non_tertiary', private.free_student_limit('non_tertiary'),
      'tertiary', private.free_student_limit('tertiary'),
      'workspace', private.workspace_student_limit()
    ),
    'prices', jsonb_build_object(
      'alerts', private.plan_price('alerts'),
      'complete', private.plan_price('complete'),
      'standard', private.plan_price('standard'),
      'workspace_alerts', private.plan_price('workspace_alerts'),
      'workspace_standard', private.plan_price('workspace_standard')
    ),
    'packs', private.sms_packs()
  );
$$;

-- ---------------------------------------------------------------------------
-- Plans and purchases
-- ---------------------------------------------------------------------------

create table public.school_plans (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  plan text not null check (plan in ('alerts', 'complete', 'standard', 'workspace_alerts', 'workspace_standard')),
  academic_period_id uuid references public.academic_periods (id) on delete set null,
  period_name text not null,
  -- The term's dates when it was paid, so later changes to the term do not stretch the plan.
  starts_on date not null,
  ends_on date not null,
  students_paid integer not null check (students_paid > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, academic_period_id)
);
create index school_plans_school_idx on public.school_plans (school_id, ends_on);

create sequence private.receipt_numbers;

create table public.billing_purchases (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  kind text not null check (kind in ('plan', 'seats', 'upgrade', 'credits')),
  plan text,
  academic_period_id uuid references public.academic_periods (id) on delete set null,
  period_name text,
  students integer check (students is null or students > 0),
  credits integer check (credits is null or credits >= 0),
  amount integer not null check (amount > 0),
  currency text not null default 'GHS',
  description text not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  reference text not null unique,
  paystack_id text,
  channel text,
  receipt_number text unique,
  failure text,
  created_by uuid references auth.users (id) on delete set null,
  created_by_name text not null,
  email text not null,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index billing_purchases_school_idx on public.billing_purchases (school_id, created_at desc);

alter table public.school_plans enable row level security;
alter table public.billing_purchases enable row level security;
create policy "Admins see their school's plans" on public.school_plans
  for select to authenticated using (private.is_school_admin(school_id));
create policy "Admins see their school's payments" on public.billing_purchases
  for select to authenticated using (private.is_school_admin(school_id));
grant select on public.school_plans, public.billing_purchases to authenticated;

-- The paid plan covering a day, if any.
create function private.paid_plan(p_school_id uuid, p_day date default null)
returns public.school_plans
language sql
stable
security definer
set search_path = ''
as $$
  select p.* from public.school_plans p
  where p.school_id = p_school_id
    and coalesce(p_day, private.ghana_today()) between p.starts_on and p.ends_on
  order by p.ends_on desc
  limit 1;
$$;

-- The last day of a school's free trial (basic and SHS schools, from verification).
create function private.trial_ends_on(p_school_id uuid)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select (s.verified_at at time zone 'Africa/Accra')::date + private.config_int('trial_days', 28) - 1
  from public.schools s
  where s.id = p_school_id and not s.is_workspace and s.type = 'non_tertiary' and s.verified_at is not null;
$$;

-- What a school's plan allows today: 'sms' (any SMS from the school),
-- 'absence_alerts', 'present_alerts'.
create function private.plan_allows(p_school_id uuid, p_feature text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_school public.schools;
  v_plan text;
  v_trial boolean;
  v_sms boolean;
begin
  select * into v_school from public.schools where id = p_school_id;
  if v_school.id is null or v_school.status = 'suspended' then
    return false;
  end if;
  v_plan := (private.paid_plan(p_school_id)).plan;
  v_sms := case when v_school.is_workspace then v_plan = 'workspace_alerts' else v_school.status = 'verified' end;
  if not coalesce(v_sms, false) then
    return false;
  end if;
  v_trial := v_plan is null and private.ghana_today() <= coalesce(private.trial_ends_on(p_school_id), date '1900-01-01');
  return coalesce(case p_feature
    when 'sms' then true
    when 'absence_alerts' then v_trial or v_plan in ('alerts', 'complete', 'workspace_alerts')
    when 'present_alerts' then v_trial or v_plan = 'complete'
    else false
  end, false);
end;
$$;

-- Student limits now follow the paid plan.
create or replace function private.school_student_limit(p_school_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when s.is_workspace then (private.paid_plan(s.id)).students_paid
    when s.status = 'unverified' then private.unverified_limit('students')
    else coalesce(s.student_limit, (private.paid_plan(s.id)).students_paid, private.free_student_limit(s.type))
  end
  from public.schools s where s.id = p_school_id;
$$;

-- Students in a person's free (unpaid) workspaces, for the shared free limit.
create function private.workspace_pool_count(p_owner uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.students st join public.schools s on s.id = st.school_id
  where s.is_workspace and s.created_by = p_owner and st.status <> 'disabled'
    and (private.paid_plan(s.id)).id is null;
$$;

create or replace function private.enforce_school_limits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_school public.schools;
  v_count integer;
  v_limit integer;
begin
  if tg_op = 'UPDATE' then
    if tg_table_name <> 'students' or old.status <> 'disabled' or new.status = 'disabled' then
      return new;
    end if;
  end if;

  select * into v_school from public.schools where id = new.school_id;
  if v_school.status = 'suspended' then
    raise exception 'This school is suspended. Contact RollCol support.' using errcode = 'P0001';
  end if;

  -- A student joining in the app sees no plans or payments, only who to ask.
  if tg_table_name = 'students' and new.user_id is not null and new.user_id = auth.uid() then
    select count(*) into v_count from public.students where school_id = new.school_id and status <> 'disabled';
    v_limit := case when v_school.is_workspace
      then coalesce((private.paid_plan(v_school.id)).students_paid, private.workspace_student_limit())
      else private.school_student_limit(v_school.id) end;
    if (v_school.is_workspace and (private.paid_plan(v_school.id)).id is null
        and private.workspace_pool_count(v_school.created_by) >= private.workspace_student_limit())
       or (not (v_school.is_workspace and (private.paid_plan(v_school.id)).id is null) and v_count >= v_limit) then
      raise exception '% has no room for more students right now. Ask % to make room, then try again.',
        v_school.name, case when v_school.is_workspace then 'your lecturer' else 'your school' end using errcode = 'P0001';
    end if;
    return new;
  end if;

  if v_school.is_workspace then
    if tg_table_name = 'staff' then
      if exists (select 1 from public.staff where school_id = new.school_id) then
        raise exception 'A workspace is for one person. To work with colleagues, register a school.' using errcode = 'P0001';
      end if;
      return new;
    end if;
    v_limit := (private.paid_plan(v_school.id)).students_paid;
    if v_limit is not null then
      select count(*) into v_count from public.students where school_id = v_school.id and status <> 'disabled';
      if v_count >= v_limit then
        raise exception 'You paid for % students this %. Add more students on the Billing page first.',
          v_limit, case when v_school.type = 'tertiary' then 'semester' else 'term' end using errcode = 'P0001';
      end if;
    elsif private.workspace_pool_count(v_school.created_by) >= private.workspace_student_limit() then
      raise exception 'Free workspaces can have up to % students in all. Remove students you no longer teach, or choose a plan on the Billing page.',
        private.workspace_student_limit() using errcode = 'P0001';
    end if;
    return new;
  end if;

  if tg_table_name = 'staff' then
    if v_school.status = 'unverified' then
      select count(*) into v_count from public.staff where school_id = new.school_id;
      if v_count >= private.unverified_limit('staff') then
        raise exception 'Unverified schools can have up to % staff. RollCol will lift this limit when your school is verified.',
          private.unverified_limit('staff') using errcode = 'P0001';
      end if;
    end if;
    return new;
  end if;

  select count(*) into v_count from public.students where school_id = new.school_id and status <> 'disabled';
  v_limit := private.school_student_limit(v_school.id);
  if v_count >= v_limit then
    if v_school.status = 'unverified' then
      raise exception 'Unverified schools can have up to % students. RollCol will lift this limit when your school is verified.',
        v_limit using errcode = 'P0001';
    end if;
    if (private.paid_plan(v_school.id)).id is not null and v_school.student_limit is null then
      raise exception 'You paid for % students this %. Add more students on the Billing page first.',
        v_limit, case when v_school.type = 'tertiary' then 'semester' else 'term' end using errcode = 'P0001';
    end if;
    raise exception 'This school can have up to % students on the free plan. Turn off students who have left, or choose a plan on the Billing page.',
      v_limit using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create or replace function public.school_student_usage(p_school_id uuid)
returns table (used integer, student_limit integer, plan text)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_school public.schools;
  v_paid public.school_plans;
begin
  select * into v_school from public.schools where id = p_school_id;
  if v_school.id is null or not private.is_school_staff(p_school_id) then
    raise exception 'You cannot see this school.' using errcode = '42501';
  end if;
  v_paid := private.paid_plan(p_school_id);
  if v_school.is_workspace then
    if v_paid.id is not null then
      return query select (select count(*)::integer from public.students where school_id = p_school_id and status <> 'disabled'),
                          v_paid.students_paid, 'paid'::text;
    else
      return query select private.workspace_pool_count(v_school.created_by), private.workspace_student_limit(), 'workspace'::text;
    end if;
    return;
  end if;
  return query select
    (select count(*)::integer from public.students where school_id = p_school_id and status <> 'disabled'),
    private.school_student_limit(p_school_id),
    case
      when v_school.status = 'unverified' then 'unverified'
      when v_school.student_limit is not null then 'custom'
      when v_paid.id is not null then 'paid'
      else 'free'
    end;
end;
$$;

-- The billing page's summary.
create function public.school_billing(p_school_id uuid)
returns table (
  plan text,
  period_name text,
  starts_on date,
  ends_on date,
  students_paid integer,
  students_used integer,
  student_limit integer,
  trial_ends_on date,
  sms_allowed boolean,
  absence_alerts boolean,
  present_alerts boolean,
  sms_credits integer,
  plans text[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_paid public.school_plans;
  v_usage record;
begin
  if not private.is_school_admin(p_school_id) then
    raise exception 'Only admins can see billing.' using errcode = '42501';
  end if;
  v_paid := private.paid_plan(p_school_id);
  select * into v_usage from public.school_student_usage(p_school_id);
  return query select
    v_paid.plan, v_paid.period_name, v_paid.starts_on, v_paid.ends_on, v_paid.students_paid,
    v_usage.used, v_usage.student_limit,
    private.trial_ends_on(p_school_id),
    private.plan_allows(p_school_id, 'sms'),
    private.plan_allows(p_school_id, 'absence_alerts'),
    private.plan_allows(p_school_id, 'present_alerts'),
    private.sms_balance(p_school_id),
    private.plans_for(p_school_id);
end;
$$;

-- For the apps and menus: what the school can do with SMS now.
create function public.school_features(p_school_id uuid)
returns table (sms boolean, absence_alerts boolean, present_alerts boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not private.is_school_staff(p_school_id) then
    raise exception 'You cannot see this school.' using errcode = '42501';
  end if;
  return query select private.plan_allows(p_school_id, 'sms'), private.plan_allows(p_school_id, 'absence_alerts'),
                      private.plan_allows(p_school_id, 'present_alerts');
end;
$$;

-- ---------------------------------------------------------------------------
-- Quotes and purchases
-- ---------------------------------------------------------------------------

create function private.plan_label(p_plan text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_plan
    when 'alerts' then 'Alerts' when 'complete' then 'Complete' when 'standard' then 'Standard'
    when 'workspace_alerts' then 'Alerts' when 'workspace_standard' then 'Standard' else p_plan end;
$$;

-- Works out and checks one purchase. p_kind: 'plan' (p_plan, p_period_id,
-- p_students), 'seats' (p_period_id, p_students more), 'upgrade' (p_period_id,
-- to Complete) or 'credits' (p_students is the pack size).
create function public.billing_quote(
  p_school_id uuid,
  p_kind text,
  p_plan text default null,
  p_period_id uuid default null,
  p_students integer default null
)
returns table (amount integer, students integer, credits integer, plan text, period_name text, description text)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_school public.schools;
  v_period public.academic_periods;
  v_existing public.school_plans;
  v_active integer;
  v_word text;
  v_pack jsonb;
  v_credits_each integer := private.config_int('complete_credits_per_student', 2);
begin
  select * into v_school from public.schools where id = p_school_id;
  if v_school.id is null or not private.is_school_admin(p_school_id) then
    raise exception 'Only admins can pay for the school.' using errcode = '42501';
  end if;
  if v_school.status = 'suspended' then
    raise exception 'This school is suspended. Contact RollCol support.' using errcode = 'P0001';
  end if;
  v_word := case when v_school.type = 'tertiary' then 'semester' else 'term' end;

  if p_kind = 'credits' then
    if not private.plan_allows(p_school_id, 'sms') then
      raise exception '%', case when v_school.is_workspace
        then 'SMS credits are for workspaces on the Alerts plan.'
        else 'SMS credits are for verified schools.' end using errcode = 'P0001';
    end if;
    select pk into v_pack from jsonb_array_elements(private.sms_packs()) pk where (pk ->> 'credits')::integer = p_students;
    if v_pack is null then
      raise exception 'Choose one of the SMS packs.' using errcode = '22023';
    end if;
    return query select (v_pack ->> 'price')::integer, null::integer, (v_pack ->> 'credits')::integer, null::text, null::text,
      (v_pack ->> 'credits') || ' SMS credits';
    return;
  end if;

  if not v_school.is_workspace and v_school.status <> 'verified' then
    raise exception 'RollCol verifies your school first. Until then it stays on the free limits.' using errcode = 'P0001';
  end if;
  select * into v_period from public.academic_periods where id = p_period_id and school_id = p_school_id;
  if v_period.id is null then
    raise exception 'Choose the % to pay for. Add it under Academics first.', v_word using errcode = '22023';
  end if;
  if v_period.ends_on < private.ghana_today() then
    raise exception 'That % has ended.', v_word using errcode = 'P0001';
  end if;
  select * into v_existing from public.school_plans where school_id = p_school_id and academic_period_id = v_period.id;
  select count(*) into v_active from public.students where school_id = p_school_id and status <> 'disabled';

  if p_kind = 'plan' then
    if v_existing.id is not null then
      raise exception 'You already paid for %. Add students or upgrade instead.', v_period.name using errcode = 'P0001';
    end if;
    if p_plan is null or not (p_plan = any (private.plans_for(p_school_id))) then
      raise exception 'Choose a plan.' using errcode = '22023';
    end if;
    if coalesce(p_students, 0) < greatest(v_active, 1) then
      raise exception 'Pay for at least your % active students.', greatest(v_active, 1) using errcode = '22023';
    end if;
    if p_students > 100000 then
      raise exception 'Contact RollCol for more than 100,000 students.' using errcode = '22023';
    end if;
    return query select p_students * private.plan_price(p_plan), p_students,
      case when p_plan = 'complete' then p_students * v_credits_each else 0 end,
      p_plan, v_period.name,
      private.plan_label(p_plan) || ' plan for ' || v_period.name || ': ' || p_students || ' students';
    return;
  end if;

  if v_existing.id is null then
    raise exception 'Choose a plan for % first.', v_period.name using errcode = 'P0001';
  end if;

  if p_kind = 'seats' then
    if coalesce(p_students, 0) < 1 or p_students > 100000 then
      raise exception 'Enter how many more students.' using errcode = '22023';
    end if;
    return query select p_students * private.plan_price(v_existing.plan), p_students,
      case when v_existing.plan = 'complete' then p_students * v_credits_each else 0 end,
      v_existing.plan, v_period.name,
      p_students || ' more students on the ' || private.plan_label(v_existing.plan) || ' plan for ' || v_period.name;
    return;
  end if;

  if p_kind = 'upgrade' then
    if v_existing.plan <> 'alerts' then
      raise exception 'Only the Alerts plan can be upgraded, to Complete.' using errcode = 'P0001';
    end if;
    return query select v_existing.students_paid * (private.plan_price('complete') - private.plan_price('alerts')),
      v_existing.students_paid, v_existing.students_paid * v_credits_each, 'complete'::text, v_period.name,
      'Upgrade to Complete for ' || v_period.name || ': ' || v_existing.students_paid || ' students';
    return;
  end if;

  raise exception 'Unknown purchase.' using errcode = '22023';
end;
$$;

-- Records a purchase waiting for payment. The Edge Function then sends the
-- admin to Paystack with its reference and amount.
create function public.create_purchase(
  p_school_id uuid,
  p_kind text,
  p_plan text default null,
  p_period_id uuid default null,
  p_students integer default null
)
returns table (id uuid, reference text, amount integer)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_quote record;
  v_name text;
  v_email text;
  v_purchase public.billing_purchases;
begin
  select * into v_quote from public.billing_quote(p_school_id, p_kind, p_plan, p_period_id, p_students);
  select full_name into v_name from public.staff where school_id = p_school_id and user_id = auth.uid();
  select email into v_email from auth.users where id = auth.uid();
  insert into public.billing_purchases
    (school_id, kind, plan, academic_period_id, period_name, students, credits, amount, description, reference,
     created_by, created_by_name, email)
  values
    (p_school_id, p_kind, v_quote.plan, case when p_kind = 'credits' then null else p_period_id end, v_quote.period_name,
     v_quote.students, v_quote.credits, v_quote.amount, v_quote.description,
     'RC' || to_char(now(), 'YYMMDD') || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
     auth.uid(), coalesce(v_name, 'Admin'), coalesce(v_email, ''))
  returning * into v_purchase;
  return query select v_purchase.id, v_purchase.reference, v_purchase.amount;
end;
$$;

-- For the Edge Function, as the signed-in admin: the purchase to pay.
create function public.purchase_for_payment(p_purchase_id uuid)
returns table (reference text, amount integer, currency text, email text, school_id uuid, description text)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_purchase public.billing_purchases;
begin
  select * into v_purchase from public.billing_purchases where id = p_purchase_id;
  if v_purchase.id is null or not private.is_school_admin(v_purchase.school_id) then
    raise exception 'You cannot pay for this.' using errcode = '42501';
  end if;
  if v_purchase.status <> 'pending' then
    raise exception 'This payment is already %.', v_purchase.status using errcode = 'P0001';
  end if;
  return query select v_purchase.reference, v_purchase.amount, v_purchase.currency, v_purchase.email, v_purchase.school_id, v_purchase.description;
end;
$$;

-- Called only by the paystack Edge Function (service role), after Paystack
-- confirmed the payment. Safe to call twice: the second call changes nothing.
create function public.apply_paystack_payment(
  p_reference text,
  p_amount integer,
  p_currency text,
  p_paystack_id text,
  p_channel text,
  p_paid_at timestamptz default null
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_purchase public.billing_purchases;
  v_period public.academic_periods;
  v_receipt text;
begin
  select * into v_purchase from public.billing_purchases where reference = p_reference for update;
  if v_purchase.id is null then
    return 'unknown';
  end if;
  if v_purchase.status = 'paid' then
    return 'already_paid';
  end if;
  if p_amount <> v_purchase.amount or upper(coalesce(p_currency, '')) <> v_purchase.currency then
    update public.billing_purchases
    set status = 'failed', failure = 'Paid ' || p_amount || ' ' || coalesce(p_currency, '') || ' instead of ' || v_purchase.amount || ' ' || v_purchase.currency
    where id = v_purchase.id;
    return 'amount_mismatch';
  end if;

  v_receipt := 'RCR-' || to_char(coalesce(p_paid_at, now()) at time zone 'Africa/Accra', 'YYYY') || '-' ||
               lpad(nextval('private.receipt_numbers')::text, 6, '0');
  update public.billing_purchases
  set status = 'paid', paid_at = coalesce(p_paid_at, now()), paystack_id = p_paystack_id, channel = p_channel,
      receipt_number = v_receipt, failure = null
  where id = v_purchase.id;

  if v_purchase.kind = 'plan' then
    select * into v_period from public.academic_periods where id = v_purchase.academic_period_id;
    insert into public.school_plans (school_id, plan, academic_period_id, period_name, starts_on, ends_on, students_paid)
    values (v_purchase.school_id, v_purchase.plan, v_period.id, coalesce(v_period.name, v_purchase.period_name),
            coalesce(v_period.starts_on, private.ghana_today()), coalesce(v_period.ends_on, private.ghana_today()),
            v_purchase.students)
    -- Paid twice for the same term (two tabs): the students add up.
    on conflict (school_id, academic_period_id)
    do update set students_paid = public.school_plans.students_paid + excluded.students_paid, updated_at = now();
  elsif v_purchase.kind = 'seats' then
    update public.school_plans set students_paid = students_paid + v_purchase.students, updated_at = now()
    where school_id = v_purchase.school_id and academic_period_id = v_purchase.academic_period_id;
  elsif v_purchase.kind = 'upgrade' then
    update public.school_plans set plan = 'complete', updated_at = now()
    where school_id = v_purchase.school_id and academic_period_id = v_purchase.academic_period_id;
  end if;

  if coalesce(v_purchase.credits, 0) > 0 then
    insert into public.sms_credit_entries (school_id, amount, reason, created_by)
    values (v_purchase.school_id, v_purchase.credits,
            case when v_purchase.kind = 'credits' then 'Bought ' || v_purchase.credits || ' SMS credits (' || v_receipt || ')'
                 else 'Included with ' || v_purchase.description || ' (' || v_receipt || ')' end,
            v_purchase.created_by);
  end if;
  return 'paid';
end;
$$;

create function public.mark_purchase_failed(p_reference text, p_reason text)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.billing_purchases set status = 'failed', failure = left(p_reason, 300)
  where reference = p_reference and status = 'pending';
$$;

-- ---------------------------------------------------------------------------
-- The SMS pipeline follows the plan instead of verification alone
-- ---------------------------------------------------------------------------

-- Swaps exact pieces of existing functions, and stops if one is not found
-- (so a later change to those functions cannot be missed silently).
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
    raise exception 'Expected % of "%" in %, found %', p_times, p_old, p_function, v_found;
  end if;
  execute replace(v_source, p_old, p_new);
end;
$$;

select private.swap_in_function('private.queue_attendance_alerts()'::regprocedure,
  'join public.schools s on s.id = r.school_id and s.status = ''verified''',
  'join public.schools s on s.id = r.school_id and private.plan_allows(s.id, ''absence_alerts'')', 2);
select private.swap_in_function('private.queue_attendance_alerts()'::regprocedure,
  '(e.mark = ''present'' and ss.sms_present_alerts and l.receives_present_alerts)',
  '(e.mark = ''present'' and ss.sms_present_alerts and l.receives_present_alerts and private.plan_allows(r.school_id, ''present_alerts''))');
select private.swap_in_function('private.attendance_change_alert()'::regprocedure,
  'where s.id = v_register.school_id and s.status = ''verified'' and ss.sms_absence_alerts',
  'where s.id = v_register.school_id and private.plan_allows(s.id, ''absence_alerts'') and ss.sms_absence_alerts');
select private.swap_in_function('private.build_system_sms()'::regprocedure,
  'and not exists (select 1 from public.schools s where s.id = ge.school_id and s.status = ''verified'');',
  'and not private.plan_allows(ge.school_id, ''sms'');');
select private.swap_in_function('public.send_broadcast(uuid, text, uuid[])'::regprocedure,
  'if (select status from public.schools where id = p_school_id) <> ''verified'' then
    raise exception ''Your school must be verified by RollCol before it can send SMS.'' using errcode = ''P0001'';',
  'if not private.plan_allows(p_school_id, ''sms'') then
    raise exception ''SMS needs a school verified by RollCol, or a workspace on the Alerts plan.'' using errcode = ''P0001'';');
select private.swap_in_function('public.send_student_message(uuid, text)'::regprocedure,
  'if (select status from public.schools where id = v_student.school_id) <> ''verified'' then
    raise exception ''Your school must be verified by RollCol before it can send SMS.'' using errcode = ''P0001'';',
  'if not private.plan_allows(v_student.school_id, ''sms'') then
    raise exception ''SMS needs a school verified by RollCol, or a workspace on the Alerts plan.'' using errcode = ''P0001'';');

drop function private.swap_in_function(regprocedure, text, text, integer);

-- The platform page shows each school's plan.
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
  sms_sent_30_days bigint,
  is_workspace boolean,
  student_limit integer,
  custom_limit boolean,
  plan text,
  plan_ends_on date,
  trial_ends_on date
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
            where o.school_id = s.id and o.status = 'sent' and o.sent_at > now() - interval '30 days'),
           s.is_workspace,
           case when s.is_workspace then coalesce(private.school_student_limit(s.id), private.workspace_student_limit())
                else private.school_student_limit(s.id) end,
           s.student_limit is not null,
           (private.paid_plan(s.id)).plan,
           (private.paid_plan(s.id)).ends_on,
           private.trial_ends_on(s.id)
    from public.schools s
    order by s.is_workspace, (s.status = 'unverified') desc, s.created_at desc;
end;
$$;

revoke all on all functions in schema private from public, anon;
revoke all on function
  public.billing_catalog(),
  public.school_billing(uuid),
  public.school_features(uuid),
  public.billing_quote(uuid, text, text, uuid, integer),
  public.create_purchase(uuid, text, text, uuid, integer),
  public.purchase_for_payment(uuid),
  public.apply_paystack_payment(text, integer, text, text, text, timestamptz),
  public.mark_purchase_failed(text, text),
  public.platform_schools()
from public, anon;
grant execute on function public.billing_catalog() to anon, authenticated;
grant execute on function
  public.school_billing(uuid),
  public.school_features(uuid),
  public.billing_quote(uuid, text, text, uuid, integer),
  public.create_purchase(uuid, text, text, uuid, integer),
  public.purchase_for_payment(uuid),
  public.platform_schools()
to authenticated;
-- Only the Edge Function (service role) confirms payments.
grant execute on function
  public.apply_paystack_payment(text, integer, text, text, text, timestamptz),
  public.mark_purchase_failed(text, text)
to service_role;
