export type MuninReviewSessionIdentity = {
  orgId: string;
  email: string;
};

export type MuninReviewMember = {
  id: string;
  orgId: string;
  email: string;
  role: string;
};

/**
 * SSO claims identify a candidate only. Approval authority comes from the
 * org-scoped users row returned by the service-side lookup.
 */
export function authorizeMuninAdminMember(
  session: MuninReviewSessionIdentity,
  member: MuninReviewMember | null | undefined
) {
  const email = session.email.trim().toLowerCase();
  if (
    !member ||
    !member.id ||
    member.orgId !== session.orgId ||
    member.email.trim().toLowerCase() !== email ||
    member.role.trim().toLowerCase() !== "admin"
  ) {
    throw new Error("unauthorized");
  }
  return { userId: member.id, principal: member.email };
}

/** Injectable form used by tests and adapters to make DB failure fail closed. */
export async function resolveMuninAdminMember(
  session: MuninReviewSessionIdentity,
  lookup: (identity: MuninReviewSessionIdentity) => Promise<MuninReviewMember | null | undefined>
) {
  let member: MuninReviewMember | null | undefined;
  try {
    member = await lookup(session);
  } catch {
    throw new Error("unauthorized");
  }
  return authorizeMuninAdminMember(session, member);
}
