import type { Customer, DemoState, Driver, PlanningConstraints, PlanningResult, Route, RouteStop, WorkOrder } from "./types";
import { addDays, currentBusinessDate, dateRange, minutesToTime } from "./utils";

const MINUTES_PER_KM = 2.1;

function toMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return Number.POSITIVE_INFINITY;
  return hours * 60 + minutes;
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("de-DE").replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u").replace(/ß/g, "ss");
}

function isDate(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function candidateScore(workOrder: WorkOrder, customer: Customer, date: string, weights: PlanningConstraints["objectiveWeights"]) {
  const dueDays = Math.max(0, Math.round((new Date(`${date}T12:00:00`).getTime() - new Date(`${customer.nextDue}T12:00:00`).getTime()) / 86400000));
  return dueDays * weights.due + workOrder.priority * 12 * weights.priority + (workOrder.status === "confirmed" ? 90 : 0) + (workOrder.locked ? 200 : 0);
}

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const radius = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function legMinutes(distance: number) {
  // Keep a small floor so that a geocoder rounding both points to the same
  // coordinate does not create a zero-duration leg.
  return Math.max(5, Math.round(distance * MINUTES_PER_KM));
}

function hasSkill(driver: Driver, speciality: string) {
  const wanted = normalize(speciality);
  return wanted === "wartung" || driver.skills.some((skill) => normalize(skill) === wanted);
}

function isDriverOff(driver: Driver, date: string) {
  return driver.daysOff.some((day) => day === date);
}

function isFixedAssignment(workOrder: WorkOrder) {
  // `planned` is a draft projection and must remain movable until the plan is
  // published. Confirmed/in-progress work and explicit locks are immutable.
  return workOrder.locked || ["confirmed", "en_route", "on_site"].includes(workOrder.status);
}

function orderCanMoveToDate(workOrder: WorkOrder, date: string) {
  return !workOrder.scheduledDate || workOrder.scheduledDate === date || !isFixedAssignment(workOrder);
}

function orderCanMoveToDriver(workOrder: WorkOrder, driverId: string) {
  return !workOrder.assignedDriverId || workOrder.assignedDriverId === driverId || !isFixedAssignment(workOrder);
}

function nearestOrder(items: WorkOrder[], driver: Driver, customers: Map<string, Customer>) {
  const remaining = [...items];
  const ordered: WorkOrder[] = [];
  let cursor = driver.location;
  while (remaining.length) {
    let bestIndex = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    remaining.forEach((item, index) => {
      const customer = customers.get(item.customerId);
      if (!customer) return;
      const distance = distanceKm(cursor, customer.location) - item.priority * 0.7;
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });
    // Unknown customers are retained for a useful rejection reason instead
    // of accidentally selecting the first item forever.
    if (bestIndex < 0) {
      ordered.push(...remaining);
      break;
    }
    const next = remaining.splice(bestIndex, 1)[0];
    ordered.push(next);
    const customer = customers.get(next.customerId);
    if (customer) cursor = customer.location;
  }
  return ordered;
}

export interface RouteValidationIssue {
  code: "absence" | "skill" | "locked_assignment" | "locked_date" | "deadline" | "max_stops" | "max_travel" | "shift" | "route_duration" | "time_window" | "customer";
  message: string;
}

export interface RouteValidationOptions {
  maxRouteMinutes?: number;
  enforceSpecialities?: boolean;
  enforceWindows?: boolean;
  enforceMaxStops?: boolean;
  enforceMaxTravel?: boolean;
}

/**
 * Validates a complete stop sequence.  Both the planner and the manual route
 * endpoint use this function so a drag-and-drop change cannot bypass the same
 * hard limits used during automatic planning.
 */
export function validateRouteStops(
  date: string,
  driver: Driver,
  workOrders: WorkOrder[],
  customers: Map<string, Customer>,
  options: RouteValidationOptions = {},
): RouteValidationIssue[] {
  const enforceSpecialities = options.enforceSpecialities ?? true;
  const enforceWindows = options.enforceWindows ?? true;
  const enforceMaxStops = options.enforceMaxStops ?? true;
  const enforceMaxTravel = options.enforceMaxTravel ?? true;
  const maxRouteMinutes = options.maxRouteMinutes ?? 480;
  const issues: RouteValidationIssue[] = [];
  if (isDriverOff(driver, date)) issues.push({ code: "absence", message: `${driver.name} ist am ${date} abwesend` });
  if (enforceMaxStops && workOrders.length > driver.maxStops) issues.push({ code: "max_stops", message: `${driver.name} hat maximal ${driver.maxStops} Stopps` });

  let cursor = driver.location;
  let clock = toMinutes(driver.shiftStart);
  let travel = 0;
  const seen = new Set<string>();
  workOrders.forEach((workOrder) => {
    if (seen.has(workOrder.id)) {
      issues.push({ code: "customer", message: `Auftrag ${workOrder.id} ist doppelt in der Route` });
      return;
    }
    seen.add(workOrder.id);
    const customer = customers.get(workOrder.customerId);
    if (!customer) {
      issues.push({ code: "customer", message: `Kunde/Standort für ${workOrder.id} fehlt` });
      return;
    }
    if (workOrder.locked && workOrder.assignedDriverId && workOrder.assignedDriverId !== driver.id) {
      issues.push({ code: "locked_assignment", message: `${workOrder.id} ist für einen anderen Fahrer gesperrt` });
    }
    if (workOrder.locked && workOrder.scheduledDate && workOrder.scheduledDate !== date) {
      issues.push({ code: "locked_date", message: `${workOrder.id} ist für den ${workOrder.scheduledDate} gesperrt` });
    }
    if (workOrder.deadlineDate && date > workOrder.deadlineDate) {
      issues.push({ code: "deadline", message: `${workOrder.id} ist nur bis einschließlich ${workOrder.deadlineDate} planbar` });
    }
    if (enforceSpecialities && !hasSkill(driver, workOrder.speciality)) {
      issues.push({ code: "skill", message: `${driver.name} fehlt das Spezialgebiet ${workOrder.speciality}` });
    }
    const distance = distanceKm(cursor, customer.location);
    const drive = legMinutes(distance);
    const arrival = clock + drive;
    const start = toMinutes(workOrder.timeFrom);
    const end = toMinutes(workOrder.timeTo);
    const serviceStart = Math.max(arrival, start);
    const nextClock = serviceStart + workOrder.durationMinutes;
    const returnDistance = distanceKm(customer.location, driver.location);
    const returnDrive = legMinutes(returnDistance);
    if (enforceWindows && arrival > end) issues.push({ code: "time_window", message: `${workOrder.id} verfehlt das Zeitfenster ${workOrder.timeFrom}–${workOrder.timeTo}` });
    if (enforceMaxTravel && travel + drive + returnDrive > driver.maxTravelMinutes) issues.push({ code: "max_travel", message: `Fahrzeitlimit von ${driver.maxTravelMinutes} Min. wird überschritten` });
    if (nextClock + returnDrive > toMinutes(driver.shiftEnd)) issues.push({ code: "shift", message: `Arbeitszeit von ${driver.shiftStart}–${driver.shiftEnd} reicht nicht aus` });
    if (nextClock + returnDrive - toMinutes(driver.shiftStart) > maxRouteMinutes) issues.push({ code: "route_duration", message: `Routenlimit von ${maxRouteMinutes} Min. wird überschritten` });
    travel += drive;
    clock = nextClock;
    cursor = customer.location;
  });
  return issues;
}

function buildRoute(
  date: string,
  driver: Driver,
  workOrders: WorkOrder[],
  customers: Map<string, Customer>,
  options: { specialitiesHard: boolean; confirmedWindows: boolean; maxStopsHard: boolean; maxTravelHard: boolean; maxRouteMinutes: number },
): { route: Route; assigned: string[]; unassigned: Array<{ workOrderId: string; reason: string }> } {
  const ordered = nearestOrder(workOrders, driver, customers);
  const stops: RouteStop[] = [];
  const rejected: Array<{ workOrderId: string; reason: string }> = [];
  let cursor = driver.location;
  let clock = toMinutes(driver.shiftStart);
  let travel = 0;
  let distance = 0;
  let service = 0;
  let previousCustomer: Customer | undefined;
  for (const workOrder of ordered) {
    const customer = customers.get(workOrder.customerId);
    if (!customer) {
      rejected.push({ workOrderId: workOrder.id, reason: "Kunde/Standort fehlt" });
      continue;
    }
    if (options.specialitiesHard && !hasSkill(driver, workOrder.speciality)) {
      rejected.push({ workOrderId: workOrder.id, reason: `Spezialgebiet ${workOrder.speciality} fehlt bei ${driver.name}` });
      continue;
    }
    if (options.maxStopsHard && stops.length >= driver.maxStops) {
      rejected.push({ workOrderId: workOrder.id, reason: `${driver.name} hat maximal ${driver.maxStops} Stopps` });
      continue;
    }
    const legKm = distanceKm(cursor, customer.location);
    const drive = legMinutes(legKm);
    const arrival = clock + drive;
    const windowStart = toMinutes(workOrder.timeFrom);
    const windowEnd = toMinutes(workOrder.timeTo);
    const serviceStart = Math.max(arrival, windowStart);
    const nextClock = serviceStart + workOrder.durationMinutes;
    const returnKm = distanceKm(customer.location, driver.location);
    const returnDrive = legMinutes(returnKm);
    if (options.maxTravelHard && travel + drive + returnDrive > driver.maxTravelMinutes) {
      rejected.push({ workOrderId: workOrder.id, reason: `Fahrzeitlimit von ${driver.maxTravelMinutes} Min. erreicht` });
      continue;
    }
    if (nextClock + returnDrive > toMinutes(driver.shiftEnd)) {
      rejected.push({ workOrderId: workOrder.id, reason: `Arbeitszeit von ${driver.shiftStart}–${driver.shiftEnd} reicht nicht aus` });
      continue;
    }
    if (nextClock + returnDrive - toMinutes(driver.shiftStart) > options.maxRouteMinutes) {
      rejected.push({ workOrderId: workOrder.id, reason: `Routenlimit von ${options.maxRouteMinutes} Min. erreicht` });
      continue;
    }
    if (options.confirmedWindows && arrival > windowEnd) {
      rejected.push({ workOrderId: workOrder.id, reason: `Zeitfenster ${workOrder.timeFrom}–${workOrder.timeTo} würde verfehlt` });
      continue;
    }
    const eta = minutesToTime(arrival);
    const proximity = previousCustomer ? `${legKm.toFixed(1)} km Anschlussfahrt` : "Depotnähe";
    stops.push({ workOrderId: workOrder.id, order: stops.length + 1, eta, distanceFromPreviousKm: Number(legKm.toFixed(1)), driveMinutesFromPrevious: drive, explanation: `${workOrder.speciality}-Skill + ${proximity}` });
    travel += drive;
    distance += legKm;
    service += workOrder.durationMinutes;
    clock = nextClock;
    cursor = customer.location;
    previousCustomer = customer;
  }
  // A route is not complete when the technician cannot return to the depot.
  // Include that final leg in metrics and all capacity checks above.
  if (stops.length) {
    const returnKm = distanceKm(cursor, driver.location);
    distance += returnKm;
    travel += legMinutes(returnKm);
  }
  const route: Route = {
    id: `route-${driver.id}-${date}`,
    date,
    driverId: driver.id,
    status: "draft",
    stops,
    distanceKm: Number(distance.toFixed(1)),
    travelMinutes: travel,
    serviceMinutes: service,
  };
  return { route, assigned: stops.map((stop) => stop.workOrderId), unassigned: rejected };
}

/** Recalculate ETA and distance fields after a manual reorder. */
export function estimateRouteSequence(driver: Driver, workOrders: WorkOrder[], customers: Map<string, Customer>) {
  let cursor = driver.location;
  let clock = toMinutes(driver.shiftStart);
  let distance = 0;
  let travel = 0;
  let service = 0;
  const stops: RouteStop[] = [];
  workOrders.forEach((workOrder, index) => {
    const customer = customers.get(workOrder.customerId);
    if (!customer) return;
    const km = distanceKm(cursor, customer.location);
    const drive = legMinutes(km);
    const arrival = clock + drive;
    const serviceStart = Math.max(arrival, toMinutes(workOrder.timeFrom));
    stops.push({ workOrderId: workOrder.id, order: index + 1, eta: minutesToTime(arrival), distanceFromPreviousKm: Number(km.toFixed(1)), driveMinutesFromPrevious: drive, explanation: "Manuell angeordnet" });
    distance += km;
    travel += drive;
    service += workOrder.durationMinutes;
    clock = serviceStart + workOrder.durationMinutes;
    cursor = customer.location;
  });
  if (stops.length) {
    const returnKm = distanceKm(cursor, driver.location);
    distance += returnKm;
    travel += legMinutes(returnKm);
  }
  return { stops, distanceKm: Number(distance.toFixed(1)), travelMinutes: travel, serviceMinutes: service };
}

function addReason(reasons: Map<string, string[]>, workOrderId: string, reason: string) {
  const existing = reasons.get(workOrderId) ?? [];
  if (!existing.includes(reason)) existing.push(reason);
  reasons.set(workOrderId, existing);
}

export function planDemoRoutes(state: DemoState, constraints: PlanningConstraints): PlanningResult {
  const runId = `plan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const dates = dateRange(constraints.from, constraints.to).filter((date) => !["6", "0"].includes(new Date(`${date}T12:00:00`).getDay().toString()));
  const defaultDriverIds = constraints.driverIds.length
    ? constraints.driverIds
    : state.drivers.filter((driver) => driver.active).map((driver) => driver.id);
  const customers = new Map(state.customers.map((customer) => [customer.id, customer]));
  // A malformed import can contain the same ID more than once. Plan each
  // logical work order exactly once, otherwise the backlog and route totals
  // become contradictory.
  const activeRouteOrderIds = new Set(state.routes.filter((route) => !["draft", "cancelled"].includes(route.status)).flatMap((route) => route.stops.map((stop) => stop.workOrderId)));
  const uniqueCandidates = Array.from(new Map(state.workOrders.filter((workOrder) => !["completed", "cancelled"].includes(workOrder.status) && !activeRouteOrderIds.has(workOrder.id)).map((workOrder) => [workOrder.id, workOrder])).values());
  const assignedIds = new Set<string>();
  const routes: Route[] = [];
  const rejectionReasons = new Map<string, string[]>();
  uniqueCandidates.forEach((workOrder) => {
    if (!customers.has(workOrder.customerId)) addReason(rejectionReasons, workOrder.id, "Kunde/Standort fehlt");
    if (workOrder.scheduledDate && !dates.includes(workOrder.scheduledDate) && isFixedAssignment(workOrder)) addReason(rejectionReasons, workOrder.id, `Fester Termin ${workOrder.scheduledDate} liegt außerhalb des gewählten Zeitraums`);
    if (workOrder.locked && !workOrder.scheduledDate) addReason(rejectionReasons, workOrder.id, "Gesperrter Auftrag hat keinen festen Termin");
    if (workOrder.deadlineDate && workOrder.deadlineDate < constraints.from) addReason(rejectionReasons, workOrder.id, `Planbar bis ${workOrder.deadlineDate} liegt vor dem Planungszeitraum`);
  });

  for (const date of dates) {
    // The dispatcher chooses staffing per day. Do not fall back to the
    // original global selection when a newer test driver was enabled in the
    // day card; that previously left later days empty despite visible capacity.
    const dayDriverIds = new Set(constraints.driverAvailability?.[date] ?? defaultDriverIds);
    const driversForDay = state.drivers.filter((driver) => dayDriverIds.has(driver.id) && driver.active);
    for (const driver of driversForDay) {
      if (isDriverOff(driver, date)) {
        uniqueCandidates.filter((workOrder) => !assignedIds.has(workOrder.id) && orderCanMoveToDate(workOrder, date) && orderCanMoveToDriver(workOrder, driver.id)).forEach((workOrder) => addReason(rejectionReasons, workOrder.id, `${driver.name} ist am ${date} abwesend`));
        continue;
      }
      const effectiveDriver: Driver = {
        ...driver,
        maxStops: constraints.hardRules.maxStops ? Math.min(driver.maxStops, constraints.defaultMaxStops) : driver.maxStops,
        maxTravelMinutes: constraints.hardRules.maxTravel ? Math.min(driver.maxTravelMinutes, constraints.defaultMaxTravelMinutes) : driver.maxTravelMinutes,
      };
      const available = uniqueCandidates.filter((workOrder) => {
        if (assignedIds.has(workOrder.id)) return false;
        if (!customers.has(workOrder.customerId)) return false;
        if (workOrder.locked && !workOrder.scheduledDate) return false;
        if (workOrder.deadlineDate && date > workOrder.deadlineDate) {
          addReason(rejectionReasons, workOrder.id, `Planbar bis ${workOrder.deadlineDate}`);
          return false;
        }
        if (!orderCanMoveToDate(workOrder, date)) {
          addReason(rejectionReasons, workOrder.id, `Fester Termin ${workOrder.scheduledDate} ist nicht am ${date}`);
          return false;
        }
        if (!orderCanMoveToDriver(workOrder, driver.id)) {
          addReason(rejectionReasons, workOrder.id, `Auftrag ist ${workOrder.assignedDriverId} zugewiesen`);
          return false;
        }
        return true;
      }).sort((a, b) => {
        const lockedDifference = Number(b.locked) - Number(a.locked);
        if (lockedDifference) return lockedDifference;
        const assignedDifference = Number(b.assignedDriverId === driver.id) - Number(a.assignedDriverId === driver.id);
        if (assignedDifference) return assignedDifference;
        return candidateScore(b, customers.get(b.customerId)!, date, constraints.objectiveWeights) - candidateScore(a, customers.get(a.customerId)!, date, constraints.objectiveWeights);
      });
      if (!available.length) continue;
      // nearestOrder is quadratic; keep the pool bounded for large imports,
      // but never drop a locked/manual assignment from the pool.
      const poolSize = Math.max(effectiveDriver.maxStops * 3, 24);
      const mandatory = available.filter((workOrder) => workOrder.locked || workOrder.assignedDriverId === driver.id);
      const optional = available.filter((workOrder) => !mandatory.includes(workOrder));
      const pool = [...mandatory, ...optional].slice(0, Math.max(poolSize, mandatory.length));
      const result = buildRoute(date, effectiveDriver, pool, customers, { specialitiesHard: constraints.hardRules.specialities, confirmedWindows: constraints.hardRules.confirmedWindows, maxStopsHard: constraints.hardRules.maxStops, maxTravelHard: constraints.hardRules.maxTravel, maxRouteMinutes: constraints.defaultMaxRouteMinutes });
      result.assigned.forEach((id) => assignedIds.add(id));
      result.unassigned.forEach((item) => addReason(rejectionReasons, item.workOrderId, item.reason));
      if (result.route.stops.length) routes.push({ ...result.route, id: `${result.route.id}-${runId.slice(-6)}` });
    }
  }
  uniqueCandidates.forEach((workOrder) => {
    if (!assignedIds.has(workOrder.id) && !rejectionReasons.has(workOrder.id)) addReason(rejectionReasons, workOrder.id, "Keine passende Kapazität im gewählten Zeitraum");
  });
  const unassigned = uniqueCandidates.filter((workOrder) => !assignedIds.has(workOrder.id)).map((workOrder) => ({ workOrderId: workOrder.id, reason: (rejectionReasons.get(workOrder.id) ?? ["Keine passende Kapazität im gewählten Zeitraum"]).slice(0, 2).join("; ") }));
  const assigned = routes.reduce((sum, route) => sum + route.stops.length, 0);
  return { runId, mode: "fallback", status: "completed", createdAt: new Date().toISOString(), constraints, routes, unassigned, summary: { assigned, unassigned: unassigned.length, distanceKm: Number(routes.reduce((sum, route) => sum + route.distanceKm, 0).toFixed(1)), travelMinutes: routes.reduce((sum, route) => sum + route.travelMinutes, 0) } };
}

export function defaultConstraints(drivers: Driver[] = []) : PlanningConstraints {
  const today = currentBusinessDate();
  return { from: today, to: addDays(today, 7), driverAvailability: {}, driverIds: drivers.filter((driver) => driver.active).map((driver) => driver.id), defaultMaxStops: 4, defaultMaxTravelMinutes: 180, defaultMaxRouteMinutes: 480, objectiveWeights: { due: 1, priority: 1, distance: 1, balance: 1 }, hardRules: { specialities: true, confirmedWindows: true, maxStops: true, maxTravel: true } };
}

export function googleMapsUrl(route: Route, state: DemoState) {
  const customerByWorkOrder = new Map(state.workOrders.map((workOrder) => [workOrder.id, state.customers.find((customer) => customer.id === workOrder.customerId)]));
  const places = route.stops.map((stop) => customerByWorkOrder.get(stop.workOrderId)?.address).filter(Boolean) as string[];
  if (!places.length) return "https://www.google.com/maps/dir/?api=1";
  // Google Maps mobile URLs accept at most three intermediate waypoints. Do
  // not silently omit stops: callers with a larger tour receive a robust
  // stop-by-stop link to the next remaining destination.
  const boundedPlaces = places.length > 4 ? places.slice(0, 1) : places;
  const destination = encodeURIComponent(boundedPlaces[boundedPlaces.length - 1]);
  const waypoints = boundedPlaces.slice(0, -1).slice(0, 3).map(encodeURIComponent).join("%7C");
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving${waypoints ? `&waypoints=${waypoints}` : ""}&dir_action=navigate`;
}

export function routeForToday(state: DemoState, driverId: string, date = currentBusinessDate()) {
  return state.routes.find((route) => route.driverId === driverId && route.date === date && route.status !== "draft");
}
