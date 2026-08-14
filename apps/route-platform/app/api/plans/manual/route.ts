import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { loadPlanningState } from "@/lib/planning-store";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { serverDemoState } from "@/lib/server-demo";
import type { PlanningConstraints, PlanningResult } from "@/lib/types";

const schema = z.object({
  from: z.string().date(), to: z.string().date(), driverAvailability: z.record(z.array(z.string())).default({}), driverIds: z.array(z.string()).default([]),
  defaultMaxStops: z.number().int().min(1).max(20), defaultMaxTravelMinutes: z.number().int().min(15).max(720), defaultMaxRouteMinutes: z.number().int().min(60).max(960),
  objectiveWeights: z.object({ due: z.number(), priority: z.number(), distance: z.number(), balance: z.number() }),
  hardRules: z.object({ specialities: z.boolean(), confirmedWindows: z.boolean(), maxStops: z.boolean(), maxTravel: z.boolean() }),
}).refine((value) => value.to >= value.from, { message: "Enddatum muss nach dem Startdatum liegen." });

export async function POST(request: Request) {
  const auth = await requireAuth(request, { roles: ["admin"] });
  if (!auth.ok) return auth.response;
  try {
    const constraints = schema.parse(await request.json()) as PlanningConstraints;
    const state = auth.context.demo ? serverDemoState : await loadPlanningState(auth.context.orgId);
    const result: PlanningResult = { runId: crypto.randomUUID(), mode: "manual", status: "completed", createdAt: new Date().toISOString(), constraints, routes: [], unassigned: state.workOrders.filter((order) => !["completed", "cancelled"].includes(order.status)).map((order) => ({ workOrderId: order.id, reason: "Manuell noch nicht eingeplant" })), summary: { assigned: 0, unassigned: state.workOrders.filter((order) => !["completed", "cancelled"].includes(order.status)).length, distanceKm: 0, travelMinutes: 0 }, revision: 1 };
    if (auth.context.demo) {
      serverDemoState.planningRuns.unshift(result);
      return NextResponse.json(result, { status: 201, headers: { "Cache-Control": "no-store" } });
    }
    const client = createSupabaseAdmin();
    if (!client) return NextResponse.json({ error: "Supabase-Administration ist nicht konfiguriert." }, { status: 503 });
    const { error } = await client.from("planning_runs").insert({ id: result.runId, org_id: auth.context.orgId, status: "completed", mode: "manual", constraints, result, revision: 1, created_by: auth.context.userId, completed_at: result.createdAt });
    if (error) throw new Error("Manueller Entwurf konnte nicht angelegt werden. Bitte zuerst die Migration 0009 anwenden.");
    await client.from("audit_events").insert({ org_id: auth.context.orgId, actor_id: auth.context.userId, action: "plan.manual.created", entity_type: "planning_run", entity_id: result.runId, after_state: { constraints }, reason: "Leerer Entwurf für manuelle Planung erstellt" });
    return NextResponse.json(result, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof z.ZodError ? "Ungültige Planungsparameter." : error instanceof Error ? error.message : "Manueller Entwurf konnte nicht angelegt werden." }, { status: 400 });
  }
}
