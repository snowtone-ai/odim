-- Migration 0013: Self-serve org onboarding
-- org_invites stores HMAC-hashed invite tokens (never plaintext); users gains an
-- email column so accepted invites stay attributable to a mailbox.

begin;

alter table users add column if not exists email text;
create unique index if not exists users_org_email_idx on users (org_id, email) where email is not null;

create table if not exists org_invites (
  id uuid primary key,
  org_id uuid not null references orgs(id) on delete cascade,
  email text not null,
  role text not null default 'analyst' check (role in ('analyst', 'admin')),
  token_hash text not null unique,
  invited_by text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz
);
create index if not exists org_invites_org_id_idx on org_invites (org_id);

alter table org_invites enable row level security;

-- Org members may read their own org's invites (token_hash is a peppered HMAC
-- that cannot be reversed into the invite token); all writes go through the
-- service role, so no insert/update/delete policies are defined.
drop policy if exists org_invites_org_read on org_invites;
create policy org_invites_org_read on org_invites
  for select
  using (org_id = current_request_org_id());

commit;
