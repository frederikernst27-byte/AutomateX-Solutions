import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getPilotRuntime } from "./pilot-runtime";

/**
 * Authentication boundary for the Route platform.
 *
 * The demo app deliberately has no login screen yet, therefore local development
 * uses an explicitly issued, short-lived, signed demo session.  There is no
 * anonymous API fallback: callers must first POST to /api/auth/demo.  In a
 * production build accepts Supabase identity only after the persistent adapter
 * is enabled. A synthetic presentation deployment additionally requires the
 * explicit, fail-closed pilot acknowledgement from `pilot-runtime.ts`.
 */

export const SESSION_COOKIE = "automatex_session";
const DEMO_SESSION_TTL_SECONDS = 8 * 60 * 60;
const DEFAULT_DEMO_SECRET = "automatex-local-demo-secret-change-me";

export type AuthRole = "admin" | "driver";

export interface AuthContext {
  userId: string;
  orgId: string;
  role: AuthRole;
  /** Present for driver sessions and used to enforce route ownership. */
  driverId?: string;
  /** True only for an explicitly issued local demo session. */
  demo: boolean;
}

export type AuthCheck =
  | { ok: true; context: AuthContext }
  | { ok: false; response: NextResponse };

function isProduction() {
  return process.env.NODE_ENV === "production";
}

function demoSessionsEnabled() {
  // Production requires the explicit pilot acknowledgement and a strong
  // signing secret enforced by the shared runtime preflight.
  return getPilotRuntime().demoBackendAllowed;
}

function secretForDemo() {
  return process.env.DEMO_AUTH_SECRET || process.env.AUTH_SECRET || DEFAULT_DEMO_SECRET;
}

function encode(value: unknown) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decode<T>(value: string): T | null {
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

function sign(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function signaturesEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

interface DemoClaims {
  sub: string;
  orgId: string;
  role: AuthRole;
  driverId?: string;
  demo: true;
  exp: number;
  iat: number;
}

export function createDemoSession(input: {
  role: AuthRole;
  driverId?: string;
  userId?: string;
  orgId?: string;
}) {
  if (!demoSessionsEnabled()) {
    throw new Error("Demo-Sessions sind im Produktionsmodus deaktiviert");
  }
  if (input.role === "driver" && !input.driverId) {
    throw new Error("Eine Fahrer-Session benötigt driverId");
  }
  const now = Math.floor(Date.now() / 1000);
  const claims: DemoClaims = {
    sub: input.userId || (input.role === "driver" ? `demo-${input.driverId}` : "demo-admin"),
    orgId: input.orgId || "demo-org",
    role: input.role,
    ...(input.driverId ? { driverId: input.driverId } : {}),
    demo: true,
    iat: now,
    exp: now + DEMO_SESSION_TTL_SECONDS,
  };
  const payload = encode(claims);
  return `${payload}.${sign(payload, secretForDemo())}`;
}

function parseDemoSession(token: string): AuthContext | null {
  if (!demoSessionsEnabled()) return null;
  const [payload, suppliedSignature] = token.split(".");
  if (!payload || !suppliedSignature || !signaturesEqual(sign(payload, secretForDemo()), suppliedSignature)) return null;
  const claims = decode<DemoClaims>(payload);
  if (!claims || claims.demo !== true || !claims.sub || !claims.orgId || !claims.role || !Number.isFinite(claims.exp) || !Number.isFinite(claims.iat) || claims.exp <= Math.floor(Date.now() / 1000) || claims.iat > Math.floor(Date.now() / 1000) + 60) return null;
  if (claims.role !== "admin" && claims.role !== "driver") return null;
  if (claims.role === "driver" && !claims.driverId) return null;
  return { userId: claims.sub, orgId: claims.orgId, role: claims.role, driverId: claims.driverId, demo: true };
}

function readCookie(request: Request, name: string) {
  const header = request.headers.get("cookie") || "";
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  if (!match) return undefined;
  try { return decodeURIComponent(match[1]); } catch { return undefined; }
}

function readAllCookies(request: Request) {
  const result: Array<[string, string]> = [];
  for (const part of (request.headers.get("cookie") || "").split(";")) {
    const separator = part.indexOf("=");
    if (separator < 1) continue;
    const value = part.slice(separator + 1).trim();
    try { result.push([part.slice(0, separator).trim(), decodeURIComponent(value)]); } catch { /* ignore malformed cookie */ }
  }
  return result;
}

/** Supabase SSR stores the session in an `sb-…-auth-token` cookie and may
 * split large values into numbered chunks. Reassemble and decode it here so
 * API requests made by the browser use the same identity as server pages. */
function supabaseCookieAccessToken(request: Request) {
  const cookies = readAllCookies(request).filter(([name]) => name.startsWith("sb-") && name.includes("-auth-token"));
  if (!cookies.length) return readCookie(request, "sb-access-token");
  cookies.sort(([left], [right]) => left.localeCompare(right, undefined, { numeric: true }));
  const raw = cookies.map(([, value]) => value).join("");
  const candidates = [raw];
  if (raw.startsWith("base64-")) {
    try { candidates.push(Buffer.from(raw.slice(7), "base64").toString("utf8")); } catch { /* malformed cookie */ }
  }
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as { access_token?: string } | [string, string];
      if (Array.isArray(parsed) && typeof parsed[0] === "string") return parsed[0];
      if (!Array.isArray(parsed) && parsed && typeof parsed === "object" && "access_token" in parsed) {
        const accessToken = (parsed as { access_token?: unknown }).access_token;
        if (typeof accessToken === "string") return accessToken;
      }
    } catch { /* try next encoding */ }
  }
  return undefined;
}

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  if (authorization?.toLowerCase().startsWith("bearer ")) return authorization.slice(7).trim();
  return request.headers.get("x-automatex-session") || readCookie(request, SESSION_COOKIE) || supabaseCookieAccessToken(request);
}

async function authenticateSupabase(token: string): Promise<AuthContext | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  try {
    const client = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userError } = await client.auth.getUser(token);
    if (userError || !userData.user) return null;
    const userId = userData.user.id;
    const { data: memberships, error: membershipError } = await client
      .from("memberships")
      .select("org_id, role")
      .eq("user_id", userId)
      .limit(2);
    // The pilot has no organization switcher yet. Never choose an arbitrary
    // tenant when a user belongs to more than one organization.
    if (membershipError || memberships?.length !== 1) return null;
    const membership = memberships[0];
    if (membership.role !== "admin" && membership.role !== "driver") return null;

    let driverId: string | undefined;
    if (membership.role === "driver") {
      const { data: driver, error: driverError } = await client
        .from("drivers")
        .select("id")
        .eq("org_id", membership.org_id)
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();
      if (driverError || !driver) return null;
      driverId = driver.id;
    }
    return { userId, orgId: membership.org_id, role: membership.role, driverId, demo: false };
  } catch {
    return null;
  }
}

/** Resolve a bearer token, explicit demo cookie, or no identity. */
export async function getAuthContext(request: Request): Promise<AuthContext | null> {
  const token = bearerToken(request);
  if (!token || token.length > 16_384) return null;
  const demo = parseDemoSession(token);
  if (demo) return demo;
  return authenticateSupabase(token);
}

export async function requireAuth(
  request: Request,
  options: { roles?: AuthRole[]; driverId?: string } = {},
): Promise<AuthCheck> {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) {
        return {
          ok: false,
          response: NextResponse.json(
            { error: "Ungültiger Anfrageursprung", code: "ORIGIN_MISMATCH" },
            { status: 403, headers: { "Cache-Control": "no-store" } },
          ),
        };
      }
    } catch {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Ungültiger Anfrageursprung", code: "ORIGIN_INVALID" },
          { status: 403, headers: { "Cache-Control": "no-store" } },
        ),
      };
    }
  }
  const context = await getAuthContext(request);
  if (!context) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Authentifizierung erforderlich", code: "AUTH_REQUIRED" },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      ),
    };
  }
  if (options.roles && !options.roles.includes(context.role)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Keine Berechtigung für diese Aktion", code: "FORBIDDEN" },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      ),
    };
  }
  if (options.driverId && context.role === "driver" && context.driverId !== options.driverId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Fahrer darf nur eigene Touren ändern", code: "DRIVER_SCOPE" },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      ),
    };
  }
  // Supabase Auth alone is not enough: the current demo adapter is process
  // local and must never serve a real user's request. Operators explicitly
  // enable the DB adapter only after every repository path is wired to the EU
  // Supabase project.
  if (!context.demo && process.env.SUPABASE_DATA_BACKEND_READY !== "true") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Datenbank-Backend ist noch nicht für Produktivzugriff aktiviert", code: "DATA_BACKEND_NOT_CONFIGURED" },
        { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "60" } },
      ),
    };
  }
  return { ok: true, context };
}

export function demoSessionCookie(token: string) {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isProduction(),
    path: "/",
    maxAge: DEMO_SESSION_TTL_SECONDS,
  };
}

export function demoAuthAvailable() {
  return demoSessionsEnabled();
}
