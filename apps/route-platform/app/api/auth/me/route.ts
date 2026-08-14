import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";

export async function GET(request: Request) {
  const context = await getAuthContext(request);
  if (!context) return NextResponse.json({ error: "Authentifizierung erforderlich", code: "AUTH_REQUIRED" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json({ userId: context.userId, orgId: context.orgId, role: context.role, driverId: context.driverId ?? null, demo: context.demo }, { headers: { "Cache-Control": "no-store" } });
}
