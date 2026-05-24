import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { rawSignalVisibilityFilter, tenantOrPublicFilter } from "../lib/api/org.ts";

test("raw_signals has RLS with proprietary tenant isolation", () => {
  const migration = readFileSync("supabase/migrations/0001_initial.sql", "utf8");

  assert.match(migration, /org_id uuid references orgs\(id\)/);
  assert.match(migration, /alter table raw_signals enable row level security/);
  assert.match(migration, /create policy raw_signals_public_or_org on raw_signals[\s\S]*is_proprietary = false/);
  assert.match(migration, /create or replace function current_request_org_id\(\)/);
  assert.match(migration, /create policy raw_signals_public_or_org on raw_signals[\s\S]*org_id = current_request_org_id\(\)/);
  assert.match(migration, /with check \([\s\S]*is_proprietary = false[\s\S]*org_id = current_request_org_id\(\)/);
  assert.match(migration, /grant all privileges on[\s\S]*api_keys[\s\S]*to service_role/);
});

test("app-layer tenant filters match RLS visibility semantics", () => {
  assert.equal(tenantOrPublicFilter("org_id", "org-a"), "org_id.is.null,org_id.eq.org-a");
  assert.equal(rawSignalVisibilityFilter(), "is_proprietary.eq.false");
  assert.equal(rawSignalVisibilityFilter("org-a"), "is_proprietary.eq.false,org_id.eq.org-a");
});
