import { NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/auth/request";
import { createServiceSupabaseClient, hasSupabaseWriteEnv } from "@/lib/supabase/client";
import { deterministicUuid } from "@/lib/pipeline/idempotency";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const LOCAL_RULES_PATH = join(process.cwd(), "config", "alert-rules.json");

function loadLocalRules(): unknown[] {
  try {
    if (!existsSync(LOCAL_RULES_PATH)) return [];
    return JSON.parse(readFileSync(LOCAL_RULES_PATH, "utf8")) as unknown[];
  } catch {
    return [];
  }
}

function saveLocalRules(rules: unknown[]) {
  try {
    writeFileSync(LOCAL_RULES_PATH, JSON.stringify(rules, null, 2));
  } catch (err) {
    console.warn("alert-rules local save failed:", err);
  }
}

function validateRuleInput(body: Record<string, unknown>) {
  const name = typeof body.name === "string" ? body.name.trim() : null;
  if (name && name.length > 120) return { error: "name too long" };
  const minConfidence = typeof body.minConfidence === "number" ? body.minConfidence : undefined;
  if (minConfidence !== undefined && (minConfidence < 0 || minConfidence > 1)) {
    return { error: "minConfidence must be 0-1" };
  }
  const validDestinations = ["dashboard", "slack", "both", "email", "api"];
  const destination = typeof body.destination === "string" ? body.destination : undefined;
  if (destination && !validDestinations.includes(destination)) {
    return { error: "invalid destination" };
  }
  return { error: null };
}

export async function POST(request: Request) {
  try {
    const auth = await authorizeApiRequest(request, "admin:write");
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await request.json() as Record<string, unknown>;
    const { error: validationError } = validateRuleInput(body);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

    const orgId = auth.context.orgId ?? "demo-org";
    const rule = {
      id: deterministicUuid("alert_rule", `${orgId}:${Date.now()}:${String(body.name)}`),
      orgId,
      name: String(body.name ?? "").trim(),
      layer: String(body.layer ?? "any"),
      minConfidence: Number(body.minConfidence ?? 0.8),
      destination: String(body.destination ?? "dashboard"),
      enabled: body.enabled !== false,
      createdAt: new Date().toISOString()
    };

    if (hasSupabaseWriteEnv()) {
      const { error } = await createServiceSupabaseClient()
        .from("alert_rules")
        .upsert({
          id: rule.id,
          org_id: rule.orgId,
          name: rule.name,
          layer: rule.layer,
          min_confidence: rule.minConfidence,
          destination: rule.destination,
          enabled: rule.enabled,
          created_at: rule.createdAt
        }, { onConflict: "id" });
      if (error && !/schema cache|does not exist/i.test(error.message)) {
        throw new Error(error.message);
      }
    } else {
      const rules = loadLocalRules();
      rules.unshift(rule);
      saveLocalRules(rules);
    }

    return NextResponse.json({ rule }, { status: 201 });
  } catch (error) {
    console.error("alert-rules POST failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await authorizeApiRequest(request, "admin:write");
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const body = await request.json() as Record<string, unknown>;
    const { error: validationError } = validateRuleInput(body);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = String(body.name).trim();
    if (body.layer !== undefined) updates.layer = String(body.layer);
    if (body.minConfidence !== undefined) updates.min_confidence = Number(body.minConfidence);
    if (body.destination !== undefined) updates.destination = String(body.destination);
    if (body.enabled !== undefined) updates.enabled = Boolean(body.enabled);

    if (hasSupabaseWriteEnv()) {
      const { error } = await createServiceSupabaseClient()
        .from("alert_rules")
        .update(updates)
        .eq("id", id);
      if (error && !/schema cache|does not exist/i.test(error.message)) {
        throw new Error(error.message);
      }
    } else {
      const rules = loadLocalRules() as Record<string, unknown>[];
      const idx = rules.findIndex((r) => r.id === id);
      if (idx >= 0) {
        rules[idx] = { ...rules[idx], ...updates, id };
        saveLocalRules(rules);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("alert-rules PATCH failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await authorizeApiRequest(request, "admin:write");
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    if (hasSupabaseWriteEnv()) {
      const { error } = await createServiceSupabaseClient()
        .from("alert_rules")
        .delete()
        .eq("id", id);
      if (error && !/schema cache|does not exist/i.test(error.message)) {
        throw new Error(error.message);
      }
    } else {
      const rules = loadLocalRules() as Record<string, unknown>[];
      saveLocalRules(rules.filter((r) => r.id !== id));
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("alert-rules DELETE failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
