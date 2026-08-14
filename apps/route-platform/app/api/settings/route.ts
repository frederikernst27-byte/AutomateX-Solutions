import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { createSupabaseAdmin, mapSettingsRow, settingsToRow } from "@/lib/supabase-admin";
import { serverDemoState } from "@/lib/server-demo";

const settingsSchema = z.object({
  defaultMaxStops: z.number().int().min(1).max(20),
  defaultMaxTravelMinutes: z.number().int().min(15).max(720),
  defaultMaxRouteMinutes: z.number().int().min(60).max(960),
  autoConfirm: z.boolean(),
  gpsEnabled: z.boolean(),
  locationRetentionDays: z.number().int().min(1).max(365),
});

export async function GET(request: Request) {
  const auth = await requireAuth(request, { roles: ["admin"] });
  if (!auth.ok) return auth.response;
  if (auth.context.demo) return NextResponse.json({ settings: serverDemoState.settings }, { headers: { "Cache-Control": "no-store" } });
  const client = createSupabaseAdmin();
  if (!client) return NextResponse.json({ error: "Supabase-Administration ist nicht konfiguriert." }, { status: 503 });
  const { data, error } = await client.from("organization_settings").select("*").eq("org_id", auth.context.orgId).maybeSingle();
  if (error) return NextResponse.json({ error: "Einstellungen konnten nicht geladen werden." }, { status: 500 });
  return NextResponse.json({ settings: mapSettingsRow(data) }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  const auth = await requireAuth(request, { roles: ["admin"] });
  if (!auth.ok) return auth.response;
  if (auth.context.demo) {
    // The in-memory demo adapter keeps settings via /api/state; mirror the
    // value here so a demo client using this endpoint still succeeds.
    try {
      serverDemoState.settings = settingsSchema.parse(await request.json());
      return NextResponse.json({ settings: serverDemoState.settings });
    } catch {
      return NextResponse.json({ error: "Bitte alle Parameter korrekt angeben." }, { status: 400 });
    }
  }
  const client = createSupabaseAdmin();
  if (!client) return NextResponse.json({ error: "Supabase-Administration ist nicht konfiguriert." }, { status: 503 });
  try {
    const input = settingsSchema.parse(await request.json());
    const { data, error } = await client.from("organization_settings").upsert({ org_id: auth.context.orgId, ...settingsToRow(input) }, { onConflict: "org_id" }).select("*").single();
    if (error || !data) return NextResponse.json({ error: "Einstellungen konnten nicht gespeichert werden." }, { status: 500 });
    await client.from("audit_events").insert({ org_id: auth.context.orgId, actor_id: auth.context.userId, action: "settings.updated", entity_type: "organization_settings", entity_id: auth.context.orgId, after_state: settingsToRow(input), reason: "Planungsparameter durch Administration geändert" });
    return NextResponse.json({ settings: mapSettingsRow(data) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof z.ZodError ? "Bitte alle Parameter korrekt angeben." : "Einstellungen konnten nicht gespeichert werden." }, { status: 400 });
  }
}
