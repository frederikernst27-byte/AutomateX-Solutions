import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { geocodeAddresses } from "@/lib/geocode";
import { createSupabaseAdmin, mapCustomerRow } from "@/lib/supabase-admin";

const rowSchema = z.object({
  name: z.string().trim().min(1).max(160),
  contact: z.string().trim().max(160).optional(),
  email: z.union([z.string().trim().email().max(254), z.literal("")]).optional(),
  phone: z.string().trim().max(50).optional(),
  address: z.string().trim().min(3).max(300),
  asset: z.string().trim().max(200).optional(),
  speciality: z.string().trim().min(1).max(80).optional(),
  nextDue: z.union([z.string().date(), z.literal("")]).optional(),
  intervalMonths: z.number().int().min(1).max(120).optional(),
  sla: z.enum(["Standard", "SLA 24h", "SLA 48h"]).optional(),
  site: z.string().trim().max(160).optional(),
});

const bodySchema = z.object({ customers: z.array(rowSchema).min(1).max(5000) });

export async function POST(request: Request) {
  const auth = await requireAuth(request, { roles: ["admin"] });
  if (!auth.ok) return auth.response;
  if (auth.context.demo) return NextResponse.json({ error: "Der Import benötigt ein echtes Admin-Konto." }, { status: 409 });
  const client = createSupabaseAdmin();
  if (!client) return NextResponse.json({ error: "Supabase-Administration ist nicht konfiguriert." }, { status: 503 });
  try {
    const { customers } = bodySchema.parse(await request.json());
    // Geocode every address once, server-side, so precise coordinates are
    // stored from the start. Rows that cannot be located are still imported
    // (lat/lng stay null) and flagged so an admin can correct them later.
    const coordinates = await geocodeAddresses(customers.map((row) => row.address));
    let located = 0;
    const rows = customers.map((row, index) => {
      const coords = coordinates[index];
      if (coords) located += 1;
      return {
        org_id: auth.context.orgId,
        name: row.name,
        contact: row.contact || row.name,
        email: row.email || "",
        phone: row.phone || "",
        site: row.site || "Importierter Standort",
        address: row.address,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        asset: row.asset || "",
        speciality: row.speciality || "Wartung",
        interval_months: row.intervalMonths ?? 12,
        next_due: row.nextDue || null,
        sla: row.sla || "Standard",
        notes: coords ? "Importiert · geokodiert" : "Importiert · Adresse nicht auffindbar",
      };
    });
    const { data, error } = await client.from("customers").insert(rows).select("*");
    if (error || !data) return NextResponse.json({ error: "Die Kunden konnten nicht importiert werden." }, { status: 500 });
    await client.from("audit_events").insert({ org_id: auth.context.orgId, actor_id: auth.context.userId, action: "customer.imported", entity_type: "customer", entity_id: auth.context.orgId, after_state: { imported: data.length, located }, reason: "Kundenimport durch Administration" });
    return NextResponse.json({ customers: data.map((row) => mapCustomerRow(row)), imported: data.length, located }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Die Importdaten sind unvollständig oder ungültig." }, { status: 400 });
    return NextResponse.json({ error: "Der Import konnte nicht verarbeitet werden." }, { status: 500 });
  }
}
