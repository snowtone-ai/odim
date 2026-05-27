export type OrgContext = {
  orgId?: string;
};

const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validOrgId(orgId?: string) {
  return orgId && uuidV4Pattern.test(orgId) ? orgId : undefined;
}

export function getOrgContextFromRequest(request: Request): OrgContext {
  const url = new URL(request.url);
  const orgId = validOrgId(request.headers.get("x-odim-org-id") ?? url.searchParams.get("orgId") ?? undefined);
  return orgId ? { orgId } : {};
}

export function tenantOrPublicFilter(column: string, orgId?: string) {
  const safeOrgId = validOrgId(orgId);
  return safeOrgId ? `${column}.is.null,${column}.eq.${safeOrgId}` : `${column}.is.null`;
}

export function rawSignalVisibilityFilter(orgId?: string) {
  const safeOrgId = validOrgId(orgId);
  return safeOrgId ? `is_proprietary.eq.false,org_id.eq.${safeOrgId}` : "is_proprietary.eq.false";
}
