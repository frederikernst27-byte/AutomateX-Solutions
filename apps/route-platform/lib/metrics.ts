import type { DemoState } from "./types";

/** Calculations shared by dashboard, KPI report and exports.  No display
 * component owns a KPI value, which prevents a dashboard and CSV diverging. */
export function calculateMetrics(state: DemoState, today: string) {
  const activeOrders = state.workOrders.filter((order) => order.status !== "cancelled");
  const todayOrders = activeOrders.filter((order) => order.scheduledDate === today);
  const activeRoutes = state.routes.filter((route) => route.status === "started");
  const planned = activeOrders.filter((order) => order.scheduledDate).length;
  const completed = activeOrders.filter((order) => order.status === "completed").length;
  const overdue = state.customers.filter((customer) => customer.nextDue && customer.nextDue < today).length;
  const completedRoutes = state.routes.filter((route) => route.status === "completed");
  const routesWithStops = state.routes.filter((route) => route.stops.length > 0);
  const totalStops = routesWithStops.reduce((sum, route) => sum + route.stops.length, 0);
  const totalTravelMinutes = routesWithStops.reduce((sum, route) => sum + route.travelMinutes, 0);
  const totalServiceMinutes = routesWithStops.reduce((sum, route) => sum + route.serviceMinutes, 0);
  const plannedCapacity = state.drivers.filter((driver) => driver.active).reduce((sum, driver) => sum + driver.maxStops, 0);
  const todayCompleted = todayOrders.filter((order) => order.status === "completed").length;

  return {
    todayOrders: todayOrders.length,
    todayCompleted,
    activeRoutes: activeRoutes.length,
    activeDrivers: state.drivers.filter((driver) => driver.active).length,
    overdue,
    coveragePercent: activeOrders.length ? Math.round((planned / activeOrders.length) * 100) : 0,
    completed,
    travelMinutesPerStop: totalStops ? totalTravelMinutes / totalStops : 0,
    capacityPercent: plannedCapacity ? Math.round((todayOrders.length / plannedCapacity) * 100) : 0,
    // Arrival timestamps are not inferred from creation time. Until those are
    // available in driver events, the UI renders this KPI as unavailable.
    onTimePercent: null as number | null,
    digitalReportPercent: completed ? Math.round((state.reports.length / completed) * 100) : 0,
    totalDistanceKm: routesWithStops.reduce((sum, route) => sum + route.distanceKm, 0),
    totalTravelMinutes,
    totalServiceMinutes,
    completedRoutes: completedRoutes.length,
    totalStops,
  };
}

/** The application uses the browser's business date; the explicit argument
 * makes tests and reporting reproducible. */
export function businessDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
