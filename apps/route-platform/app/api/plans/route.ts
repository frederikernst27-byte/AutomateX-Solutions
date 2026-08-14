import { NextResponse } from "next/server";
import { z } from "zod";
import { defaultConstraints, planDemoRoutes } from "@/lib/planner";
import { planWithVroom, VroomError } from "@/lib/vroom";
import { serverDemoState, serverIdempotency } from "@/lib/server-demo";
import { requireAuth } from "@/lib/auth";
import { loadPlanningState } from "@/lib/planning-store";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const schema = z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), driverAvailability: z.record(z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.array(z.string()).max(100)).default({}), driverIds: z.array(z.string()).default([]), defaultMaxStops: z.number().int().min(1).max(20).default(4), defaultMaxTravelMinutes: z.number().int().min(15).max(720).default(180), defaultMaxRouteMinutes: z.number().int().min(60).max(960).default(480), objectiveWeights: z.object({ due: z.number(), priority: z.number(), distance: z.number(), balance: z.number() }).default({ due: 1, priority: 1, distance: 1, balance: 1 }), hardRules: z.object({ specialities: z.boolean(), confirmedWindows: z.boolean(), maxStops: z.boolean(), maxTravel: z.boolean() }).default({ specialities: true, confirmedWindows: true, maxStops: true, maxTravel: true }) }).superRefine((value, context) => {
  const validDate = (date: string) => {
    const parsed = new Date(`${date}T12:00:00`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
  };
  const from = new Date(`${value.from}T12:00:00`).getTime();
  const to = new Date(`${value.to}T12:00:00`).getTime();
  const days = Math.round((to - from) / 86400000);
  if (!validDate(value.from)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["from"], message: "Startdatum ist kein gültiges Kalenderdatum" });
  if (!validDate(value.to)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["to"], message: "Enddatum ist kein gültiges Kalenderdatum" });
  if (!Number.isFinite(from) || !Number.isFinite(to) || days < 0) context.addIssue({ code: z.ZodIssueCode.custom, path: ["to"], message: "Enddatum muss nach dem Startdatum liegen" });
  if (days > 90) context.addIssue({ code: z.ZodIssueCode.custom, path: ["to"], message: "Planungszeitraum darf maximal 90 Tage umfassen" });
});

export async function POST(request: Request) {
  const auth = await requireAuth(request, { roles: ["admin"] });
  if (!auth.ok) return auth.response;
  try {
    const payload = await request.json();
    const constraints = schema.parse(payload);
    const rawIdempotencyKey = request.headers.get("idempotency-key")?.trim();
    if (rawIdempotencyKey && rawIdempotencyKey.length > 200) return NextResponse.json({ error: "Idempotency-Key ist zu lang" }, { status: 400 });
    const idempotencyKey = rawIdempotencyKey ? `${auth.context.orgId}:plan:${rawIdempotencyKey}` : undefined;
    const fingerprint = JSON.stringify(constraints);
    if (idempotencyKey) {
      const replay = serverIdempotency.get(idempotencyKey) as { body: unknown; status: number; fingerprint?: string } | undefined;
      if (replay) {
        if (replay.fingerprint && replay.fingerprint !== fingerprint) return NextResponse.json({ error: "Idempotency-Key wurde mit anderem Payload wiederverwendet" }, { status: 409 });
        return NextResponse.json(replay.body, { status: 200, headers: { "Cache-Control": "no-store", "Idempotent-Replay": "true" } });
      }
    }
    const planningState = auth.context.demo ? serverDemoState : await loadPlanningState(auth.context.orgId);
    // VROOM is the preferred solver because it uses road-network travel times.
    // A local installation is optional, though: dispatch must remain usable
    // during development or a temporary solver outage. The deterministic
    // fallback honours the same dates, skills, time windows and capacities.
    let result;
    try {
      result = await planWithVroom(planningState, constraints);
    } catch (error) {
      if (!(error instanceof VroomError) || error.status < 500) throw error;
      result = planDemoRoutes(planningState, constraints);
    }
    if (auth.context.demo) {
      serverDemoState.planningRuns.unshift(result);
    } else {
      const client = createSupabaseAdmin();
      if (!client) throw new VroomError("Supabase-Administration ist nicht konfiguriert.", 503);
      const runId = crypto.randomUUID();
      result = { ...result, runId };
      const { data: persisted, error: persistError } = await client.from("planning_runs").insert({ id: runId, org_id: auth.context.orgId, status: "completed", mode: result.mode, constraints, result, created_by: auth.context.userId, completed_at: new Date().toISOString() }).select("revision").single();
      if (persistError || !persisted) throw new VroomError("Der Routenplan konnte nicht gespeichert werden.", 500);
      result = { ...result, revision: persisted.revision };
      await client.from("planning_runs").update({ result }).eq("id", runId).eq("org_id", auth.context.orgId);
      await client.from("audit_events").insert({ org_id: auth.context.orgId, actor_id: auth.context.userId, action: `plan.${result.mode}.completed`, entity_type: "planning_run", entity_id: runId, after_state: { summary: result.summary }, reason: result.mode === "vroom" ? "Routen mit VROOM optimiert" : "Routen mit lokalem Optimierer berechnet" });
    }
    if (idempotencyKey) serverIdempotency.set(idempotencyKey, { body: structuredClone(result), status: 201, fingerprint });
    return NextResponse.json(result, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof VroomError ? error.status : error instanceof z.ZodError ? 400 : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Planung konnte nicht berechnet werden" }, { status });
  }
}

export async function GET(request: Request) {
  const auth = await requireAuth(request, { roles: ["admin"] });
  if (!auth.ok) return auth.response;
  if (auth.context.demo) {
    const base = defaultConstraints(serverDemoState.drivers);
    return NextResponse.json({ constraints: base, runs: serverDemoState.planningRuns.slice(0, 10), state: { drivers: serverDemoState.drivers, customers: serverDemoState.customers, workOrders: serverDemoState.workOrders, routes: serverDemoState.routes } }, { headers: { "Cache-Control": "no-store" } });
  }
  try {
    const state = await loadPlanningState(auth.context.orgId);
    const client = createSupabaseAdmin();
    const runsResponse = client ? await client.from("planning_runs").select("result").eq("org_id", auth.context.orgId).order("created_at", { ascending: false }).limit(10) : { data: [] };
    const runs = (runsResponse.data ?? []).map((row) => row.result).filter(Boolean);
    return NextResponse.json({ constraints: defaultConstraints(state.drivers), runs, state: { drivers: state.drivers, customers: state.customers, workOrders: state.workOrders, routes: state.routes } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Planungsdaten konnten nicht geladen werden." }, { status: 500 });
  }
}
