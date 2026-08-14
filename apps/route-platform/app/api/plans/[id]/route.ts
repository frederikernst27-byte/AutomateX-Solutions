import { NextResponse } from "next/server";
import { z } from "zod";
import { estimateRouteSequence, validateRouteStops } from "@/lib/planner";
import { loadPlanningState } from "@/lib/planning-store";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { requireAuth } from "@/lib/auth";
import { publishPlanningRun, serverDemoState } from "@/lib/server-demo";
import type { PlanningConstraints, PlanningResult, Route, WorkOrder } from "@/lib/types";

const draftSchema = z.object({
  revision: z.number().int().min(1),
  routes: z.array(z.object({
    id: z.string().min(1).max(180), date: z.string().date(), driverId: z.string().min(1).max(180),
    stops: z.array(z.object({ workOrderId: z.string().min(1).max(180) })).max(20),
  })).max(180),
});

function draftResult(base: PlanningResult, routes: Route[], workOrders: WorkOrder[], operationalRoutes: Route[]): PlanningResult {
  const assignedIds = new Set(routes.flatMap((route) => route.stops.map((stop) => stop.workOrderId)));
  const operationalIds = new Set(operationalRoutes.filter((route) => !["draft", "cancelled"].includes(route.status)).flatMap((route) => route.stops.map((stop) => stop.workOrderId)));
  const previousReasons = new Map(base.unassigned.map((item) => [item.workOrderId, item.reason]));
  const unassigned = workOrders.filter((order) => !["completed", "cancelled"].includes(order.status) && !assignedIds.has(order.id) && !operationalIds.has(order.id)).map((order) => ({ workOrderId: order.id, reason: previousReasons.get(order.id) ?? "Manuell nicht eingeplant" }));
  return {
    ...base,
    routes,
    unassigned,
    summary: { assigned: assignedIds.size, unassigned: unassigned.length, distanceKm: Number(routes.reduce((sum, route) => sum + route.distanceKm, 0).toFixed(1)), travelMinutes: routes.reduce((sum, route) => sum + route.travelMinutes, 0) },
  };
}

function validateAndCalculate(input: z.infer<typeof draftSchema>, state: Awaited<ReturnType<typeof loadPlanningState>>, constraints: PlanningConstraints, base: PlanningResult) {
  const drivers = new Map(state.drivers.map((driver) => [driver.id, driver]));
  const orders = new Map(state.workOrders.map((order) => [order.id, order]));
  const customers = new Map(state.customers.map((customer) => [customer.id, customer]));
  const seenOrders = new Set<string>();
  const seenDriverDays = new Set<string>();
  const routes: Route[] = [];
  for (const routeInput of input.routes) {
    if (!routeInput.stops.length) continue;
    const key = `${routeInput.driverId}:${routeInput.date}`;
    if (seenDriverDays.has(key)) throw new Error("Ein Fahrer kann pro Tag nur eine Tour haben.");
    seenDriverDays.add(key);
    if (routeInput.date < constraints.from || routeInput.date > constraints.to || [0, 6].includes(new Date(`${routeInput.date}T12:00:00`).getDay())) throw new Error("Eine manuelle Tour muss innerhalb eines Arbeitstags im Planungszeitraum liegen.");
    const driver = drivers.get(routeInput.driverId);
    if (!driver || !driver.active) throw new Error("Der ausgewählte Fahrer ist nicht aktiv.");
    const available = constraints.driverAvailability?.[routeInput.date] ?? constraints.driverIds;
    if (!available.includes(driver.id)) throw new Error(`${driver.name} ist für diesen Tag nicht in der Tagesbesetzung.`);
    const routeOrders = routeInput.stops.map((stop) => {
      if (seenOrders.has(stop.workOrderId)) throw new Error("Ein Auftrag darf nur einmal im Entwurf vorkommen.");
      seenOrders.add(stop.workOrderId);
      const order = orders.get(stop.workOrderId);
      if (!order || ["completed", "cancelled"].includes(order.status)) throw new Error("Ein ausgewählter Auftrag ist nicht mehr planbar.");
      if (order.deadlineDate && routeInput.date > order.deadlineDate) throw new Error(`${order.title} ist nur bis ${order.deadlineDate} planbar.`);
      const fixed = order.locked || ["confirmed", "en_route", "on_site"].includes(order.status);
      if (fixed && order.scheduledDate && order.scheduledDate !== routeInput.date) throw new Error(`${order.title} hat einen festen Termin am ${order.scheduledDate}.`);
      if (fixed && order.assignedDriverId && order.assignedDriverId !== driver.id) throw new Error(`${order.title} ist fest ${order.assignedDriverId} zugewiesen.`);
      return order;
    });
    const effectiveDriver = { ...driver, maxStops: constraints.hardRules.maxStops ? Math.min(driver.maxStops, constraints.defaultMaxStops) : driver.maxStops, maxTravelMinutes: constraints.hardRules.maxTravel ? Math.min(driver.maxTravelMinutes, constraints.defaultMaxTravelMinutes) : driver.maxTravelMinutes };
    const issues = validateRouteStops(routeInput.date, effectiveDriver, routeOrders, customers, { maxRouteMinutes: constraints.defaultMaxRouteMinutes, enforceSpecialities: constraints.hardRules.specialities, enforceWindows: constraints.hardRules.confirmedWindows, enforceMaxStops: constraints.hardRules.maxStops, enforceMaxTravel: constraints.hardRules.maxTravel });
    if (issues.length) throw new Error(issues[0].message);
    const estimated = estimateRouteSequence(effectiveDriver, routeOrders, customers);
    routes.push({ id: routeInput.id.startsWith("manual-") ? `draft-${driver.id}-${routeInput.date}` : routeInput.id, date: routeInput.date, driverId: driver.id, status: "draft", ...estimated });
  }
  return draftResult(base, routes, state.workOrders, state.routes);
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, { roles: ["admin"] });
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  if (auth.context.demo) {
    const run = serverDemoState.planningRuns.find((item) => item.runId === id);
    return run ? NextResponse.json(run, { headers: { "Cache-Control": "no-store" } }) : NextResponse.json({ error: "Planung nicht gefunden" }, { status: 404 });
  }
  const client = createSupabaseAdmin();
  if (!client) return NextResponse.json({ error: "Supabase-Administration ist nicht konfiguriert." }, { status: 503 });
  const { data, error } = await client.from("planning_runs").select("result,revision").eq("id", id).eq("org_id", auth.context.orgId).maybeSingle();
  if (error || !data?.result) return NextResponse.json({ error: "Planung nicht gefunden" }, { status: 404 });
  return NextResponse.json({ ...(data.result as PlanningResult), revision: data.revision }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, { roles: ["admin"] });
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  try {
    const input = draftSchema.parse(await request.json());
    if (auth.context.demo) {
      const run = serverDemoState.planningRuns.find((item) => item.runId === id);
      if (!run) return NextResponse.json({ error: "Planung nicht gefunden" }, { status: 404 });
      if ((run.revision ?? 1) !== input.revision) return NextResponse.json({ error: "Der Entwurf wurde inzwischen geändert. Bitte neu laden.", result: run }, { status: 409 });
      const result = validateAndCalculate(input, serverDemoState, run.constraints, run);
      Object.assign(run, result, { revision: input.revision + 1 });
      return NextResponse.json(run, { headers: { "Cache-Control": "no-store" } });
    }
    const client = createSupabaseAdmin();
    if (!client) return NextResponse.json({ error: "Supabase-Administration ist nicht konfiguriert." }, { status: 503 });
    const { data: stored, error: storedError } = await client.from("planning_runs").select("status,result,constraints,revision").eq("id", id).eq("org_id", auth.context.orgId).maybeSingle();
    if (storedError || !stored?.result) return NextResponse.json({ error: "Planung nicht gefunden" }, { status: 404 });
    if (stored.status === "published") return NextResponse.json({ error: "Ein veröffentlichter Plan kann nicht mehr bearbeitet werden." }, { status: 409 });
    if (stored.revision !== input.revision) return NextResponse.json({ error: "Der Entwurf wurde inzwischen geändert. Bitte neu laden.", result: { ...(stored.result as PlanningResult), revision: stored.revision } }, { status: 409 });
    const state = await loadPlanningState(auth.context.orgId);
    const result = validateAndCalculate(input, state, stored.constraints as PlanningConstraints, stored.result as PlanningResult);
    const nextRevision = input.revision + 1;
    result.revision = nextRevision;
    const { data: updated, error: updateError } = await client.from("planning_runs").update({ result, revision: nextRevision }).eq("id", id).eq("org_id", auth.context.orgId).eq("revision", input.revision).select("revision").maybeSingle();
    if (updateError) throw new Error("Entwurf konnte nicht gespeichert werden.");
    if (!updated) return NextResponse.json({ error: "Der Entwurf wurde inzwischen geändert. Bitte neu laden." }, { status: 409 });
    await client.from("audit_events").insert({ org_id: auth.context.orgId, actor_id: auth.context.userId, action: "plan.draft.updated", entity_type: "planning_run", entity_id: id, after_state: { revision: nextRevision, summary: result.summary }, reason: "Manuelle Routenänderung gespeichert" });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof z.ZodError ? "Ungültige Entwurfsänderung." : error instanceof Error ? error.message : "Entwurf konnte nicht gespeichert werden." }, { status: error instanceof z.ZodError ? 400 : 422 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, { roles: ["admin"] });
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  if (!auth.context.demo) return NextResponse.json({ error: "Zum Veröffentlichen bitte den Publish-Endpunkt verwenden." }, { status: 405 });
  const run = serverDemoState.planningRuns.find((item) => item.runId === id);
  if (!run) return NextResponse.json({ error: "Planung nicht gefunden" }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  if (body.action !== "publish") return NextResponse.json({ error: "Nur action=publish wird unterstützt" }, { status: 400 });
  try { publishPlanningRun(run); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Plan kann nicht veröffentlicht werden" }, { status: 409 }); }
  return NextResponse.json({ ...run, publishedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
}
