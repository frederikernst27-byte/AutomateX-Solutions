import { createDemoState } from "./demo-data";
import { createEmptyState } from "./initial-state";
import type { ImportPreview } from "./importer";
import type { DemoState, PlanningConstraints, Route, WorkOrder } from "./types";
import { createHash, randomBytes } from "node:crypto";
import { validateRouteStops } from "./planner";

export interface DemoImportRecord {
  id: string;
  status: "preview" | "committed" | "failed";
  committed: boolean;
  preview: ImportPreview;
  createdAt: string;
}

export interface DemoAuditEvent {
  id: string;
  action: string;
  entityType?: string;
  entityId: string;
  idempotencyKey?: string;
  before: unknown;
  after: unknown;
  createdAt: string;
}

export interface DemoPortalTokenRecord {
  tokenHash: string;
  workOrderId: string;
  expiresAt: string;
  revokedAt?: string;
}

export type PortalResolution =
  | { error: string; status: 404 }
  | { order: WorkOrder; record: DemoPortalTokenRecord };

const globalForDemo = globalThis as unknown as {
  automatexRouteDemo?: DemoState;
  automatexRouteImports?: Map<string, DemoImportRecord>;
  automatexRouteVersions?: Map<string, number>;
  automatexRouteAudit?: DemoAuditEvent[];
  automatexRoutePortalTokens?: Map<string, DemoPortalTokenRecord[]>;
  automatexRouteIdempotency?: Map<string, unknown>;
};
// Synthetic fixtures are available to unit tests only. A normal application
// process always starts without customers, drivers, orders or routes.
const initialServerState = process.env.NODE_ENV === "test" ? createDemoState() : createEmptyState();
export const serverDemoState = globalForDemo.automatexRouteDemo ?? (globalForDemo.automatexRouteDemo = initialServerState);
export const serverDemoImports = globalForDemo.automatexRouteImports ?? (globalForDemo.automatexRouteImports = new Map());
export const serverRouteVersions = globalForDemo.automatexRouteVersions ?? (globalForDemo.automatexRouteVersions = new Map());
export const serverAuditEvents = globalForDemo.automatexRouteAudit ?? (globalForDemo.automatexRouteAudit = []);

export function recordDemoAudit(input: Omit<DemoAuditEvent, "id" | "createdAt"> & Partial<Pick<DemoAuditEvent, "id" | "createdAt">>) {
  const event: DemoAuditEvent = {
    id: input.id ?? `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: input.createdAt ?? new Date().toISOString(),
    ...input,
  };
  serverAuditEvents.unshift(event);
  // Match the operational retention default and keep the in-memory adapter
  // bounded during a long-running local session.
  serverAuditEvents.splice(1_000);
  return event;
}

/** Idempotency records are process-local in the demo adapter. The production
 * implementation should move this map to a unique database table. */
export const serverIdempotency = globalForDemo.automatexRouteIdempotency ?? (globalForDemo.automatexRouteIdempotency = new Map());

function hashPortalToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function defaultTokenExpiry(workOrder: WorkOrder) {
  const maximum = Date.now() + 30 * 86400000;
  const configured = workOrder.portalTokenExpiresAt ? Date.parse(workOrder.portalTokenExpiresAt) : Number.POSITIVE_INFINITY;
  // Even the synthetic seed must exercise the same bounded-link behavior as
  // production. Never extend a token beyond 30 days, regardless of a stale
  // fixture value.
  return new Date(Math.min(Number.isFinite(configured) ? configured : maximum, maximum)).toISOString();
}

function seedPortalTokenRecords(state: DemoState) {
  const records = new Map<string, DemoPortalTokenRecord[]>();
  state.workOrders.forEach((workOrder) => {
    if (!workOrder.portalToken) return;
    const hash = hashPortalToken(workOrder.portalToken);
    const list = records.get(hash) ?? [];
    list.push({ tokenHash: hash, workOrderId: workOrder.id, expiresAt: defaultTokenExpiry(workOrder), revokedAt: workOrder.portalTokenRevokedAt });
    records.set(hash, list);
  });
  return records;
}

export const serverPortalTokens = globalForDemo.automatexRoutePortalTokens ?? (globalForDemo.automatexRoutePortalTokens = seedPortalTokenRecords(serverDemoState));

export function resetPortalTokenRecords() {
  serverPortalTokens.clear();
  seedPortalTokenRecords(serverDemoState).forEach((records, hash) => serverPortalTokens.set(hash, records));
}

function synchronizePortalTokenRecords() {
  const knownOrderIds = new Set(serverDemoState.workOrders.map((order) => order.id));
  const currentHashes = new Map(serverDemoState.workOrders.filter((order) => order.portalToken).map((order) => [order.id, hashPortalToken(order.portalToken)]));
  serverPortalTokens.forEach((records) => records.forEach((record) => {
    if (!knownOrderIds.has(record.workOrderId) || currentHashes.get(record.workOrderId) !== record.tokenHash) record.revokedAt = record.revokedAt ?? new Date().toISOString();
  }));
  serverDemoState.workOrders.forEach((order) => {
    if (!order.portalToken) return;
    const hash = hashPortalToken(order.portalToken);
    const records = serverPortalTokens.get(hash) ?? [];
    const current = records.find((record) => record.workOrderId === order.id);
    if (current) {
      // Never extend an already issued link during synchronization. A later
      // expiry is only allowed through rotatePortalToken(), which creates a
      // new hash and therefore a new credential.
      const configuredExpiry = order.portalTokenExpiresAt ? Date.parse(order.portalTokenExpiresAt) : Number.POSITIVE_INFINITY;
      const currentExpiry = Date.parse(current.expiresAt);
      if (configuredExpiry < currentExpiry) current.expiresAt = order.portalTokenExpiresAt!;
      if (!order.portalTokenRevokedAt) current.revokedAt = undefined;
      if (order.portalTokenRevokedAt) current.revokedAt = order.portalTokenRevokedAt;
      return;
    }
    records.push({ tokenHash: hash, workOrderId: order.id, expiresAt: defaultTokenExpiry(order), revokedAt: order.portalTokenRevokedAt });
    serverPortalTokens.set(hash, records);
  });
}

export function portalTokenHash(token: string) {
  return hashPortalToken(token);
}

export function portalTokenIsValid(record: DemoPortalTokenRecord, now = new Date()) {
  return !record.revokedAt && Number.isFinite(Date.parse(record.expiresAt)) && Date.parse(record.expiresAt) > now.getTime();
}

/**
 * Resolve exactly one portal token. Ambiguous tokens are rejected instead of
 * silently exposing whichever work order happened to appear first.
 */
export function resolvePortalOrder(token: string, now = new Date()): PortalResolution {
  synchronizePortalTokenRecords();
  const trimmed = token.trim();
  if (!trimmed || trimmed.length > 256) return { error: "Portal-Link nicht verfügbar" as const, status: 404 as const };
  const hash = hashPortalToken(trimmed);
  const records = serverPortalTokens.get(hash) ?? [];
  const valid = records.filter((record) => portalTokenIsValid(record, now));
  if (valid.length !== 1) return { error: "Portal-Link nicht verfügbar" as const, status: 404 as const };
  const order = serverDemoState.workOrders.find((item) => item.id === valid[0].workOrderId);
  if (!order || ["cancelled"].includes(order.status) || order.portalTokenRevokedAt) return { error: "Portal-Link nicht verfügbar" as const, status: 404 as const };
  return { order: order as WorkOrder, record: valid[0] };
}

export function rotatePortalToken(workOrderId: string, expiresAt = new Date(Date.now() + 30 * 86400000).toISOString()) {
  const order = serverDemoState.workOrders.find((item) => item.id === workOrderId);
  if (!order) throw new Error("Auftrag nicht gefunden");
  if (!Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) <= Date.now()) throw new Error("Portal-Link-Ablauf ist ungültig");
  const oldToken = order.portalToken;
  const oldHash = hashPortalToken(oldToken);
  const oldRecords = serverPortalTokens.get(oldHash) ?? [];
  oldRecords.forEach((record) => { if (record.workOrderId === workOrderId) record.revokedAt = new Date().toISOString(); });
  const token = randomBytes(32).toString("base64url");
  const hash = hashPortalToken(token);
  order.portalToken = token;
  order.portalTokenExpiresAt = expiresAt;
  order.portalTokenRevokedAt = undefined;
  serverPortalTokens.set(hash, [{ tokenHash: hash, workOrderId, expiresAt }]);
  return token;
}

export function publicPortalOrder(order: WorkOrder) {
  // A portal bearer token is scoped to the appointment, not to the internal
  // dispatch record. Do not leak assignment, locking, notes or token lifecycle
  // fields to a forwarded customer link.
  const {
    portalToken: _token,
    portalTokenRevokedAt: _revoked,
    assignedDriverId: _driver,
    locked: _locked,
    notes: _notes,
    priority: _priority,
    createdAt: _createdAt,
    speciality: _speciality,
    ...safeOrder
  } = order;
  return safeOrder;
}

export function mergePublishedRoutes(routes: Route[]) {
  const byId = new Map(serverDemoState.routes.map((route) => [route.id, route]));
  routes.forEach((route) => byId.set(route.id, { ...route, status: "published" }));
  serverDemoState.routes = Array.from(byId.values());
  routes.forEach((route) => {
    serverRouteVersions.set(route.id, serverRouteVersions.get(route.id) ?? 1);
    route.stops.forEach((stop) => {
      const order = serverDemoState.workOrders.find((item) => item.id === stop.workOrderId);
      if (!order) return;
      order.assignedDriverId = route.driverId;
      order.scheduledDate = route.date;
      if (["backlog", "offered", "confirmed"].includes(order.status)) order.status = "planned";
    });
  });
}

export function publishPlanningRun(run: { routes: Route[]; constraints?: PlanningConstraints }) {
  const activeConflicts = run.routes.filter((route) => {
    const existing = serverDemoState.routes.find((candidate) => candidate.id === route.id);
    return existing && existing.status !== "draft" && existing.status !== "cancelled";
  });
  if (activeConflicts.length) throw new Error(`Route bereits aktiv: ${activeConflicts.map((route) => route.id).join(", ")}`);
  const runStopIds = run.routes.flatMap((route) => route.stops.map((stop) => stop.workOrderId));
  if (new Set(runStopIds).size !== runStopIds.length) throw new Error("Ein Auftrag ist im Plan mehrfach zugewiesen");
  const activeStops = new Map(serverDemoState.routes.filter((route) => !["draft", "cancelled"].includes(route.status)).flatMap((route) => route.stops.map((stop) => [stop.workOrderId, route.id] as const)));
  const assignmentConflicts = Array.from(new Set(runStopIds.filter((workOrderId) => activeStops.has(workOrderId))));
  if (assignmentConflicts.length) throw new Error(`Auftrag bereits aktiv eingeplant: ${assignmentConflicts.join(", ")}`);
  const customers = new Map(serverDemoState.customers.map((customer) => [customer.id, customer]));
  const orderById = new Map(serverDemoState.workOrders.map((order) => [order.id, order]));
  run.routes.forEach((route) => {
    const driver = serverDemoState.drivers.find((candidate) => candidate.id === route.driverId);
    if (!driver) throw new Error(`Fahrer fehlt: ${route.driverId}`);
    const orders = route.stops.map((stop) => orderById.get(stop.workOrderId));
    if (orders.some((order) => !order || ["completed", "cancelled"].includes(order.status))) throw new Error(`Route ${route.id} enthält einen nicht mehr planbaren Auftrag`);
    const issues = validateRouteStops(route.date, driver, orders as WorkOrder[], customers, {
      maxRouteMinutes: run.constraints?.defaultMaxRouteMinutes ?? 480,
      enforceSpecialities: run.constraints?.hardRules.specialities ?? true,
      enforceWindows: run.constraints?.hardRules.confirmedWindows ?? true,
      enforceMaxStops: run.constraints?.hardRules.maxStops ?? true,
      enforceMaxTravel: run.constraints?.hardRules.maxTravel ?? true,
    });
    if (issues.length) throw new Error(`Route ${route.id} verletzt harte Regeln: ${Array.from(new Set(issues.map((issue) => issue.message))).join("; ")}`);
  });
  const before = structuredClone(run.routes);
  run.routes = run.routes.map((route) => ({ ...route, status: "published" }));
  mergePublishedRoutes(run.routes);
  return { before, changed: JSON.stringify(before) !== JSON.stringify(run.routes) };
}
