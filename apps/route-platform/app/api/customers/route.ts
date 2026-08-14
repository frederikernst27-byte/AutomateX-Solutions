import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { geocodeAddress } from "@/lib/geocode";
import { createSupabaseAdmin, mapCustomerRow } from "@/lib/supabase-admin";

const archiveMarker = /^\[\[automatex:archived:[^\]]+\]\]\n?/;

const customerSchema = z.object({
  name: z.string().trim().min(2).max(160), contact: z.string().trim().max(160).default(""),
  email: z.union([z.string().trim().email().max(254), z.literal("")]).default(""), phone: z.string().trim().max(50).default(""),
  site: z.string().trim().min(1).max(160).default("Hauptstandort"), address: z.string().trim().min(5).max(300),
  asset: z.string().trim().max(200).default(""), speciality: z.string().trim().min(1).max(80),
  intervalMonths: z.number().int().min(1).max(120).default(12), nextDue: z.string().date(),
  sla: z.enum(["Standard", "SLA 24h", "SLA 48h"]).default("Standard"), notes: z.string().trim().max(4000).optional(),
});

const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(2).max(160).optional(),
  contact: z.string().trim().max(160).optional(),
  email: z.union([z.string().trim().email().max(254), z.literal("")]).optional(),
  phone: z.string().trim().max(50).optional(),
  site: z.string().trim().min(1).max(160).optional(),
  address: z.string().trim().min(5).max(300).optional(),
  asset: z.string().trim().max(200).optional(),
  speciality: z.string().trim().min(1).max(80).optional(),
  intervalMonths: z.number().int().min(1).max(120).optional(),
  nextDue: z.string().date().optional(),
  sla: z.enum(["Standard", "SLA 24h", "SLA 48h"]).optional(),
  notes: z.string().trim().max(4000).optional(),
  archived: z.boolean().optional(),
});

export async function GET(request: Request) {
  const auth = await requireAuth(request, { roles: ["admin"] });
  if (!auth.ok) return auth.response;
  if (auth.context.demo) return NextResponse.json({ customers: [] }, { headers: { "Cache-Control": "no-store" } });
  const client = createSupabaseAdmin();
  if (!client) return NextResponse.json({ error: "Supabase-Administration ist nicht konfiguriert." }, { status: 503 });
  const { data, error } = await client.from("customers").select("*").eq("org_id", auth.context.orgId).order("name");
  if (error) return NextResponse.json({ error: "Kunden konnten nicht geladen werden." }, { status: 500 });
  return NextResponse.json({ customers: (data ?? []).map((row) => mapCustomerRow(row)) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const auth = await requireAuth(request, { roles: ["admin"] });
  if (!auth.ok) return auth.response;
  if (auth.context.demo) return NextResponse.json({ error: "Kunden können nur mit einem echten Admin-Konto gespeichert werden." }, { status: 409 });
  const client = createSupabaseAdmin();
  if (!client) return NextResponse.json({ error: "Supabase-Administration ist nicht konfiguriert." }, { status: 503 });
  try {
    const input = customerSchema.parse(await request.json());
    const location = await geocodeAddress(input.address);
    if (!location) return NextResponse.json({ error: "Die Adresse konnte nicht eindeutig gefunden werden. Bitte Straße, Hausnummer, PLZ und Ort prüfen." }, { status: 422 });
    const { data, error } = await client.from("customers").insert({
      org_id: auth.context.orgId, name: input.name, contact: input.contact, email: input.email, phone: input.phone,
      site: input.site, address: input.address, lat: location.lat, lng: location.lng, asset: input.asset,
      speciality: input.speciality, interval_months: input.intervalMonths, next_due: input.nextDue,
      sla: input.sla, notes: input.notes || null,
    }).select("*").single();
    if (error || !data) return NextResponse.json({ error: "Der Kunde konnte nicht gespeichert werden." }, { status: 500 });
    await client.from("audit_events").insert({ org_id: auth.context.orgId, actor_id: auth.context.userId, action: "customer.created", entity_type: "customer", entity_id: data.id, after_state: { name: input.name, address: input.address }, reason: "Kunde vom Admin angelegt" });
    return NextResponse.json({ customer: mapCustomerRow(data) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Bitte alle Pflichtfelder korrekt ausfüllen.", details: error.flatten() }, { status: 400 });
    return NextResponse.json({ error: "Der Kunde konnte nicht verarbeitet werden." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAuth(request, { roles: ["admin"] });
  if (!auth.ok) return auth.response;
  if (auth.context.demo) return NextResponse.json({ error: "Kunden können nur mit einem echten Admin-Konto bearbeitet werden." }, { status: 409 });
  const client = createSupabaseAdmin();
  if (!client) return NextResponse.json({ error: "Supabase-Administration ist nicht konfiguriert." }, { status: 503 });
  try {
    const input = updateSchema.parse(await request.json());
    const { id, ...fields } = input;
    if (Object.keys(fields).length === 0) return NextResponse.json({ error: "Keine Änderungen übermittelt." }, { status: 400 });

    const { data: existing, error: lookupError } = await client.from("customers").select("id,address,notes").eq("id", id).eq("org_id", auth.context.orgId).maybeSingle();
    if (lookupError || !existing) return NextResponse.json({ error: "Der Kunde gehört nicht zu deiner Organisation." }, { status: 404 });

    const patch: Record<string, unknown> = {};
    if (fields.name !== undefined) patch.name = fields.name;
    if (fields.contact !== undefined) patch.contact = fields.contact;
    if (fields.email !== undefined) patch.email = fields.email;
    if (fields.phone !== undefined) patch.phone = fields.phone;
    if (fields.site !== undefined) patch.site = fields.site;
    if (fields.asset !== undefined) patch.asset = fields.asset;
    if (fields.speciality !== undefined) patch.speciality = fields.speciality;
    if (fields.intervalMonths !== undefined) patch.interval_months = fields.intervalMonths;
    if (fields.nextDue !== undefined) patch.next_due = fields.nextDue;
    if (fields.sla !== undefined) patch.sla = fields.sla;
    if (fields.notes !== undefined) patch.notes = fields.notes || null;
    if (fields.archived !== undefined) patch.archived_at = fields.archived ? new Date().toISOString() : null;

    // Only re-geocode when the address actually changed, so a location edit
    // never silently drops the pin on an unrelated address lookup.
    if (fields.address !== undefined && fields.address !== existing.address) {
      const location = await geocodeAddress(fields.address);
      if (!location) return NextResponse.json({ error: "Die neue Adresse konnte nicht eindeutig gefunden werden. Bitte Straße, Hausnummer, PLZ und Ort prüfen." }, { status: 422 });
      patch.address = fields.address;
      patch.lat = location.lat;
      patch.lng = location.lng;
    }

    let { data, error } = await client.from("customers").update(patch).eq("id", id).eq("org_id", auth.context.orgId).select("*").single();
    // Older installations may not have the archive migration yet. Keep the
    // feature operational there by storing a clearly namespaced marker in the
    // existing notes field; mapCustomerRow strips it before it reaches the UI.
    if ((error?.code === "42703" || error?.code === "PGRST204") && fields.archived !== undefined) {
      delete patch.archived_at;
      const cleanNotes = (existing.notes ?? "").replace(archiveMarker, "");
      patch.notes = fields.archived ? `[[automatex:archived:${new Date().toISOString()}]]\n${cleanNotes}` : cleanNotes || null;
      ({ data, error } = await client.from("customers").update(patch).eq("id", id).eq("org_id", auth.context.orgId).select("*").single());
    }
    if (error || !data) return NextResponse.json({ error: "Der Kunde konnte nicht gespeichert werden." }, { status: 500 });
    await client.from("audit_events").insert({ org_id: auth.context.orgId, actor_id: auth.context.userId, action: fields.archived === undefined ? "customer.updated" : fields.archived ? "customer.archived" : "customer.restored", entity_type: "customer", entity_id: data.id, after_state: patch, reason: fields.archived === undefined ? "Kundenstammdaten vom Admin geändert" : fields.archived ? "Kunde archiviert" : "Kunde aus dem Archiv wiederhergestellt" });
    return NextResponse.json({ customer: mapCustomerRow(data) });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Bitte alle Felder korrekt ausfüllen.", details: error.flatten() }, { status: 400 });
    return NextResponse.json({ error: "Der Kunde konnte nicht verarbeitet werden." }, { status: 500 });
  }
}
