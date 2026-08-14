import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { recordDemoAudit, resetPortalTokenRecords, serverDemoState, serverIdempotency, serverRouteVersions } from "@/lib/server-demo";
import { loadPlanningState } from "@/lib/planning-store";

const patchSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("workOrder"), id: z.string().min(1), patch: z.record(z.unknown()) }),
  z.object({ type: z.literal("workOrderAdd"), workOrder: z.record(z.unknown()) }),
  z.object({ type: z.literal("driver"), id: z.string().min(1), patch: z.record(z.unknown()) }),
  z.object({ type: z.literal("route"), id: z.string().min(1), patch: z.record(z.unknown()) }),
  z.object({ type: z.literal("routes"), routes: z.array(z.record(z.unknown())).max(20_000) }),
  z.object({ type: z.literal("report"), report: z.record(z.unknown()) }),
  z.object({ type: z.literal("customers"), customers: z.array(z.record(z.unknown())).max(20_000) }),
  z.object({ type: z.literal("inbox"), id: z.string().min(1), patch: z.record(z.unknown()) }),
  z.object({ type: z.literal("notification"), notification: z.record(z.unknown()) }),
  z.object({ type: z.literal("settings"), settings: z.object({ defaultMaxStops: z.number().int().min(1).max(20), defaultMaxTravelMinutes: z.number().int().min(15).max(720), defaultMaxRouteMinutes: z.number().int().min(60).max(960), autoConfirm: z.boolean(), gpsEnabled: z.boolean(), locationRetentionDays: z.number().int().min(1).max(365) }) }),
  z.object({ type: z.literal("reset") }),
]);

function jsonState() {
  return NextResponse.json({ state: serverDemoState }, { headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  const auth = await requireAuth(request, { roles: ["admin"] });
  if (!auth.ok) return auth.response;
  if (!auth.context.demo) {
    try { return NextResponse.json({ state: await loadPlanningState(auth.context.orgId) }, { headers: { "Cache-Control": "no-store" } }); }
    catch { return NextResponse.json({ error: "Produktionsdaten konnten nicht geladen werden." }, { status: 500 }); }
  }
  return jsonState();
}

export async function PATCH(request: Request) {
  const auth = await requireAuth(request, { roles: ["admin"] });
  if (!auth.ok) return auth.response;
  if (!auth.context.demo) return NextResponse.json({ error: "Dieser Demo-Zustandsendpunkt ist für echte Konten nicht verfügbar." }, { status: 409 });
  try {
    const rawKey = request.headers.get("idempotency-key")?.trim();
    if (rawKey && rawKey.length > 200) return NextResponse.json({ error: "Idempotency-Key ist zu lang" }, { status: 400 });
    const key = rawKey ? `${auth.context.orgId}:state:${rawKey}` : undefined;
    const input = patchSchema.parse(await request.json());
    const fingerprint = JSON.stringify(input);
    if (key) {
      const replay = serverIdempotency.get(key) as { fingerprint: string; body: unknown } | undefined;
      if (replay) {
        if (replay.fingerprint !== fingerprint) return NextResponse.json({ error: "Idempotency-Key wurde mit anderem Payload wiederverwendet" }, { status: 409 });
        return NextResponse.json(replay.body, { headers: { "Cache-Control": "no-store", "Idempotent-Replay": "true" } });
      }
    }
    const before = structuredClone(serverDemoState);
    switch (input.type) {
      case "workOrder": {
        const item = serverDemoState.workOrders.find((value) => value.id === input.id);
        if (!item) return NextResponse.json({ error: "Auftrag nicht gefunden" }, { status: 404 });
        Object.assign(item, input.patch);
        break;
      }
      case "workOrderAdd": {
        const order = input.workOrder as unknown as typeof serverDemoState.workOrders[number];
        if (!order?.id || serverDemoState.workOrders.some((value) => value.id === order.id)) {
          return NextResponse.json({ error: "Auftrag fehlt oder existiert bereits" }, { status: 400 });
        }
        serverDemoState.workOrders.unshift(order);
        break;
      }
      case "driver": {
        const item = serverDemoState.drivers.find((value) => value.id === input.id);
        if (!item) return NextResponse.json({ error: "Fahrer nicht gefunden" }, { status: 404 });
        Object.assign(item, input.patch);
        break;
      }
      case "route": {
        const item = serverDemoState.routes.find((value) => value.id === input.id);
        if (!item) return NextResponse.json({ error: "Route nicht gefunden" }, { status: 404 });
        Object.assign(item, input.patch);
        break;
      }
      case "routes": {
        // The planning UI sends the current draft set, not a complete server
        // snapshot. Merge by route id so an admin refresh cannot accidentally
        // delete an active route that was published by another browser.
        const incoming = input.routes as unknown as typeof serverDemoState.routes;
        const incomingIds = new Set(incoming.map((route) => route.id));
        const incomingDayKeys = new Set(incoming.map((route) => `${route.driverId}:${route.date}`));
        const retained = serverDemoState.routes.filter((route) => {
          if (incomingIds.has(route.id)) return false;
          if (route.status === "draft" && incomingDayKeys.has(`${route.driverId}:${route.date}`)) return false;
          return true;
        });
        serverDemoState.routes = [...retained, ...incoming];
        break;
      }
      case "report":
        serverDemoState.reports.unshift(input.report as unknown as typeof serverDemoState.reports[number]);
        break;
      case "customers":
        serverDemoState.customers = input.customers as unknown as typeof serverDemoState.customers;
        break;
      case "inbox": {
        const item = serverDemoState.inbox.find((value) => value.id === input.id);
        if (!item) return NextResponse.json({ error: "Inbox-Eintrag nicht gefunden" }, { status: 404 });
        Object.assign(item, input.patch);
        break;
      }
      case "notification":
        serverDemoState.notifications.unshift(input.notification as unknown as typeof serverDemoState.notifications[number]);
        serverDemoState.notifications = serverDemoState.notifications.slice(0, 20);
        break;
      case "settings":
        serverDemoState.settings = input.settings;
        break;
      case "reset": {
        const fresh = (await import("@/lib/initial-state")).createEmptyState();
        Object.assign(serverDemoState, fresh);
        resetPortalTokenRecords();
        serverRouteVersions.clear();
        serverIdempotency.clear();
        break;
      }
    }
    serverDemoState.lastUpdated = new Date().toISOString();
    recordDemoAudit({
      action: `state.${input.type}`,
      entityType: input.type,
      entityId: "organization",
      idempotencyKey: key,
      before,
      after: structuredClone(serverDemoState),
    });
    const responseBody = { state: structuredClone(serverDemoState) };
    if (key) serverIdempotency.set(key, { fingerprint, body: responseBody });
    return NextResponse.json(responseBody, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Ungültige Zustandsänderung" }, { status: 400 });
  }
}
