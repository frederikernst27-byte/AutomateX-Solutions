import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { geocodeAddress } from "@/lib/geocode";
import { createSupabaseAdmin, mapDriverRow } from "@/lib/supabase-admin";
import { sendDriverInvitationEmail } from "@/lib/driver-invitation-email";

const inviteSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()).optional(),
  phone: z.string().trim().max(50).default(""),
  depot: z.string().trim().min(3).max(240),
  skills: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
  shiftStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).default("08:00"),
  shiftEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).default("17:00"),
  maxStops: z.number().int().min(1).max(20).default(4),
  maxTravelMinutes: z.number().int().min(30).max(600).default(180),
  testDriver: z.boolean().default(false),
}).superRefine((input, context) => {
  if (!input.testDriver && !input.email) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["email"], message: "Für eine Einladung ist eine E-Mail-Adresse erforderlich." });
  }
});

const updateSchema = z.object({
  id: z.string().uuid(),
  skills: z.array(z.string().trim().min(1).max(80)).max(30),
  shiftStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  shiftEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  maxStops: z.number().int().min(1).max(20),
  maxTravelMinutes: z.number().int().min(30).max(600),
  active: z.boolean(),
});

export async function GET(request: Request) {
  const auth = await requireAuth(request, { roles: ["admin"] });
  if (!auth.ok) return auth.response;
  if (auth.context.demo) return NextResponse.json({ drivers: [] }, { headers: { "Cache-Control": "no-store" } });
  const client = createSupabaseAdmin();
  if (!client) return NextResponse.json({ error: "Supabase-Administration ist nicht konfiguriert." }, { status: 503 });
  const { data, error } = await client.from("drivers").select("*").eq("org_id", auth.context.orgId).order("name");
  if (error) return NextResponse.json({ error: "Fahrer konnten nicht geladen werden." }, { status: 500 });
  return NextResponse.json({ drivers: (data ?? []).map((row) => mapDriverRow(row)) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const auth = await requireAuth(request, { roles: ["admin"] });
  if (!auth.ok) return auth.response;
  if (auth.context.demo) return NextResponse.json({ error: "Einladungen sind nur mit einem echten Admin-Konto möglich." }, { status: 409 });
  const client = createSupabaseAdmin();
  if (!client) return NextResponse.json({ error: "Supabase-Administration ist nicht konfiguriert." }, { status: 503 });
  try {
    const input = inviteSchema.parse(await request.json());
    if (input.shiftEnd <= input.shiftStart) return NextResponse.json({ error: "Das Schichtende muss nach dem Schichtbeginn liegen." }, { status: 400 });
    const depotLocation = await geocodeAddress(input.depot);
    if (!depotLocation) return NextResponse.json({ error: "Die Depotadresse konnte nicht eindeutig gefunden werden. Bitte Straße, Hausnummer, PLZ und Ort prüfen." }, { status: 422 });

    const initials = input.name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
    if (input.testDriver) {
      const { data: driver, error: driverError } = await client.from("drivers").insert({
        org_id: auth.context.orgId, name: input.name, email: null, phone: input.phone, initials,
        skills: input.skills, depot: input.depot, depot_lat: depotLocation.lat, depot_lng: depotLocation.lng,
        shift_start: input.shiftStart, shift_end: input.shiftEnd, max_stops: input.maxStops,
        max_travel_minutes: input.maxTravelMinutes, active: true, is_test: true,
      }).select("*").single();
      if (driverError || !driver) return NextResponse.json({ error: "Der Testfahrer konnte nicht gespeichert werden." }, { status: 500 });
      await client.from("audit_events").insert({ org_id: auth.context.orgId, actor_id: auth.context.userId, action: "driver.test_created", entity_type: "driver", entity_id: driver.id, after_state: { name: input.name }, reason: "Testfahrer ohne Zugang durch Administration angelegt" });
      return NextResponse.json({ driver: mapDriverRow(driver), invitationSent: false }, { status: 201 });
    }

    const email = input.email!;
    const { data: existing } = await client.from("drivers").select("id").eq("org_id", auth.context.orgId).ilike("email", email).maybeSingle();
    if (existing) return NextResponse.json({ error: "Für diese E-Mail-Adresse existiert bereits ein Fahrer." }, { status: 409 });

    const origin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || new URL(request.url).origin;
    // Supabase's invitation endpoint only confirms that it accepted a request;
    // it does not expose delivery status. Generate a one-time invite link and
    // send it through our configured transactional provider instead.
    const { data: invitation, error: invitationError } = await client.auth.admin.generateLink({
      type: "invite", email,
      options: { redirectTo: `${origin}/invite`, data: { role: "driver", org_id: auth.context.orgId, name: input.name } },
    });
    if (invitationError || !invitation.user || !invitation.properties.action_link) return NextResponse.json({ error: invitationError?.message || "Die Einladung konnte nicht erstellt werden." }, { status: 400 });
    const userId = invitation.user.id;
    const { data: driver, error: driverError } = await client.from("drivers").insert({
      org_id: auth.context.orgId, user_id: userId, name: input.name, email, phone: input.phone,
      initials, skills: input.skills, depot: input.depot, depot_lat: depotLocation.lat, depot_lng: depotLocation.lng, shift_start: input.shiftStart, shift_end: input.shiftEnd,
      max_stops: input.maxStops, max_travel_minutes: input.maxTravelMinutes, active: true,
    }).select("*").single();
    if (driverError || !driver) {
      await client.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: "Das Fahrerprofil konnte nicht gespeichert werden." }, { status: 500 });
    }
    const { error: membershipError } = await client.from("memberships").insert({ org_id: auth.context.orgId, user_id: userId, role: "driver" });
    if (membershipError) {
      await client.from("drivers").delete().eq("id", driver.id);
      await client.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: "Die Fahrerrolle konnte nicht zugewiesen werden." }, { status: 500 });
    }
    try {
      const emailId = await sendDriverInvitationEmail({ recipient: email, name: input.name, actionLink: invitation.properties.action_link });
      await client.from("audit_events").insert({ org_id: auth.context.orgId, actor_id: auth.context.userId, action: "driver.invited", entity_type: "driver", entity_id: driver.id, after_state: { name: input.name, email, emailId }, reason: "Fahrer vom Admin eingeladen; Zustellung über Transaktions-E-Mail angestoßen" });
    } catch (emailError) {
      await client.from("memberships").delete().eq("org_id", auth.context.orgId).eq("user_id", userId);
      await client.from("drivers").delete().eq("id", driver.id);
      await client.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: emailError instanceof Error ? `Die Einladung wurde nicht versendet: ${emailError.message}` : "Die Einladung wurde nicht versendet." }, { status: 502 });
    }
    return NextResponse.json({ driver: mapDriverRow(driver), invitationSent: true }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Bitte alle Pflichtfelder korrekt ausfüllen.", details: error.flatten() }, { status: 400 });
    return NextResponse.json({ error: "Die Fahrer-Einladung konnte nicht verarbeitet werden." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAuth(request, { roles: ["admin"] });
  if (!auth.ok) return auth.response;
  if (auth.context.demo) return NextResponse.json({ error: "Fahrerparameter benötigen ein echtes Admin-Konto." }, { status: 409 });
  const client = createSupabaseAdmin();
  if (!client) return NextResponse.json({ error: "Supabase-Administration ist nicht konfiguriert." }, { status: 503 });
  try {
    const input = updateSchema.parse(await request.json());
    if (input.shiftEnd <= input.shiftStart) return NextResponse.json({ error: "Das Schichtende muss nach dem Schichtbeginn liegen." }, { status: 400 });
    const { data: driver, error } = await client.from("drivers").update({
      skills: input.skills, shift_start: input.shiftStart, shift_end: input.shiftEnd,
      max_stops: input.maxStops, max_travel_minutes: input.maxTravelMinutes, active: input.active,
    }).eq("id", input.id).eq("org_id", auth.context.orgId).select("*").maybeSingle();
    if (error || !driver) return NextResponse.json({ error: "Fahrer konnte nicht gespeichert werden." }, { status: 404 });
    await client.from("audit_events").insert({ org_id: auth.context.orgId, actor_id: auth.context.userId, action: "driver.updated", entity_type: "driver", entity_id: driver.id, after_state: { skills: input.skills, active: input.active, maxStops: input.maxStops, maxTravelMinutes: input.maxTravelMinutes }, reason: "Fahrerparameter durch Administration geändert" });
    return NextResponse.json({ driver: mapDriverRow(driver) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof z.ZodError ? "Bitte alle Fahrerparameter korrekt angeben." : "Fahrerparameter konnten nicht gespeichert werden." }, { status: 400 });
  }
}
