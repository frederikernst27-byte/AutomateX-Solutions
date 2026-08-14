import { createEmptyState } from "./initial-state";
import { createSupabaseAdmin, mapCustomerRow, mapDriverRow, mapSettingsRow } from "./supabase-admin";
import type { DemoState, Route, WorkOrder } from "./types";

type Row = Record<string, unknown>;
const text = (value: unknown) => typeof value === "string" ? value : "";
const number = (value: unknown) => typeof value === "number" ? value : Number(value) || 0;
const time = (value: unknown, fallback: string) => text(value).slice(0, 5) || fallback;

function mapWorkOrder(row: Row): WorkOrder {
  const kind = ["Wartung", "Reparatur", "Notfall", "Inspektion"].includes(text(row.kind)) ? text(row.kind) as WorkOrder["kind"] : "Wartung";
  const status = text(row.status) as WorkOrder["status"];
  return { id: text(row.id), customerId: text(row.customer_id), title: text(row.title), kind, status, scheduledDate: text(row.scheduled_date) || undefined, deadlineDate: text(row.deadline_date) || undefined, timeFrom: time(row.time_from, "08:00"), timeTo: time(row.time_to, "17:00"), durationMinutes: number(row.duration_minutes), priority: Math.max(1, Math.min(4, number(row.priority))) as WorkOrder["priority"], speciality: text(row.speciality), locked: row.locked === true, assignedDriverId: text(row.assigned_driver_id) || undefined, notes: text(row.notes), portalToken: "", createdAt: text(row.created_at), testBatchId: text(row.test_batch_id) || undefined };
}

function mapRoute(row: Row): Route {
  const nested = Array.isArray(row.route_stops) ? row.route_stops as Row[] : [];
  return { id: text(row.id), date: text(row.route_date), driverId: text(row.driver_id), status: text(row.status) as Route["status"], distanceKm: number(row.distance_km), travelMinutes: number(row.travel_minutes), serviceMinutes: number(row.service_minutes), stops: nested.sort((a, b) => number(a.stop_order) - number(b.stop_order)).map((stop) => ({ workOrderId: text(stop.work_order_id), order: number(stop.stop_order), eta: time(stop.eta, "08:00"), distanceFromPreviousKm: number(stop.distance_from_previous_km), driveMinutesFromPrevious: number(stop.drive_minutes_from_previous), explanation: text(stop.explanation) })) };
}

export async function loadPlanningState(orgId: string): Promise<DemoState> {
  const client = createSupabaseAdmin();
  if (!client) throw new Error("Supabase-Administration ist nicht konfiguriert.");
  const [drivers, customers, workOrders, routes, settings] = await Promise.all([
    client.from("drivers").select("*").eq("org_id", orgId),
    client.from("customers").select("*").eq("org_id", orgId),
    client.from("work_orders").select("*").eq("org_id", orgId),
    client.from("routes").select("id,status,route_date,driver_id,distance_km,travel_minutes,service_minutes,route_stops(work_order_id,stop_order,eta,distance_from_previous_km,drive_minutes_from_previous,explanation)").eq("org_id", orgId),
    client.from("organization_settings").select("*").eq("org_id", orgId).maybeSingle(),
  ]);
  const error = drivers.error || customers.error || workOrders.error || routes.error;
  if (error) throw new Error("Planungsdaten konnten nicht aus Supabase geladen werden.");
  return { ...createEmptyState(), drivers: (drivers.data ?? []).map((row) => mapDriverRow(row)), customers: (customers.data ?? []).map((row) => mapCustomerRow(row)), workOrders: (workOrders.data ?? []).map((row) => mapWorkOrder(row)), routes: (routes.data ?? []).map((row) => mapRoute(row)), settings: mapSettingsRow(settings.data) };
}
