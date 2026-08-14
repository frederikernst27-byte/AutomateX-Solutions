import { describe, expect, it } from "vitest";
import { createDemoState } from "./demo-data";
import { defaultConstraints, distanceKm, googleMapsUrl, planDemoRoutes, validateRouteStops } from "./planner";

describe("AutomateX fallback planner", () => {
  it("keeps routes inside a driver's configured stop limit", () => {
    const state = createDemoState();
    const result = planDemoRoutes(state, { ...defaultConstraints(state.drivers), from: "2026-07-17", to: "2026-07-17", defaultMaxStops: 2 });
    result.routes.forEach((route) => expect(route.stops.length).toBeLessThanOrEqual(state.drivers.find((driver) => driver.id === route.driverId)!.maxStops));
    expect(result.summary.assigned).toBeGreaterThan(0);
  });

  it("creates a bounded Google Maps URL", () => {
    const state = createDemoState();
    const url = googleMapsUrl(state.routes[0], state);
    expect(url).toContain("api=1");
    expect(url).toContain("travelmode=driving");
    expect(url.length).toBeLessThan(2048);
  });

  it("uses a realistic geographic distance", () => {
    expect(distanceKm({ lat: 51.4556, lng: 7.0116 }, { lat: 51.496, lng: 6.852 })).toBeGreaterThan(10);
  });

  it("does not plan a driver on a configured day off", () => {
    const state = createDemoState();
    state.drivers = state.drivers.map((driver) => driver.id === "drv-anna" ? { ...driver, daysOff: ["2026-07-17"] } : driver);
    const result = planDemoRoutes(state, { ...defaultConstraints(state.drivers), driverIds: ["drv-anna"], from: "2026-07-17", to: "2026-07-17" });
    expect(result.routes).toHaveLength(0);
    expect(result.unassigned.some((entry) => entry.reason.includes("abwesend"))).toBe(true);
  });

  it("uses the drivers selected in the daily staffing instead of a stale global selection", () => {
    const state = createDemoState();
    state.workOrders = [{ ...state.workOrders[5], locked: false, assignedDriverId: undefined, scheduledDate: undefined, status: "backlog" }];
    const result = planDemoRoutes(state, {
      ...defaultConstraints(state.drivers),
      driverIds: ["drv-anna"],
      driverAvailability: { "2026-07-17": ["drv-murat"] },
      from: "2026-07-17",
      to: "2026-07-17",
    });
    expect(result.routes).toHaveLength(1);
    expect(result.routes[0].driverId).toBe("drv-murat");
  });

  it("keeps locked assignments with their driver and date", () => {
    const state = createDemoState();
    state.drivers = state.drivers.map((driver) => driver.id === "drv-anna" ? { ...driver, daysOff: ["2026-07-20"] } : driver);
    const result = planDemoRoutes(state, { ...defaultConstraints(state.drivers), driverIds: ["drv-anna", "drv-murat"], from: "2026-07-20", to: "2026-07-20" });
    const routesForMurat = result.routes.filter((route) => route.driverId === "drv-murat");
    expect(routesForMurat.flatMap((route) => route.stops).some((stop) => stop.workOrderId === "wo-1009")).toBe(false);
    expect(result.unassigned.find((entry) => entry.workOrderId === "wo-1009")?.reason).toContain("zugewiesen");
  });

  it("leaves malformed locked orders in the backlog", () => {
    const state = createDemoState();
    state.workOrders = [{ ...state.workOrders[5], id: "wo-locked-without-date", locked: true, scheduledDate: undefined }, ...state.workOrders];
    const result = planDemoRoutes(state, { ...defaultConstraints(state.drivers), from: "2026-07-17", to: "2026-07-17" });
    expect(result.routes.flatMap((route) => route.stops).some((stop) => stop.workOrderId === "wo-locked-without-date")).toBe(false);
    expect(result.unassigned.find((entry) => entry.workOrderId === "wo-locked-without-date")?.reason).toContain("keinen festen Termin");
  });

  it("never reports an order as both assigned and unassigned", () => {
    const state = createDemoState();
    const result = planDemoRoutes(state, { ...defaultConstraints(state.drivers), from: "2026-07-17", to: "2026-07-24" });
    const assigned = new Set(result.routes.flatMap((route) => route.stops.map((stop) => stop.workOrderId)));
    expect(result.unassigned.some((entry) => assigned.has(entry.workOrderId))).toBe(false);
    expect(new Set(result.unassigned.map((entry) => entry.workOrderId)).size).toBe(result.unassigned.length);
    expect(result.summary.assigned).toBe(assigned.size);
    expect(result.summary.unassigned).toBe(result.unassigned.length);
  });

  it("does not duplicate stops that already belong to a published or active route", () => {
    const state = createDemoState();
    const activeIds = new Set(state.routes.filter((route) => !["draft", "cancelled"].includes(route.status)).flatMap((route) => route.stops.map((stop) => stop.workOrderId)));
    const result = planDemoRoutes(state, { ...defaultConstraints(state.drivers), from: "2026-07-17", to: "2026-07-24" });
    const newlyAssigned = result.routes.flatMap((route) => route.stops.map((stop) => stop.workOrderId));
    expect(newlyAssigned.some((id) => activeIds.has(id))).toBe(false);
  });

  it("validates manual route capacity and duplicate stops", () => {
    const state = createDemoState();
    const driver = state.drivers.find((item) => item.id === "drv-leonie")!;
    const orders = state.workOrders.filter((item) => ["wo-1001", "wo-1008", "wo-1010"].includes(item.id)).map((item) => ({ ...item, locked: false, assignedDriverId: undefined, status: "backlog" as const, scheduledDate: "2026-07-17" }));
    const customers = new Map(state.customers.map((customer) => [customer.id, customer]));
    const issues = validateRouteStops("2026-07-17", driver, [...orders, orders[0]], customers);
    expect(issues.some((issue) => issue.code === "max_stops")).toBe(true);
    expect(issues.some((issue) => issue.message.includes("doppelt"))).toBe(true);
  });

  it("rejects manual stops scheduled after their planning deadline", () => {
    const state = createDemoState();
    const driver = state.drivers.find((item) => item.id === "drv-leonie")!;
    const order = { ...state.workOrders[0], deadlineDate: "2026-07-17", locked: false, status: "backlog" as const, scheduledDate: undefined, assignedDriverId: undefined };
    const customers = new Map(state.customers.map((customer) => [customer.id, customer]));
    const issues = validateRouteStops("2026-07-18", driver, [order], customers);
    expect(issues.some((issue) => issue.code === "deadline")).toBe(true);
  });
});
