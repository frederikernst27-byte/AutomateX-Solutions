import { NextResponse } from "next/server";
import { z } from "zod";
import { addDays, currentBusinessDate } from "@/lib/utils";
import { portalTokenHash, publicPortalOrder, resolvePortalOrder, serverDemoState, serverIdempotency } from "@/lib/server-demo";

const actionSchema = z.object({
  action: z.enum(["confirm", "cancel", "alternative"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum muss im Format JJJJ-MM-TT angegeben werden").optional(),
});

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return true; // direct email clients may omit Origin
  try { return new URL(origin).host === host; } catch { return false; }
}

function isValidCalendarDate(value: string) {
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isAllowedPortalDate(date: string, allowWeekend = false) {
  if (!isValidCalendarDate(date)) return false;
  // Customer links may only choose a near-term slot. This also prevents a
  // forged year-2099 request from turning into an unbounded booking.
  const today = currentBusinessDate();
  return date >= today && date <= addDays(today, 90) && (allowWeekend || ![0, 6].includes(new Date(`${date}T12:00:00`).getDay()));
}

function hasBookingConflict(orderId: string, customerId: string, date: string, driverId?: string) {
  return serverDemoState.workOrders.some((other) => {
    if (other.id === orderId || ["cancelled", "completed"].includes(other.status) || other.scheduledDate !== date) return false;
    if (other.customerId === customerId) return true;
    return !!driverId && other.assignedDriverId === driverId;
  });
}

function compatibleDriver(order: typeof serverDemoState.workOrders[number], date: string) {
  const normalizedSpeciality = order.speciality.trim().toLocaleLowerCase("de-DE");
  return serverDemoState.drivers.find((driver) => {
    if (!driver.active || driver.daysOff.includes(date)) return false;
    const hasSkill = normalizedSpeciality === "wartung" || driver.skills.some((skill) => skill.trim().toLocaleLowerCase("de-DE") === normalizedSpeciality);
    if (!hasSkill) return false;
    const assigned = serverDemoState.workOrders.filter((candidate) => candidate.id !== order.id && candidate.assignedDriverId === driver.id && candidate.scheduledDate === date && !["cancelled", "completed"].includes(candidate.status)).length;
    return assigned < driver.maxStops;
  });
}

function alternativeSlots(order: typeof serverDemoState.workOrders[number]) {
  const slots: Array<{ date: string; window: string; driverId: string; driver: string }> = [];
  const today = currentBusinessDate();
  let date = order.scheduledDate && order.scheduledDate >= today ? order.scheduledDate : today;
  for (let offset = 0; offset < 90 && slots.length < 3; offset += 1) {
    date = addDays(date, 1);
    if (!isAllowedPortalDate(date) || hasBookingConflict(order.id, order.customerId, date)) continue;
    const driver = compatibleDriver(order, date);
    if (!driver || hasBookingConflict(order.id, order.customerId, date, driver.id)) continue;
    slots.push({ date, window: `${order.timeFrom}–${order.timeTo}`, driverId: driver.id, driver: driver.name });
  }
  return slots;
}

function safeResponse(order: typeof serverDemoState.workOrders[number], accepted = true) {
  const customer = serverDemoState.customers.find((item) => item.id === order.customerId);
  const route = serverDemoState.routes.find((item) => item.stops.some((stop) => stop.workOrderId === order.id) && item.status !== "draft");
  const stop = route?.stops.find((item) => item.workOrderId === order.id);
  const liveRoute = route ? {
    ...route,
    // Another customer's work-order id must never leak through currentStopId.
    currentStopId: route.currentStopId === order.id ? route.currentStopId : undefined,
    stops: stop ? [stop] : [],
    // Share live position only for the active appointment and only after the
    // driver has explicitly started location sharing (represented by the
    // route's lastLocation). Future stops must not track the vehicle.
    lastLocation: route.status === "started" && order.status === "en_route" && route.currentStopId === order.id
      ? route.lastLocation
      : undefined,
  } : null;
  const report = serverDemoState.reports.find((item) => item.workOrderId === order.id && item.confirmed);
  return { accepted, order: publicPortalOrder(order), customer, route: liveRoute ? { ...liveRoute, driverId: undefined } : null, alternatives: ["completed", "cancelled"].includes(order.status) ? [] : alternativeSlots(order), report: report ? { summary: report.summary, findings: report.findings.slice(0, 20), urgency: report.urgency, confirmed: report.confirmed } : null };
}

function replay(token: string, key: string | null, fingerprint: string) {
  if (!key) return undefined;
  const value = serverIdempotency.get(`portal:${portalTokenHash(token)}:${key}`) as { body: unknown; status: number; fingerprint?: string } | undefined;
  if (!value) return undefined;
  if (value.fingerprint && value.fingerprint !== fingerprint) return jsonError("Idempotency-Key wurde mit anderem Payload wiederverwendet", 409);
  return NextResponse.json(value.body, { status: value.status, headers: { "Cache-Control": "no-store", "Idempotent-Replay": "true" } });
}

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const resolved = resolvePortalOrder(token);
  if ("error" in resolved) return jsonError(resolved.error, resolved.status);
  const { order } = resolved;
  const body = safeResponse(order);
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  if (!sameOrigin(request)) return jsonError("Ungültiger Anfrageursprung", 403);
  const { token } = await context.params;
  const rawIdempotencyKey = request.headers.get("idempotency-key")?.trim();
  if (rawIdempotencyKey && rawIdempotencyKey.length > 200) return jsonError("Idempotency-Key ist zu lang", 400);
  const idempotencyKey = rawIdempotencyKey || null;
  let body: z.infer<typeof actionSchema>;
  try {
    body = actionSchema.parse(await request.json());
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Ungültige Aktion", 400);
  }
  const fingerprint = JSON.stringify(body);
  const replayed = replay(token, idempotencyKey, fingerprint);
  if (replayed) return replayed;
  const resolved = resolvePortalOrder(token);
  if ("error" in resolved) return jsonError(resolved.error, resolved.status);
  const { order, record } = resolved;
  if (["completed", "cancelled"].includes(order.status)) return jsonError("Dieser Termin kann nicht mehr geändert werden", 409);

  if (body.action === "cancel") {
    order.status = "cancelled";
    order.portalTokenRevokedAt = new Date().toISOString();
    record.revokedAt = order.portalTokenRevokedAt;
  } else {
    const selectedDate = body.date ?? order.scheduledDate;
    if (!selectedDate) return jsonError("Für den Auftrag ist kein Termin verfügbar", 422);
    if (body.action === "confirm") {
      if (!order.scheduledDate || selectedDate !== order.scheduledDate) return jsonError("Bestätigt werden kann nur der angebotene Termin", 422);
      if (!isAllowedPortalDate(selectedDate, true)) return jsonError("Der angebotene Termin liegt außerhalb des zulässigen Zeitraums", 422);
      if (hasBookingConflict(order.id, order.customerId, selectedDate, order.assignedDriverId)) return jsonError("Der Termin ist inzwischen nicht mehr verfügbar", 409);
    } else {
      if (!body.date) return jsonError("Für einen Alternativtermin ist ein Datum erforderlich", 400);
      const slot = alternativeSlots(order).find((candidate) => candidate.date === selectedDate);
      if (!slot) return jsonError("Der Alternativtermin ist inzwischen nicht mehr verfügbar", 409);
      order.assignedDriverId = slot.driverId;
    }
    order.scheduledDate = selectedDate;
    order.status = body.action === "confirm" ? "confirmed" : "offered";
  }
  const responseBody = safeResponse(order);
  if (idempotencyKey) serverIdempotency.set(`portal:${portalTokenHash(token)}:${idempotencyKey}`, { body: structuredClone(responseBody), status: 200, fingerprint });
  return NextResponse.json(responseBody, { headers: { "Cache-Control": "no-store" } });
}
