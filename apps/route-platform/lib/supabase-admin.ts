import { createClient } from "@supabase/supabase-js";
import type { Customer, Driver, PlanningSettings } from "./types";

export const DEFAULT_PLANNING_SETTINGS: PlanningSettings = {
  defaultMaxStops: 4,
  defaultMaxTravelMinutes: 180,
  defaultMaxRouteMinutes: 480,
  autoConfirm: false,
  gpsEnabled: true,
  locationRetentionDays: 30,
};

export function createSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

type Row = Record<string, unknown>;
const text = (value: unknown) => typeof value === "string" ? value : "";
const number = (value: unknown) => typeof value === "number" ? value : Number(value) || 0;
const time = (value: unknown, fallback: string) => text(value).slice(0, 5) || fallback;
const archiveMarker = /^\[\[automatex:archived:([^\]]+)\]\]\n?/;

export function mapDriverRow(row: Row): Driver {
  const active = row.active !== false;
  return {
    id: text(row.id), name: text(row.name), email: text(row.email), phone: text(row.phone),
    initials: text(row.initials), color: text(row.color) || "#18b982",
    skills: Array.isArray(row.skills) ? row.skills.filter((item): item is string => typeof item === "string") : [],
    active, depot: text(row.depot),
    location: { lat: number(row.depot_lat), lng: number(row.depot_lng) },
    shiftStart: time(row.shift_start, "08:00"), shiftEnd: time(row.shift_end, "17:00"),
    maxStops: number(row.max_stops), maxTravelMinutes: number(row.max_travel_minutes),
    daysOff: Array.isArray(row.days_off) ? row.days_off.filter((item): item is string => typeof item === "string") : [],
    status: active ? "available" : "off", lastSeen: "", isTest: row.is_test === true,
    testBatchId: text(row.test_batch_id) || undefined,
  };
}

export function mapSettingsRow(row: Row | null | undefined): PlanningSettings {
  if (!row) return { ...DEFAULT_PLANNING_SETTINGS };
  const int = (value: unknown, fallback: number) => Number.isFinite(number(value)) && number(value) > 0 ? number(value) : fallback;
  return {
    defaultMaxStops: int(row.default_max_stops, DEFAULT_PLANNING_SETTINGS.defaultMaxStops),
    defaultMaxTravelMinutes: int(row.default_max_travel_minutes, DEFAULT_PLANNING_SETTINGS.defaultMaxTravelMinutes),
    defaultMaxRouteMinutes: int(row.default_max_route_minutes, DEFAULT_PLANNING_SETTINGS.defaultMaxRouteMinutes),
    autoConfirm: row.auto_confirm === true,
    gpsEnabled: row.gps_enabled !== false,
    locationRetentionDays: int(row.location_retention_days, DEFAULT_PLANNING_SETTINGS.locationRetentionDays),
  };
}

export function settingsToRow(settings: PlanningSettings) {
  return {
    default_max_stops: settings.defaultMaxStops,
    default_max_travel_minutes: settings.defaultMaxTravelMinutes,
    default_max_route_minutes: settings.defaultMaxRouteMinutes,
    auto_confirm: settings.autoConfirm,
    gps_enabled: settings.gpsEnabled,
    location_retention_days: settings.locationRetentionDays,
  };
}

export function mapCustomerRow(row: Row): Customer {
  const storedNotes = text(row.notes);
  const legacyArchive = storedNotes.match(archiveMarker)?.[1];
  return {
    id: text(row.id), name: text(row.name), contact: text(row.contact), email: text(row.email), phone: text(row.phone),
    site: text(row.site), address: text(row.address), location: { lat: number(row.lat), lng: number(row.lng) },
    asset: text(row.asset), speciality: text(row.speciality) || "Wartung", intervalMonths: number(row.interval_months) || 12,
    lastService: text(row.last_service), nextDue: text(row.next_due),
    sla: row.sla === "SLA 24h" || row.sla === "SLA 48h" ? row.sla : "Standard",
    portalSlug: text(row.id), notes: storedNotes.replace(archiveMarker, "") || undefined,
    archivedAt: text(row.archived_at) || legacyArchive || undefined,
    testBatchId: text(row.test_batch_id) || undefined,
  };
}
