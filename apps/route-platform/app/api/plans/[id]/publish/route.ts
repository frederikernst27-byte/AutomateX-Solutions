import { NextResponse } from "next/server";
import { publishPlanningRun, serverAuditEvents, serverDemoState, serverIdempotency } from "@/lib/server-demo";
import { requireAuth } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, { roles: ["admin"] });
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  if (!auth.context.demo) {
    const client = createSupabaseAdmin();
    if (!client) return NextResponse.json({ error: "Supabase-Administration ist nicht konfiguriert." }, { status: 503 });
    const { data: stored, error: loadError } = await client.from("planning_runs").select("status,result").eq("id", id).eq("org_id", auth.context.orgId).maybeSingle();
    if (loadError || !stored) return NextResponse.json({ error: "Planung nicht gefunden" }, { status: 404 });
    if (stored.status !== "published") {
      const { error: publishError } = await client.rpc("publish_vroom_plan", { p_org_id: auth.context.orgId, p_planning_run_id: id, p_actor_id: auth.context.userId, p_result: stored.result });
      if (publishError) return NextResponse.json({ error: "Der VROOM-Plan konnte nicht atomar veröffentlicht werden." }, { status: 409 });
    }
    return NextResponse.json({ ...(stored.result as object), publishedAt: new Date().toISOString(), idempotentReplay: stored.status === "published" }, { headers: { "Cache-Control": "no-store" } });
  }
  const run = serverDemoState.planningRuns.find((item) => item.runId === id);
  if (!run) return NextResponse.json({ error: "Planung nicht gefunden" }, { status: 404 });
  const rawIdempotencyKey = request.headers.get("idempotency-key")?.trim();
  if (rawIdempotencyKey && rawIdempotencyKey.length > 200) return NextResponse.json({ error: "Idempotency-Key ist zu lang" }, { status: 400 });
  const idempotencyKey = rawIdempotencyKey ? `${auth.context.orgId}:publish:${id}:${rawIdempotencyKey}` : undefined;
  if (idempotencyKey) {
    const replay = serverIdempotency.get(idempotencyKey) as { body: unknown; status: number } | undefined;
    if (replay) return NextResponse.json(replay.body, { status: 200, headers: { "Cache-Control": "no-store", "Idempotent-Replay": "true" } });
  }
  const alreadyPublished = run.routes.every((route) => route.status === "published");
  if (!alreadyPublished) {
    let before;
    try {
      ({ before } = publishPlanningRun(run));
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Plan kann nicht veröffentlicht werden" }, { status: 409 });
    }
    serverAuditEvents.unshift({ id: `audit-${Date.now()}`, action: "plan.published", entityId: id, idempotencyKey, before, after: run.routes, createdAt: new Date().toISOString() });
  }
  const body = { ...run, publishedAt: new Date().toISOString(), idempotentReplay: alreadyPublished };
  if (idempotencyKey) serverIdempotency.set(idempotencyKey, { body: structuredClone(body), status: 201 });
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}
