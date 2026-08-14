import { NextResponse } from "next/server";
import { z } from "zod";
import { createDemoSession, demoAuthAvailable, demoSessionCookie } from "@/lib/auth";
import { serverDemoState } from "@/lib/server-demo";

const bodySchema = z.object({
  role: z.enum(["admin", "driver"]),
  driverId: z.string().trim().min(1).optional(),
});

/**
 * Issue a local-only demo session. This endpoint is intentionally unavailable
 * in production; real deployments use Supabase Auth access tokens instead.
 */
export async function POST(request: Request) {
  if (!demoAuthAvailable()) {
    return NextResponse.json({ error: "Demo-Login ist im Produktionsmodus deaktiviert" }, { status: 404 });
  }
  try {
    const body = bodySchema.parse(await request.json());
    if (body.role === "driver") {
      const driver = serverDemoState.drivers.find((item) => item.id === body.driverId && item.active);
      if (!driver) return NextResponse.json({ error: "Aktiver Fahrer nicht gefunden" }, { status: 400 });
    }
    const token = createDemoSession({ role: body.role, driverId: body.driverId });
    const response = NextResponse.json({
      authenticated: true,
      demo: true,
      role: body.role,
      driverId: body.driverId ?? null,
      expiresInSeconds: 8 * 60 * 60,
      // Useful for local API clients that do not persist cookies. Never enabled
      // in production because the issuer itself is disabled there.
      sessionToken: token,
    });
    response.cookies.set(demoSessionCookie(token));
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Ungültige Demo-Session" }, { status: 400 });
  }
}

export async function DELETE() {
  if (!demoAuthAvailable()) return NextResponse.json({ error: "Nicht verfügbar" }, { status: 404 });
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set({ ...demoSessionCookie(""), value: "", maxAge: 0 });
  return response;
}
