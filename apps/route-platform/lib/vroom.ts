import type { Customer, DemoState, Driver, PlanningConstraints, PlanningResult, Route, RouteStop, WorkOrder } from "./types";
import { dateRange, minutesToTime } from "./utils";

type VroomJob = { id: number; description: string; location: [number, number]; service: number; priority: number; skills?: number[]; time_windows?: Array<[number, number]> };
type VroomVehicle = { id: number; description: string; profile: "car"; start: [number, number]; end: [number, number]; skills: number[]; time_window: [number, number]; max_tasks?: number; max_travel_time?: number };
type VroomStep = { type: string; id?: number; arrival: number; duration: number; distance?: number; waiting_time?: number };
type VroomRoute = { vehicle: number; steps: VroomStep[]; duration: number; service: number; distance?: number };
type VroomResponse = { code: number; error?: string; routes?: VroomRoute[]; unassigned?: Array<{ id: number }>; summary?: { duration?: number; distance?: number } };

export interface VroomProblem {
  payload: { jobs: VroomJob[]; vehicles: VroomVehicle[]; options: { g: true } };
  jobs: Map<number, WorkOrder>;
  vehicles: Map<number, { driver: Driver; date: string }>;
  preUnassigned: Array<{ workOrderId: string; reason: string }>;
}

export class VroomError extends Error {
  constructor(message: string, public readonly status = 502) { super(message); this.name = "VroomError"; }
}

function timeSeconds(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return (hours * 60 + minutes) * 60;
}

function normalized(value: string) {
  return value.trim().toLocaleLowerCase("de-DE").replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u").replace(/ß/g, "ss");
}

function validLocation(location: { lat: number; lng: number } | undefined) {
  return Boolean(location && Number.isFinite(location.lat) && Number.isFinite(location.lng) && !(location.lat === 0 && location.lng === 0));
}

function isFixed(order: WorkOrder) {
  return order.locked || ["confirmed", "en_route", "on_site"].includes(order.status);
}

/** Convert the platform domain into VROOM's VRPTW input format. */
export function buildVroomProblem(state: DemoState, constraints: PlanningConstraints): VroomProblem {
  const dates = dateRange(constraints.from, constraints.to).filter((date) => ![0, 6].includes(new Date(`${date}T12:00:00`).getDay()));
  const defaultSelected = new Set(constraints.driverIds.length ? constraints.driverIds : state.drivers.filter((driver) => driver.active).map((driver) => driver.id));
  const customers = new Map(state.customers.map((customer) => [customer.id, customer]));
  const activeOrderIds = new Set(state.routes.filter((route) => !["draft", "cancelled"].includes(route.status)).flatMap((route) => route.stops.map((stop) => stop.workOrderId)));
  const candidates = Array.from(new Map(state.workOrders.filter((order) => !["completed", "cancelled"].includes(order.status) && !activeOrderIds.has(order.id)).map((order) => [order.id, order])).values());

  const skillIds = new Map<string, number>();
  const skill = (key: string) => { if (!skillIds.has(key)) skillIds.set(key, skillIds.size + 1); return skillIds.get(key)!; };
  const vehicles = new Map<number, { driver: Driver; date: string }>();
  const vroomVehicles: VroomVehicle[] = [];
  for (const date of dates) {
    const daySelected = new Set(constraints.driverAvailability?.[date] ?? defaultSelected);
    const dayDrivers = state.drivers.filter((driver) => driver.active && daySelected.has(driver.id) && validLocation(driver.location));
    for (const driver of dayDrivers) {
      if (driver.daysOff.includes(date)) continue;
      const id = vroomVehicles.length + 1;
      const start = timeSeconds(driver.shiftStart);
      const naturalEnd = timeSeconds(driver.shiftEnd);
      const end = Math.min(naturalEnd, start + constraints.defaultMaxRouteMinutes * 60);
      if (end <= start) continue;
      const vehicleSkills = new Set(driver.skills.map((item) => skill(`speciality:${normalized(item)}`)));
      vehicleSkills.add(skill(`date:${date}`));
      vehicleSkills.add(skill(`driver:${driver.id}`));
      vroomVehicles.push({
        id, description: `${driver.name} · ${date}`, profile: "car",
        start: [driver.location.lng, driver.location.lat], end: [driver.location.lng, driver.location.lat],
        skills: [...vehicleSkills], time_window: [start, end],
        ...(constraints.hardRules.maxStops ? { max_tasks: Math.min(driver.maxStops, constraints.defaultMaxStops) } : {}),
        ...(constraints.hardRules.maxTravel ? { max_travel_time: Math.min(driver.maxTravelMinutes, constraints.defaultMaxTravelMinutes) * 60 } : {}),
      });
      vehicles.set(id, { driver, date });
    }
  }

  const jobs = new Map<number, WorkOrder>();
  const vroomJobs: VroomJob[] = [];
  const preUnassigned: Array<{ workOrderId: string; reason: string }> = [];
  for (const order of candidates) {
    const customer = customers.get(order.customerId);
    if (!customer || !validLocation(customer.location)) {
      preUnassigned.push({ workOrderId: order.id, reason: "Kunde oder gültige Standortkoordinaten fehlen" });
      continue;
    }
    if (isFixed(order) && order.scheduledDate && !dates.includes(order.scheduledDate)) {
      preUnassigned.push({ workOrderId: order.id, reason: `Fester Termin ${order.scheduledDate} liegt außerhalb des Planungszeitraums` });
      continue;
    }
    if (order.locked && !order.scheduledDate) {
      preUnassigned.push({ workOrderId: order.id, reason: "Gesperrter Auftrag hat keinen festen Termin" });
      continue;
    }
    if (order.deadlineDate) {
      const eligible = vroomVehicles.filter((vehicle) => {
        const metadata = vehicles.get(vehicle.id);
        return metadata && metadata.date <= order.deadlineDate!;
      });
      if (!eligible.length) {
        preUnassigned.push({ workOrderId: order.id, reason: `Planbar bis ${order.deadlineDate}: Kein verfügbarer Fahrer-Tag innerhalb der Frist` });
        continue;
      }
      const deadlineSkill = skill(`deadline:${order.id}`);
      eligible.forEach((vehicle) => {
        if (!vehicle.skills.includes(deadlineSkill)) vehicle.skills.push(deadlineSkill);
      });
    }
    const id = vroomJobs.length + 1;
    const required = new Set<number>();
    if (constraints.hardRules.specialities && normalized(order.speciality) !== "wartung") required.add(skill(`speciality:${normalized(order.speciality)}`));
    if (isFixed(order) && order.scheduledDate) required.add(skill(`date:${order.scheduledDate}`));
    if (isFixed(order) && order.assignedDriverId) required.add(skill(`driver:${order.assignedDriverId}`));
    if (order.deadlineDate) required.add(skill(`deadline:${order.id}`));
    const due = order.deadlineDate || customer.nextDue;
    const dueDate = due ? new Date(`${due}T12:00:00`).getTime() : Number.NaN;
    const overdueDays = Number.isFinite(dueDate) ? Math.max(0, Math.round((new Date(`${constraints.from}T12:00:00`).getTime() - dueDate) / 86_400_000)) : 0;
    vroomJobs.push({
      id, description: `${order.id} · ${customer.name}`, location: [customer.location.lng, customer.location.lat],
      service: order.durationMinutes * 60,
      priority: Math.max(0, Math.min(100, Math.round(order.priority * 20 * constraints.objectiveWeights.priority + Math.min(20, overdueDays * constraints.objectiveWeights.due)))),
      ...(required.size ? { skills: [...required] } : {}),
      ...(constraints.hardRules.confirmedWindows ? { time_windows: [[timeSeconds(order.timeFrom), timeSeconds(order.timeTo)]] as Array<[number, number]> } : {}),
    });
    jobs.set(id, order);
  }
  return { payload: { jobs: vroomJobs, vehicles: vroomVehicles, options: { g: true } }, jobs, vehicles, preUnassigned };
}

export function mapVroomResult(problem: VroomProblem, response: VroomResponse, constraints: PlanningConstraints): PlanningResult {
  if (response.code !== 0) throw new VroomError(`VROOM: ${response.error || `Fehlercode ${response.code}`}`);
  const runId = `vroom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const routes: Route[] = [];
  const coveredJobs = new Set<number>();
  for (const item of response.routes ?? []) {
    const vehicle = problem.vehicles.get(item.vehicle);
    if (!vehicle) throw new VroomError(`VROOM lieferte ein unbekanntes Fahrzeug (${item.vehicle}).`);
    if (!Number.isFinite(item.distance)) throw new VroomError("VROOM lieferte keine Straßendistanz. vroom-express muss die Option -g erlauben.");
    let previousDuration = 0;
    let previousDistance = 0;
    const stops: RouteStop[] = [];
    for (const step of item.steps.filter((entry) => entry.type === "job")) {
      const order = step.id ? problem.jobs.get(step.id) : undefined;
      if (!order) throw new VroomError(`VROOM lieferte einen unbekannten Auftrag (${step.id ?? "ohne ID"}).`);
      if (coveredJobs.has(step.id!)) throw new VroomError(`VROOM lieferte Auftrag ${order.id} mehrfach.`);
      if (!Number.isFinite(step.distance)) throw new VroomError(`VROOM lieferte für Auftrag ${order.id} keine Straßendistanz.`);
      coveredJobs.add(step.id!);
      const legDuration = Math.max(0, step.duration - previousDuration);
      const legDistance = Math.max(0, (step.distance ?? previousDistance) - previousDistance);
      stops.push({ workOrderId: order.id, order: stops.length + 1, eta: minutesToTime(Math.floor(step.arrival / 60)), distanceFromPreviousKm: Number((legDistance / 1000).toFixed(1)), driveMinutesFromPrevious: Math.round(legDuration / 60), explanation: "VROOM · Straßenzeiten, Skills, Schicht und Zeitfenster optimiert" });
      previousDuration = step.duration;
      previousDistance = step.distance ?? previousDistance;
    }
    if (stops.length) routes.push({ id: `route-${vehicle.driver.id}-${vehicle.date}-${runId.slice(-6)}`, date: vehicle.date, driverId: vehicle.driver.id, status: "draft", stops, distanceKm: Number((item.distance! / 1000).toFixed(1)), travelMinutes: Math.round(item.duration / 60), serviceMinutes: Math.round(item.service / 60) });
  }
  const solverUnassigned = (response.unassigned ?? []).map((item) => {
    const order = problem.jobs.get(item.id);
    if (!order) throw new VroomError(`VROOM lieferte einen unbekannten nicht zugewiesenen Auftrag (${item.id}).`);
    if (coveredJobs.has(item.id)) throw new VroomError(`VROOM meldete Auftrag ${order.id} zugleich als zugewiesen und nicht zugewiesen.`);
    coveredJobs.add(item.id);
    return { workOrderId: order.id, reason: "Keine zulässige Kombination aus Fahrer, Tag, Skill, Zeitfenster und Kapazität" };
  });
  const omitted = [...problem.jobs.entries()].filter(([id]) => !coveredJobs.has(id)).map(([, order]) => ({ workOrderId: order.id, reason: "VROOM hat für diesen Auftrag keine Zuordnung geliefert" }));
  const unassigned = [...problem.preUnassigned, ...solverUnassigned, ...omitted];
  const assigned = routes.reduce((sum, route) => sum + route.stops.length, 0);
  return { runId, mode: "vroom", status: "completed", createdAt: new Date().toISOString(), constraints, routes, unassigned, summary: { assigned, unassigned: unassigned.length, distanceKm: Number(routes.reduce((sum, route) => sum + route.distanceKm, 0).toFixed(1)), travelMinutes: routes.reduce((sum, route) => sum + route.travelMinutes, 0) } };
}

export async function planWithVroom(state: DemoState, constraints: PlanningConstraints, fetcher: typeof fetch = fetch) {
  const configured = process.env.VROOM_URL?.trim();
  if (!configured) throw new VroomError("VROOM_URL ist nicht konfiguriert. Es wurde keine Ersatz- oder Demo-Route berechnet.", 503);
  let endpoint: URL;
  try { endpoint = new URL(configured); } catch { throw new VroomError("VROOM_URL ist ungültig.", 503); }
  if (!["http:", "https:"].includes(endpoint.protocol) || endpoint.username || endpoint.password) throw new VroomError("VROOM_URL muss eine HTTP(S)-Adresse ohne Zugangsdaten sein.", 503);
  const problem = buildVroomProblem(state, constraints);
  if (!problem.payload.vehicles.length) throw new VroomError("Keine aktiven Fahrer-Tage mit gültigem Depot im Planungszeitraum verfügbar.", 422);
  if (!problem.payload.jobs.length) return mapVroomResult(problem, { code: 0, routes: [], unassigned: [] }, constraints);
  const timeout = Math.max(1_000, Math.min(120_000, Number(process.env.VROOM_TIMEOUT_MS) || 30_000));
  let response: Response;
  try {
    response = await fetcher(endpoint, { method: "POST", headers: { "Content-Type": "application/json", ...(process.env.VROOM_API_KEY ? { Authorization: `Bearer ${process.env.VROOM_API_KEY}` } : {}) }, body: JSON.stringify(problem.payload), signal: AbortSignal.timeout(timeout), cache: "no-store" });
  } catch (error) {
    throw new VroomError(error instanceof Error && error.name === "TimeoutError" ? "VROOM hat das Zeitlimit überschritten." : "VROOM ist nicht erreichbar.", error instanceof Error && error.name === "TimeoutError" ? 504 : 503);
  }
  const body = await response.json().catch(() => null) as VroomResponse | null;
  if (!response.ok || !body) throw new VroomError(`VROOM antwortete mit HTTP ${response.status}.`);
  return mapVroomResult(problem, body, constraints);
}
