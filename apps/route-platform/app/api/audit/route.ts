import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { serverAuditEvents } from "@/lib/server-demo";

/** Admin-only operational log. The persistent adapter maps this endpoint to
 * audit_events; the local adapter deliberately exposes the same shape. */
export async function GET(request: Request) {
  const auth = await requireAuth(request, { roles: ["admin"] });
  if (!auth.ok) return auth.response;
  const limit = Math.min(Math.max(Number(new URL(request.url).searchParams.get("limit") ?? 100) || 100, 1), 500);
  return NextResponse.json({ events: serverAuditEvents.slice(0, limit) }, { headers: { "Cache-Control": "no-store" } });
}
