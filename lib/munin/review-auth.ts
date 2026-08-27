import { cookies } from "next/headers";
import { isCommercialProductionEnv } from "../auth/api-keys.ts";
import { ssoCookieName, verifySsoSession } from "../auth/sso.ts";
import { isProductionRuntime } from "../env/runtime.ts";
import { createServiceSupabaseClient, hasSupabaseWriteEnv } from "../supabase/client.ts";
import { resolveMuninAdminMember, type MuninReviewMember, type MuninReviewSessionIdentity } from "./review-authorization.ts";

const LOCAL_FIXTURE_ORG_ID = "11111111-1111-4111-8111-111111111111";

export type MuninReviewContext = {
  orgId: string;
  userId?: string;
  principal: string;
};

function actionAuthRequired() {
  return process.env.AUTH_REQUIRED === "true" || isCommercialProductionEnv() ||
    isProductionRuntime() || process.env.REPOSITORY_SUPABASE_STRICT === "true";
}

async function lookupAdminMember(session: MuninReviewSessionIdentity): Promise<MuninReviewMember | null> {
  // Role lookup must use the service-side client: the SSO cookie is not a
  // Supabase auth.uid() and must never be treated as a role assertion.
  if (!hasSupabaseWriteEnv()) throw new Error("reviewer identity store is unavailable");
  const { data, error } = await createServiceSupabaseClient()
    .from("users")
    .select("id, org_id, email, role")
    .eq("org_id", session.orgId)
    .eq("email", session.email)
    .maybeSingle();
  if (error) throw new Error(`reviewer identity lookup failed: ${error.message}`);
  if (!data) return null;
  return {
    id: String(data.id),
    orgId: String(data.org_id),
    email: String(data.email ?? ""),
    role: String(data.role ?? "")
  };
}

/**
 * Browser review actions use the signed SSO cookie as their only protected
 * org authority. Local mode deliberately uses one explicit fixture org and
 * never accepts an arbitrary client org as a production substitute.
 */
export async function getMuninReviewContext(): Promise<MuninReviewContext> {
  let session = null;
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(ssoCookieName())?.value;
    if (token) session = await verifySsoSession(token);
  } catch {
    if (actionAuthRequired()) throw new Error("unauthorized");
  }
  if (session) {
    const authorized = await resolveMuninAdminMember(session, lookupAdminMember);
    return {
      orgId: session.orgId,
      userId: authorized.userId,
      principal: authorized.principal
    };
  }
  if (actionAuthRequired()) throw new Error("unauthorized");
  const orgId = process.env.DEFAULT_ORG_ID ?? LOCAL_FIXTURE_ORG_ID;
  if (!orgId) throw new Error("unauthorized");
  return {
    orgId,
    principal: `local:${orgId}`
  };
}
