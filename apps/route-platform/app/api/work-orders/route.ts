import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const schema = z.object({
  customerId: z.string().uuid(), title: z.string().trim().min(2).max(240),
  kind: z.enum(["Wartung", "Reparatur", "Notfall", "Inspektion"]).default("Wartung"),
  timeFrom: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).default("08:00"),
  timeTo: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).default("16:00"),
  deadlineDate: z.union([z.string().date(), z.literal("")]).optional(),
  durationMinutes: z.number().int().min(15).max(720).default(90), priority: z.number().int().min(1).max(4).default(2),
  speciality: z.string().trim().min(1).max(80), notes: z.string().trim().max(4000).default(""),
});

const WORK_ORDER_STATUS = ["backlog", "offered", "confirmed", "planned", "en_route", "on_site", "completed", "cancelled", "needs_followup"] as const;

const updateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(WORK_ORDER_STATUS).optional(),
  locked: z.boolean().optional(),
  scheduledDate: z.union([z.string().date(), z.literal("")]).optional(),
  assignedDriverId: z.union([z.string().uuid(), z.literal("")]).optional(),
});

function serializeWorkOrder(data: Record<string, unknown>) {
  return { id: data.id, customerId: data.customer_id, title: data.title, kind: data.kind, status: data.status, scheduledDate: data.scheduled_date ?? undefined, deadlineDate: data.deadline_date ?? undefined, timeFrom: String(data.time_from ?? "08:00").slice(0, 5), timeTo: String(data.time_to ?? "17:00").slice(0, 5), durationMinutes: data.duration_minutes, priority: data.priority, speciality: data.speciality, locked: data.locked === true, assignedDriverId: data.assigned_driver_id ?? undefined, notes: data.notes ?? "", portalToken: "", createdAt: data.created_at };
}

export async function POST(request: Request) {
  const auth = await requireAuth(request, { roles: ["admin"] });
  if (!auth.ok) return auth.response;
  if (auth.context.demo) return NextResponse.json({ error: "Aufträge benötigen ein echtes Admin-Konto." }, { status: 409 });
  const client = createSupabaseAdmin();
  if (!client) return NextResponse.json({ error: "Supabase-Administration ist nicht konfiguriert." }, { status: 503 });
  try {
    const input = schema.parse(await request.json());
    if (input.timeTo <= input.timeFrom) return NextResponse.json({ error: "Das Zeitfenster muss nach dem Start liegen." }, { status: 400 });
    const { data: customer, error: customerError } = await client.from("customers").select("id").eq("id", input.customerId).eq("org_id", auth.context.orgId).maybeSingle();
    if (customerError || !customer) return NextResponse.json({ error: "Der Kunde gehört nicht zu deiner Organisation." }, { status: 404 });
    const { data, error } = await client.from("work_orders").insert({
      org_id: auth.context.orgId, customer_id: input.customerId, title: input.title, kind: input.kind, status: "backlog",
      time_from: input.timeFrom, time_to: input.timeTo, duration_minutes: input.durationMinutes,
      priority: input.priority, speciality: input.speciality, deadline_date: input.deadlineDate || null, notes: input.notes || null,
    }).select("*").single();
    if (error || !data) return NextResponse.json({ error: "Der Auftrag konnte nicht gespeichert werden." }, { status: 500 });
    await client.from("audit_events").insert({ org_id: auth.context.orgId, actor_id: auth.context.userId, action: "work_order.created", entity_type: "work_order", entity_id: data.id, after_state: { customerId: input.customerId, title: input.title }, reason: "Auftrag im Kundenprofil angelegt" });
    return NextResponse.json({ workOrder: { id: data.id, customerId: data.customer_id, title: data.title, kind: data.kind, status: data.status, deadlineDate: data.deadline_date ?? undefined, timeFrom: String(data.time_from).slice(0, 5), timeTo: String(data.time_to).slice(0, 5), durationMinutes: data.duration_minutes, priority: data.priority, speciality: data.speciality, locked: data.locked, notes: data.notes ?? "", portalToken: "", createdAt: data.created_at } }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof z.ZodError ? "Bitte alle Auftragsdaten korrekt angeben." : "Der Auftrag konnte nicht verarbeitet werden." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAuth(request, { roles: ["admin"] });
  if (!auth.ok) return auth.response;
  if (auth.context.demo) return NextResponse.json({ error: "Aufträge benötigen ein echtes Admin-Konto." }, { status: 409 });
  const client = createSupabaseAdmin();
  if (!client) return NextResponse.json({ error: "Supabase-Administration ist nicht konfiguriert." }, { status: 503 });
  try {
    const input = updateSchema.parse(await request.json());
    const patch: Record<string, unknown> = {};
    if (input.status !== undefined) patch.status = input.status;
    if (input.locked !== undefined) patch.locked = input.locked;
    if (input.scheduledDate !== undefined) patch.scheduled_date = input.scheduledDate || null;
    if (input.assignedDriverId !== undefined) patch.assigned_driver_id = input.assignedDriverId || null;
    if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Keine Änderungen übermittelt." }, { status: 400 });

    const { data, error } = await client.from("work_orders").update(patch).eq("id", input.id).eq("org_id", auth.context.orgId).select("*").maybeSingle();
    if (error || !data) return NextResponse.json({ error: "Der Auftrag gehört nicht zu deiner Organisation." }, { status: 404 });
    await client.from("audit_events").insert({ org_id: auth.context.orgId, actor_id: auth.context.userId, action: "work_order.updated", entity_type: "work_order", entity_id: data.id, after_state: patch, reason: "Auftrag durch Administration geändert" });
    return NextResponse.json({ workOrder: serializeWorkOrder(data) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof z.ZodError ? "Bitte gültige Auftragsänderungen übermitteln." : "Der Auftrag konnte nicht verarbeitet werden." }, { status: 400 });
  }
}
