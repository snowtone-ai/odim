import { NextResponse, type NextRequest } from "next/server";
import { readSsoSessionCookie, ssoEnabled } from "@/lib/auth/sso";

export async function middleware(request: NextRequest) {
  if (
    ssoEnabled() &&
    !request.nextUrl.pathname.startsWith("/api/auth/callback") &&
    !request.nextUrl.pathname.startsWith("/api/health") &&
    !request.nextUrl.pathname.startsWith("/login") &&
    !request.nextUrl.pathname.startsWith("/_next")
  ) {
    const session = await readSsoSessionCookie(request.headers.get("cookie"));
    const protectedPath =
      request.nextUrl.pathname.startsWith("/api/") ||
      request.nextUrl.pathname.startsWith("/map") ||
      request.nextUrl.pathname.startsWith("/entity") ||
      request.nextUrl.pathname.startsWith("/alerts") ||
      request.nextUrl.pathname.startsWith("/huginn") ||
      request.nextUrl.pathname.startsWith("/settings") ||
      request.nextUrl.pathname.startsWith("/custom");
    if (protectedPath && !session) {
      if (request.nextUrl.pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "SSO session required" }, { status: 401 });
      }
      const login = new URL("/login", request.url);
      login.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
      return NextResponse.redirect(login);
    }
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'unsafe-eval' blob:`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https:",
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return response;
}

export const config = {
  matcher: "/:path*"
};
