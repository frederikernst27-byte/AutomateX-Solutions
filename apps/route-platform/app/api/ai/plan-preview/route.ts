import { NextResponse } from "next/server";
import { z } from "zod";
import { aiPreviewToPlanningResult, createAiPlanPreview } from "@/lib/ai";
import { requireAuth } from "@/lib/auth";
import { loadPlanningState } from "@/lib/planning-store";
import { serverDemoState } from "@/lib/server-demo";

const schema = z.object({
  command: z.string().trim().min(3).max(8_000),
  constraints: z.object({
    from: z.string().date(), to: z.string().date(), driverAvailability: z.record(z.string(), z.array(z.string())).default({}), driverIds: z.array(z.string()),
    defaultMaxStops: z.number().int().min(1).max(20), defaultMaxTravelMinutes: z.number().int().min(15).max(720), defaultMaxRouteMinutes: z.number().int().min(60).max(960),
    objectiveWeights: z.object({ due: z.number(), priority: z.number(), distance: z.number(), balance: z.number() }), hardRules: z.object({ specialities: z.boolean(), confirmedWindows: z.boolean(), maxStops: z.boolean(), maxTravel: z.boolean() }),
  }),
});

export async function POST(request: Request) {
  const auth = await requireAuth(request, { roles: ["admin"] });
  if (!auth.ok) return auth.response;
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 32_000) return NextResponse.json({ error: "Anweisung ist zu lang." }, { status: 413 });
  try {
    const input = schema.parse(await request.json());
    const state = auth.context.demo ? serverDemoState : await loadPlanningState(auth.context.orgId);
    const aiOutput = await createAiPlanPreview({ command: input.command, state, constraints: input.constraints });
    const result = aiPreviewToPlanningResult(state, input.constraints, aiOutput);
    return NextResponse.json({ result, aiOutput }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof z.ZodError ? "Die Vorschau-Anfrage ist ungültig." : error instanceof Error ? error.message : "KI-Vorschau konnte nicht erstellt werden." }, { status: 400 });
  }
}
