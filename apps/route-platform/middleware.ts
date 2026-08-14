import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getPilotRuntime, isPilotApplicationApi } from "@/lib/pilot-runtime";

function withSecurityHeaders(response: NextResponse, pathname: string) {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(self), microphone=(self), geolocation=(self)");
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  // Next App Router emits small inline RSC/bootstrap scripts. A strict
  // `script-src 'self'` makes the production shell render blank unless every
  // response gets a request-specific nonce. Keep `unsafe-inline` for this
  // pilot so the built app remains usable; replace it with a nonce-based CSP
  // before handling sensitive production traffic.
  const scriptPolicy = process.env.NODE_ENV === "production" ? "'self' 'unsafe-inline'" : "'self' 'unsafe-inline' 'unsafe-eval'";
  response.headers.set("Content-Security-Policy", `default-src 'self'; script-src ${scriptPolicy}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co https://api.openai.com https://openrouter.ai; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'`);
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  if (process.env.NODE_ENV === "production") {
    response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }
  if (pathname.startsWith("/api/") || pathname.startsWith("/admin") || pathname.startsWith("/driver") || pathname.startsWith("/p/")) {
    response.headers.set("Cache-Control", "no-store, max-age=0");
    response.headers.set("Pragma", "no-cache");
  }
  return response;
}

/** Baseline security and cache policy for the standalone Route app. */
export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const runtime = getPilotRuntime();

  // Every application API currently uses the synthetic process-local adapter.
  // Fail closed unless that adapter is safe for this explicitly selected mode.
  if (isPilotApplicationApi(pathname) && !runtime.demoBackendAllowed && process.env.SUPABASE_DATA_BACKEND_READY !== "true") {
    return withSecurityHeaders(NextResponse.json({
      error: "Der Pilot-Demoadapter ist in dieser Umgebung gesperrt.",
      code: "PILOT_BACKEND_BLOCKED",
      reason: runtime.reason,
      preflight: "/api/health",
    }, { status: 503 }), pathname);
  }

  if (pathname.startsWith("/admin") || pathname.startsWith("/driver")) {
    const hasSupabaseSession = request.cookies.getAll().some((cookie) => cookie.name === "sb-access-token" || (cookie.name.startsWith("sb-") && cookie.name.includes("auth-token")));
    const hasExplicitLocalSession = !runtime.production && request.cookies.has("automatex_session");
    const hasAcknowledgedDemoSession = runtime.status === "acknowledged-pilot-demo" && request.cookies.has("automatex_session");
    if (!hasSupabaseSession && !hasExplicitLocalSession && !hasAcknowledgedDemoSession) {
      const login = new URL("/login", request.url);
      login.searchParams.set("next", pathname);
      return withSecurityHeaders(NextResponse.redirect(login), pathname);
    }
  }
  return withSecurityHeaders(NextResponse.next(), pathname);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest).*)"],
};
