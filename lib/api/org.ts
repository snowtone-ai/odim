export type OrgContext = {
  orgId?: string;
};

export function getOrgContextFromRequest(request: Request): OrgContext {
  const url = new URL(request.url);
  const orgId = request.headers.get("x-odim-org-id") ?? url.searchParams.get("orgId") ?? undefined;
  return orgId ? { orgId } : {};
}

export function tenantOrPublicFilter(column: string, orgId?: string) {
  return orgId ? `${column}.is.null,${column}.eq.${orgId}` : `${column}.is.null`;
}

export function rawSignalVisibilityFilter(orgId?: string) {
  return orgId ? `is_proprietary.eq.false,org_id.eq.${orgId}` : "is_proprietary.eq.false";
}
