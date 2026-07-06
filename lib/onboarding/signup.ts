/**
 * Self-serve signup stays fail-closed: org creation over the public route is
 * only possible when the operator explicitly sets SELF_SERVE_SIGNUP=true.
 */
export function selfServeSignupEnabled(env: NodeJS.ProcessEnv = process.env) {
  return env.SELF_SERVE_SIGNUP === "true";
}

export function normalizeOrgName(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const name = value.trim().replace(/\s+/g, " ");
  return name.length >= 2 && name.length <= 80 ? name : undefined;
}

export function normalizeDisplayName(value: unknown, fallbackEmail: string): string {
  if (typeof value === "string") {
    const name = value.trim().replace(/\s+/g, " ");
    if (name.length >= 1 && name.length <= 80) return name;
  }
  return fallbackEmail.split("@")[0] ?? fallbackEmail;
}
