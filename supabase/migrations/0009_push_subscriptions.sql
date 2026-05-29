-- Migration 0009: push_subscriptions

create table if not exists push_subscriptions (
  id uuid primary key,
  org_id uuid null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text null,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_push_subscriptions_org_id on push_subscriptions (org_id);
create index if not exists idx_push_subscriptions_last_seen_at on push_subscriptions (last_seen_at desc);
