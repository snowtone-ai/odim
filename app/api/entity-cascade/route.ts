import { checkRequestRateLimit } from "../../../lib/api/rate-limit.ts";
import { authorizeApiRequest } from "../../../lib/auth/request.ts";
import { tenantOrPublicFilter } from "../../../lib/api/org.ts";
import { createServerSupabaseReadClient, hasSupabaseReadEnv } from "../../../lib/supabase/client.ts";
import { DEMO_ENTITIES } from "../../../lib/map/entities.ts";
import { DEMO_CONNECTIONS } from "../../../lib/map/connections.ts";
import type { LayerKey } from "../../../lib/map/types.ts";

type CascadeChild = {
  id: string;
  name: string;
  confidence: number;
  linkType: string;
  capitalWeight: number;
  coverageGapScore: number;
};

type CascadeSubstrate = {
  layer: LayerKey;
  id: string;
  name: string;
  children: CascadeChild[];
};

type CascadeResponse = {
  entity: { id: string; name: string; score: number };
  substrates: CascadeSubstrate[];
};

const LAYER_KEYS: LayerKey[] = [
  "energy", "cash", "land", "compute", "water", "raw_materials", "logistics"
];

function isLayerKey(value: string): value is LayerKey {
  return (LAYER_KEYS as string[]).includes(value);
}

function buildFixtureCascade(entityId: string): CascadeResponse | null {
  const entity = DEMO_ENTITIES.find((e) => e.id === entityId);
  if (!entity) return null;

  // L2: entities connected to this entity via DEMO_CONNECTIONS, grouped by layer
  const connectedIds = new Set<string>();
  for (const conn of DEMO_CONNECTIONS) {
    if (conn.fromId === entityId) connectedIds.add(conn.toId);
    if (conn.toId === entityId) connectedIds.add(conn.fromId);
  }

  const substrates: CascadeSubstrate[] = [];

  // Group connected entities by layer as substrate nodes
  const byLayer = new Map<LayerKey, typeof DEMO_ENTITIES>();
  for (const connId of connectedIds) {
    const connEntity = DEMO_ENTITIES.find((e) => e.id === connId);
    if (!connEntity) continue;
    const arr = byLayer.get(connEntity.layer) ?? [];
    arr.push(connEntity);
    byLayer.set(connEntity.layer, arr);
  }

  for (const [layer, entities] of byLayer.entries()) {
    const substrateEntity = entities[0];
    const children: CascadeChild[] = entities.slice(0, 3).map((child) => {
      const conn = DEMO_CONNECTIONS.find(
        (c) => (c.fromId === entityId && c.toId === child.id) ||
               (c.toId === entityId && c.fromId === child.id)
      );
      return {
        id: child.id,
        name: child.name,
        confidence: conn?.confidence ?? child.confidence,
        linkType: "supply",
        capitalWeight: child.score * 1_200_000,
        coverageGapScore: Math.max(0.1, 1 - child.confidence)
      };
    });

    substrates.push({
      layer,
      id: substrateEntity.id,
      name: substrateEntity.name,
      children
    });
  }

  return {
    entity: { id: entity.id, name: entity.name, score: entity.score },
    substrates
  };
}

async function buildSupabaseCascade(
  entityId: string,
  orgId: string | undefined
): Promise<CascadeResponse | null> {
  const client = createServerSupabaseReadClient();

  // L1: fetch entity
  const { data: objectData, error: objectError } = await client
    .from("ontology_objects")
    .select("id, object_type, attributes")
    .eq("id", entityId)
    .or(tenantOrPublicFilter("org_visible", orgId))
    .single();

  if (objectError || !objectData) return null;
  const attrs = (objectData.attributes ?? {}) as Record<string, unknown>;
  const entityName = (attrs.name as string | undefined) ?? entityId;
  const entityScore = typeof attrs.score === "number" ? attrs.score : 70;

  // L2: fetch links from entity
  const { data: l2Links, error: l2Error } = await client
    .from("ontology_links")
    .select("id, to_object_id, link_type, confidence")
    .eq("from_object_id", entityId)
    .or(tenantOrPublicFilter("org_visible", orgId))
    .order("confidence", { ascending: false })
    .limit(20);

  if (l2Error) throw new Error(`L2 query failed: ${l2Error.message}`);

  const substrates: CascadeSubstrate[] = [];
  const l2ObjectIds = (l2Links ?? []).map((l) => l.to_object_id as string);
  if (!l2ObjectIds.length) {
    return { entity: { id: entityId, name: entityName, score: entityScore }, substrates };
  }

  // Fetch L2 objects
  const { data: l2Objects } = await client
    .from("ontology_objects")
    .select("id, object_type, attributes")
    .in("id", l2ObjectIds)
    .or(tenantOrPublicFilter("org_visible", orgId));

  const l2ObjectMap = new Map<string, { id: string; attributes: Record<string, unknown> }>();
  for (const obj of l2Objects ?? []) {
    l2ObjectMap.set(String(obj.id), {
      id: String(obj.id),
      attributes: (obj.attributes ?? {}) as Record<string, unknown>
    });
  }

  // For each L2 link, build substrate + fetch L3
  const grouped = new Map<string, { layer: LayerKey; link: (typeof l2Links)[0] }>();
  for (const link of l2Links ?? []) {
    const obj = l2ObjectMap.get(String(link.to_object_id));
    if (!obj) continue;
    const rawLayer = (obj.attributes.layer as string | undefined) ?? "cash";
    const layer: LayerKey = isLayerKey(rawLayer) ? rawLayer : "cash";
    if (!grouped.has(layer)) {
      grouped.set(layer, { layer, link });
    }
  }

  for (const [, { layer, link }] of grouped.entries()) {
    const l2Id = String(link.to_object_id);
    const l2Obj = l2ObjectMap.get(l2Id);
    const l2Name = (l2Obj?.attributes.name as string | undefined) ?? l2Id;

    // L3: fetch links from L2 node
    const { data: l3Links } = await client
      .from("ontology_links")
      .select("id, to_object_id, link_type, confidence")
      .eq("from_object_id", l2Id)
      .or(tenantOrPublicFilter("org_visible", orgId))
      .order("confidence", { ascending: false })
      .limit(3);

    const l3ObjectIds = (l3Links ?? []).map((l) => String(l.to_object_id));
    let l3Objects: Array<{ id: string; attributes: Record<string, unknown> }> = [];
    if (l3ObjectIds.length) {
      const { data: l3ObjData } = await client
        .from("ontology_objects")
        .select("id, object_type, attributes")
        .in("id", l3ObjectIds)
        .or(tenantOrPublicFilter("org_visible", orgId));
      l3Objects = (l3ObjData ?? []).map((o) => ({
        id: String(o.id),
        attributes: (o.attributes ?? {}) as Record<string, unknown>
      }));
    }

    const l3ObjMap = new Map(l3Objects.map((o) => [o.id, o]));
    const children: CascadeChild[] = (l3Links ?? []).map((l3Link) => {
      const l3Id = String(l3Link.to_object_id);
      const l3Obj = l3ObjMap.get(l3Id);
      const l3Name = (l3Obj?.attributes.name as string | undefined) ?? l3Id;
      const signalCount = typeof l3Obj?.attributes.signal_count === "number"
        ? (l3Obj.attributes.signal_count as number)
        : 1;
      const narrativeCount = typeof l3Obj?.attributes.narrative_count === "number"
        ? (l3Obj.attributes.narrative_count as number)
        : 1;
      return {
        id: l3Id,
        name: l3Name,
        confidence: Number(l3Link.confidence) || 0.5,
        linkType: String(l3Link.link_type ?? "supply"),
        capitalWeight: signalCount * 1_200_000,
        coverageGapScore: signalCount / Math.max(1, narrativeCount)
      };
    });

    substrates.push({ layer, id: l2Id, name: l2Name, children });
  }

  return { entity: { id: entityId, name: entityName, score: entityScore }, substrates };
}

export async function GET(request: Request) {
  try {
    const auth = await authorizeApiRequest(request, "entity:read");
    if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

    const rateLimit = checkRequestRateLimit(auth.context.orgId, "entity-cascade", {
      maxRequests: 30,
      windowMs: 60_000
    });
    if (!rateLimit.ok) {
      return Response.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } }
      );
    }

    const url = new URL(request.url);
    const entityId = url.searchParams.get("id");
    if (!entityId || entityId.length > 200) {
      return Response.json({ error: "id query parameter is required" }, { status: 400 });
    }

    if (!hasSupabaseReadEnv()) {
      const fixture = buildFixtureCascade(entityId);
      if (!fixture) return Response.json({ error: "Entity not found" }, { status: 404 });
      return Response.json(fixture);
    }

    try {
      const result = await buildSupabaseCascade(entityId, auth.context.orgId);
      if (!result) return Response.json({ error: "Entity not found" }, { status: 404 });
      return Response.json(result);
    } catch (dbErr) {
      // Fallback to fixture on schema errors (dev environments)
      const msg = dbErr instanceof Error ? dbErr.message : String(dbErr);
      if (/schema cache|does not exist|Could not find the table/i.test(msg)) {
        const fixture = buildFixtureCascade(entityId);
        if (!fixture) return Response.json({ error: "Entity not found" }, { status: 404 });
        return Response.json(fixture);
      }
      throw dbErr;
    }
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
