-- Migration 0014: service_role and authenticated grants for billing + onboarding tables
-- Migrations 0012 (org_billing, billing_events) and 0013 (org_invites) created their
-- tables but omitted the grants that every prior migration issues alongside a new table.
-- Without them the service-role read/write path hits "permission denied for table
-- org_billing" (settings page, Stripe webhooks) and the authenticated read policies
-- have no underlying table privilege to satisfy. Grants are idempotent; safe to re-run
-- and safe to apply after the tables already exist.

begin;

grant usage on schema public to service_role;

-- All billing/onboarding writes go through the service role (Stripe webhooks, invite
-- issuance, org bootstrap); it also backs the server read client.
grant all privileges on org_billing, billing_events, org_invites to service_role;

-- Org members read their own billing state and invites through the RLS policies defined
-- in 0012/0013. billing_events stays service-role only (RLS enabled with no policies),
-- so it is intentionally excluded from the authenticated grant.
grant select on org_billing, org_invites to authenticated;

commit;
