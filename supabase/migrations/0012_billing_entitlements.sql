-- Migration 0012: Billing and plan entitlements
-- org_billing holds the current subscription state per org (written only by the
-- service role via Stripe webhooks); billing_events is an append-only idempotency
-- ledger for processed Stripe webhook event ids.

begin;

create table if not exists org_billing (
  org_id uuid primary key references orgs(id) on delete cascade,
  plan text not null default 'trial' check (plan in ('trial', 'pro', 'enterprise')),
  status text not null default 'trialing' check (status in ('trialing', 'active', 'past_due', 'canceled')),
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table org_billing enable row level security;

-- Orgs may read their own billing state; all writes go through the service role
-- (which bypasses RLS), so no insert/update/delete policies are defined.
drop policy if exists org_billing_org_read on org_billing;
create policy org_billing_org_read on org_billing
  for select
  using (org_id = current_request_org_id());

create or replace function set_org_billing_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists org_billing_set_updated_at on org_billing;
create trigger org_billing_set_updated_at
  before update on org_billing
  for each row
  execute function set_org_billing_updated_at();

create table if not exists billing_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,
  event_type text not null,
  org_id uuid,
  processed_at timestamptz not null default now()
);

-- Service-role only: RLS enabled with no policies denies anon/authenticated access.
alter table billing_events enable row level security;

commit;
