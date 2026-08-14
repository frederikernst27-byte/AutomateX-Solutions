import { NextResponse } from "next/server";
import { z } from "zod";
import { estimateRouteSequence, validateRouteStops } from "@/lib/planner";
import { serverAuditEvents, serverDemoState, serverIdempotency, serverRouteVersions } from "@/lib/server-demo";
import { requireAuth } from "@/lib/auth";
import type { WorkOrder } from "@/lib/types";

const schema = z.object({
  version: z.number().int().positive(),
  stopIds: z.array(z.string().trim().min(1)).max(100).optional(),
  overrideReason: z.string().trim().min(8).optional(),
});

function errorResponse(message: string, status: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: message, ...extra }, { status, headers: { "Cache-Control": "no-store" } });
}

function fixedAssignment(order: WorkOrder) {
  return order.locked || ["confirmed", "planned", "en_route", "on_site"].includes(order.status);
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, { roles: ["admin"] });
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  const route = serverDemoState.routes.find((item) => item.id === id);
  if (!route) return errorResponse("Route nicht gefunden", 404);
  if (["started", "completed", "cancelled"].includes(route.status)) return errorResponse("Eine laufende oder abgeschlossene Route kann nicht umsortiert werden", 409);

  const rawIdempotencyKey = request.headers.get("idempotency-key")?.trim();
  if (rawIdempotencyKey && rawIdempotencyKey.length > 200) return errorResponse("Idempotency-Key ist zu lang", 400);
  const idempotencyKey = rawIdempotencyKey ? `${auth.context.orgId}:route:${id}:${rawIdempotencyKey}` : undefined;
  let payload: unknown;
  try { payload = await request.json(); } catch { return errorResponse("Ungültiger JSON-Body", 400); }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return errorResponse("Ungültige Routenänderung", 400, { details: parsed.error.flatten() });
  const fingerprint = JSON.stringify(parsed.data);
  if (idempotencyKey) {
    const replay = serverIdempotency.get(idempotencyKey) as { body: unknown; status: number; fingerprint?: string } | undefined;
    if (replay) {
      if (replay.fingerprint && replay.fingerprint !== fingerprint) return errorResponse("Idempotency-Key wurde mit anderem Payload wiederverwendet", 409);
      return NextResponse.json(replay.body, { status: 200, headers: { "Cache-Control": "no-store", "Idempotent-Replay": "true" } });
    }
  }
  const currentVersion = serverRouteVersions.get(id) ?? 1;
  if (parsed.data.version !== currentVersion) return errorResponse("Route wurde zwischenzeitlich geändert", 409, { currentVersion });
  const driver = serverDemoState.drivers.find((item) => item.id === route.driverId);
  if (!driver) return errorResponse("Fahrer der Route nicht gefunden", 409);

  const stopIds = parsed.data.stopIds ?? route.stops.map((stop) => stop.workOrderId);
  if (new Set(stopIds).size !== stopIds.length) return errorResponse("Ein Auftrag darf nicht mehrfach in derselben Route vorkommen", 400);
  const requestedOrders = stopIds.map((workOrderId) => serverDemoState.workOrders.find((item) => item.id === workOrderId));
  if (requestedOrders.some((item): item is undefined => !item)) return errorResponse("Mindestens ein Auftrag ist unbekannt", 400);
  const orders = requestedOrders as WorkOrder[];
  if (orders.some((order) => ["completed", "cancelled"].includes(order.status))) return errorResponse("Abgeschlossene oder abgesagte Aufträge dürfen nicht eingeplant werden", 409);

  // An order already present on another active route must be moved out there
  // first. Silently duplicating it would produce two customer appointments.
  const duplicateRoute = orders.find((order) => serverDemoState.routes.some((other) => other.id !== route.id && other.status !== "cancelled" && other.stops.some((stop) => stop.workOrderId === order.id)));
  if (duplicateRoute) return errorResponse(`Auftrag ${duplicateRoute.id} ist bereits einer anderen Route zugewiesen`, 409);

  const customers = new Map(serverDemoState.customers.map((customer) => [customer.id, customer]));
  const issues = validateRouteStops(route.date, driver, orders, customers, { maxRouteMinutes: 480 });
  orders.forEach((order) => {
    if (fixedAssignment(order) && order.scheduledDate && order.scheduledDate !== route.date) issues.push({ code: "locked_date", message: `${order.id} ist für den ${order.scheduledDate} vorgesehen` });
    if (fixedAssignment(order) && order.assignedDriverId && order.assignedDriverId !== route.driverId) issues.push({ code: "locked_assignment", message: `${order.id} ist ${order.assignedDriverId} zugewiesen` });
  });
  const warnings = Array.from(new Set(issues.map((issue) => issue.message)));
  if (warnings.length && !parsed.data.overrideReason) return errorResponse("Harte Regel verletzt", 422, { warnings, requiresOverrideReason: true });

  const before = structuredClone(route);
  const metrics = estimateRouteSequence(driver, orders, customers);
  route.stops = metrics.stops;
  route.distanceKm = metrics.distanceKm;
  route.travelMinutes = metrics.travelMinutes;
  route.serviceMinutes = metrics.serviceMinutes;
  const nextVersion = currentVersion + 1;
  serverRouteVersions.set(id, nextVersion);

  // Keep the assignment projection consistent with the route itself.
  const previousIds = new Set(before.stops.map((stop) => stop.workOrderId));
  const currentIds = new Set(stopIds);
  previousIds.forEach((workOrderId) => {
    if (currentIds.has(workOrderId)) return;
    const oldOrder = serverDemoState.workOrders.find((item) => item.id === workOrderId);
    if (oldOrder?.assignedDriverId === route.driverId && oldOrder.scheduledDate === route.date && !oldOrder.locked) {
      oldOrder.assignedDriverId = undefined;
      if (oldOrder.status === "planned") oldOrder.status = "backlog";
    }
  });
  orders.forEach((order) => {
    order.assignedDriverId = route.driverId;
    order.scheduledDate = route.date;
    if (["backlog", "offered", "confirmed"].includes(order.status)) order.status = "planned";
  });

  const responseBody = { route, version: nextVersion, warnings, overrideReason: parsed.data.overrideReason ?? null };
  serverAuditEvents.unshift({ id: `audit-${Date.now()}`, action: "route.updated", entityId: id, idempotencyKey: idempotencyKey ?? undefined, before, after: structuredClone(route), createdAt: new Date().toISOString() });
  if (idempotencyKey) serverIdempotency.set(idempotencyKey, { body: structuredClone(responseBody), status: 200, fingerprint });
  return NextResponse.json(responseBody, { headers: { "Cache-Control": "no-store" } });
}
