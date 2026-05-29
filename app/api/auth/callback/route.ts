import { NextResponse } from "next/server";
import { getSsoProvider, issueSsoSession, ssoCookieName, ssoEnabled } from "@/lib/auth/sso";

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (!ssoEnabled()) {
    return NextResponse.redirect(new URL("/map", url));
  }
  const provider = getSsoProvider();
  if (provider === "none") {
    return NextResponse.redirect(new URL("/map", url));
  }
  const email = url.searchParams.get("email");
  const orgId = url.searchParams.get("org_id");
  const next = url.searchParams.get("next") || "/map";
  if (!email) {
    return NextResponse.json({ error: "email is required for SSO callback handoff" }, { status: 400 });
  }
  const response = NextResponse.redirect(new URL(next, url));
  response.cookies.set(ssoCookieName(), await issueSsoSession({ email, orgId, provider }), {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 12 * 60 * 60
  });
  return response;
}
