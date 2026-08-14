import { describe, expect, it } from "vitest";
import { createDemoState } from "./demo-data";
import { defaultConstraints } from "./planner";
import { buildVroomProblem, mapVroomResult } from "./vroom";

describe("VROOM integration", () => {
  it("maps drivers, coordinates and hard limits to VROOM", () => {
    const state = createDemoState();
    state.routes = [];
    const constraints = { ...defaultConstraints(state.drivers), from: "2026-07-20", to: "2026-07-20", defaultMaxStops: 3, defaultMaxTravelMinutes: 120 };
    const problem = buildVroomProblem(state, constraints);
    expect(problem.payload.vehicles.length).toBeGreaterThan(0);
    expect(problem.payload.jobs.length).toBeGreaterThan(0);
    const vehicle = problem.payload.vehicles[0];
    const driver = problem.vehicles.get(vehicle.id)!.driver;
    expect(vehicle.start).toEqual([driver.location.lng, driver.location.lat]);
    expect(vehicle.max_tasks).toBeLessThanOrEqual(3);
    expect(vehicle.max_travel_time).toBeLessThanOrEqual(120 * 60);
    expect(problem.payload.jobs[0].service).toBe(problem.jobs.get(problem.payload.jobs[0].id)!.durationMinutes * 60);
  });

  it("maps VROOM routes and cumulative metrics back to the platform", () => {
    const state = createDemoState();
    state.routes = [];
    const constraints = { ...defaultConstraints(state.drivers), from: "2026-07-20", to: "2026-07-20" };
    const problem = buildVroomProblem(state, constraints);
    const vehicle = problem.payload.vehicles[0];
    const job = problem.payload.jobs[0];
    const result = mapVroomResult(problem, { code: 0, routes: [{ vehicle: vehicle.id, duration: 900, service: job.service, distance: 12_500, steps: [{ type: "start", arrival: 28_800, duration: 0, distance: 0 }, { type: "job", id: job.id, arrival: 29_700, duration: 900, distance: 12_500 }, { type: "end", arrival: 30_600, duration: 1_800, distance: 25_000 }] }], unassigned: [] }, constraints);
    expect(result.mode).toBe("vroom");
    expect(result.routes[0]).toMatchObject({ distanceKm: 12.5, travelMinutes: 15 });
    expect(result.routes[0].stops[0]).toMatchObject({ workOrderId: problem.jobs.get(job.id)!.id, driveMinutesFromPrevious: 15, distanceFromPreviousKm: 12.5 });
  });

  it("uses only the drivers selected for each planning day", () => {
    const state = createDemoState();
    state.routes = [];
    const constraints = {
      ...defaultConstraints(state.drivers),
      from: "2026-07-20",
      to: "2026-07-21",
      driverAvailability: {
        "2026-07-20": ["drv-anna"],
        "2026-07-21": ["drv-murat"],
      },
    };
    const problem = buildVroomProblem(state, constraints);
    expect([...problem.vehicles.values()].map((vehicle) => `${vehicle.date}:${vehicle.driver.id}`).sort()).toEqual([
      "2026-07-20:drv-anna",
      "2026-07-21:drv-murat",
    ]);
  });

  it("makes a planning deadline a hard vehicle-day constraint", () => {
    const state = createDemoState();
    state.routes = [];
    state.workOrders = [{ ...state.workOrders[0], id: "deadline-order", deadlineDate: "2026-07-20", scheduledDate: undefined, assignedDriverId: undefined, locked: false, status: "backlog" }, ...state.workOrders.filter((item) => item.id !== state.workOrders[0].id)];
    const constraints = { ...defaultConstraints(state.drivers), from: "2026-07-20", to: "2026-07-21" };
    const problem = buildVroomProblem(state, constraints);
    const job = problem.payload.jobs.find((item) => problem.jobs.get(item.id)?.id === "deadline-order")!;
    const permittedVehicleIds = problem.payload.vehicles.filter((vehicle) => job.skills?.every((skill) => vehicle.skills.includes(skill))).map((vehicle) => vehicle.id);
    expect(permittedVehicleIds).not.toHaveLength(0);
    expect(permittedVehicleIds.every((id) => problem.vehicles.get(id)!.date === "2026-07-20")).toBe(true);
  });
});
