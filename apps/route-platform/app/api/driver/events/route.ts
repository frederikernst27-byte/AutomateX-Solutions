import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { serverAuditEvents, serverDemoState, serverIdempotency } from "@/lib/server-demo";

const eventSchema = z.object({
  driverId: z.string().trim().min(1).max(120),
  routeId: z.string().trim().min(1).max(120).optional(),
  workOrderId: z.string().trim().min(1).max(120).optional(),
  type: z.enum(["route_started", "arrived", "completed", "problem", "skipped", "location"]),
  location: z.object({ lat: z.number().finite().min(-90).max(90), lng: z.number().finite().min(-180).max(180) }).optional(),
  note: z.string().trim().max(2_000).optional(),
});

function error(message: string, status: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: message, ...extra }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 100_000) return error("Ereignis-Payload ist zu groß", 413);
  const raw = await request.json().catch(() => null);
  const parsed = eventSchema.safeParse(raw);
  if (!parsed.success) return error("Ungültiges Fahrerereignis", 400, { details: parsed.error.flatten() });
  const body = parsed.data;
  const auth = await requireAuth(request, { roles: ["admin", "driver"], driverId: body.driverId });
  if (!auth.ok) return auth.response;

  const rawKey = request.headers.get("idempotency-key")?.trim();
  if (rawKey && rawKey.length > 200) return error("Idempotency-Key ist zu lang", 400);
  const key = rawKey ? `${auth.context.orgId}:driver-event:${body.driverId}:${rawKey}` : undefined;
  if (key) {
    const replay = serverIdempotency.get(key) as { body: unknown } | undefined;
    if (replay) return NextResponse.json(replay.body, { headers: { "Cache-Control": "no-store", "Idempotent-Replay": "true" } });
  }

  const driver = serverDemoState.drivers.find((item) => item.id === body.driverId);
  if (!driver) return error("Fahrer nicht gefunden", 404);
  const route = body.routeId ? serverDemoState.routes.find((item) => item.id === body.routeId) : undefined;
  if (body.routeId && !route) return error("Route nicht gefunden", 404);
  if (route && route.driverId !== driver.id) return error("Route gehört nicht zu diesem Fahrer", 403);
  if (route && route.status === "draft") return error("Entwurfsrouten dürfen nicht gestartet werden", 409);
  if (route && route.status === "cancelled") return error("Eine stornierte Route darf nicht geändert werden", 409);
  if (route && route.status === "completed" && body.type !== "completed") return error("Eine abgeschlossene Route darf nicht erneut gestartet oder geändert werden", 409);
  const order = body.workOrderId ? serverDemoState.workOrders.find((item) => item.id === body.workOrderId) : undefined;
  if (body.workOrderId && !order) return error("Arbeitsauftrag nicht gefunden", 404);
  if (order && route && !route.stops.some((stop) => stop.workOrderId === order.id)) return error("Arbeitsauftrag gehört nicht zur Route", 403);
  if (body.type !== "location" && !route) return error("routeId ist für dieses Ereignis erforderlich", 400);
  if (["arrived", "completed", "problem", "skipped"].includes(body.type) && !order) return error("workOrderId ist für ein Stopp-Ereignis erforderlich", 400);
  if (["arrived", "completed", "problem", "skipped"].includes(body.type) && route?.status !== "started") return error("Stopp-Ereignisse sind nur während einer gestarteten Tour zulässig", 409);
  if (body.type === "route_started" && route && !["published", "started"].includes(route.status)) return error("Nur veröffentlichte Touren dürfen gestartet werden", 409);
  if (body.type === "location" && (!route || route.status !== "started")) return error("Standort darf nur während einer aktiven Tour übertragen werden", 409);

  const before = { route: route ? structuredClone(route) : null, order: order ? structuredClone(order) : null, driver: structuredClone(driver) };
  if (route && body.type === "route_started") {
    route.status = "started";
    route.startedAt = route.startedAt ?? new Date().toISOString();
    route.currentStopId = route.currentStopId ?? route.stops[0]?.workOrderId;
    driver.status = "on_route";
  }
  if (route && (body.type === "problem" || body.type === "skipped")) {
    const current = body.workOrderId ? route.stops.find((stop) => stop.workOrderId === body.workOrderId)?.order ?? 0 : 0;
    route.currentStopId = route.stops.find((stop) => stop.order > current)?.workOrderId;
  }
  if (order) {
    if (body.type === "completed") {
      order.status = "completed";
      if (route) {
        const remaining = route.stops
          .filter((stop) => stop.workOrderId !== order.id)
          .filter((stop) => !["completed", "cancelled"].includes(serverDemoState.workOrders.find((item) => item.id === stop.workOrderId)?.status ?? ""))
          .sort((left, right) => left.order - right.order);
        route.status = remaining.length ? "started" : "completed";
        route.currentStopId = remaining[0]?.workOrderId;
        if (!remaining.length) driver.status = "available";
      }
    }
    else if (body.type === "arrived") { order.status = "on_site"; if (route) route.currentStopId = order.id; }
    else if (body.type === "problem" || body.type === "skipped") order.status = "needs_followup";
  }
  if (body.location) {
    driver.location = body.location;
    driver.lastSeen = "gerade eben";
    driver.status = "on_route";
    if (route) route.lastLocation = body.location;
  }
  const responseBody = { accepted: true, receivedAt: new Date().toISOString(), eventType: body.type, idempotencyKey: rawKey ?? null };
  serverAuditEvents.unshift({ id: `audit-${Date.now()}`, action: `driver.${body.type}`, entityId: body.workOrderId ?? body.routeId ?? driver.id, idempotencyKey: rawKey ?? undefined, before, after: { route: route ? structuredClone(route) : null, order: order ? structuredClone(order) : null, driver: structuredClone(driver) }, createdAt: new Date().toISOString() });
  if (key) serverIdempotency.set(key, { body: responseBody });
  return NextResponse.json(responseBody, { headers: { "Cache-Control": "no-store" } });
}
