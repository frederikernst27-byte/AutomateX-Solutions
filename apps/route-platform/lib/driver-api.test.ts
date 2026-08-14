import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as postDriverEvent } from "@/app/api/driver/events/route";
import { GET as getPortal } from "@/app/api/portal/[token]/route";
import { createDemoSession } from "./auth";
import { serverDemoState, serverIdempotency } from "./server-demo";

const originalState = structuredClone(serverDemoState);

function restoreDemoState() {
  Object.assign(serverDemoState, structuredClone(originalState));
  serverIdempotency.clear();
}

function driverRequest(token: string, body: Record<string, unknown>, key: string) {
  return new Request("http://localhost/api/driver/events", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Idempotency-Key": key,
    },
    body: JSON.stringify(body),
  });
}

describe("driver API ownership and transitions", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "true";
    restoreDemoState();
  });

  afterEach(restoreDemoState);

  it("rejects a driver event for another driver's route", async () => {
    const token = createDemoSession({ role: "driver", driverId: "drv-leonie" });
    const response = await postDriverEvent(driverRequest(token, {
      driverId: "drv-anna",
      routeId: "route-anna-today",
      workOrderId: "wo-1002",
      type: "arrived",
    }, "foreign-route"));
    expect(response.status).toBe(403);
  });

  it("keeps the tour active after an intermediate stop is completed", async () => {
    const token = createDemoSession({ role: "driver", driverId: "drv-anna" });
    const response = await postDriverEvent(driverRequest(token, {
      driverId: "drv-anna",
      routeId: "route-anna-today",
      workOrderId: "wo-1002",
      type: "completed",
    }, "complete-first-stop"));
    expect(response.status).toBe(200);
    expect(serverDemoState.routes.find((item) => item.id === "route-anna-today")).toMatchObject({
      status: "started",
      currentStopId: "wo-1003",
    });
  });

  it("replays an accepted offline mutation before revalidating changed state", async () => {
    const token = createDemoSession({ role: "driver", driverId: "drv-anna" });
    const body = { driverId: "drv-anna", routeId: "route-anna-today", workOrderId: "wo-1002", type: "completed" };
    expect((await postDriverEvent(driverRequest(token, body, "offline-replay"))).status).toBe(200);
    const replay = await postDriverEvent(driverRequest(token, body, "offline-replay"));
    expect(replay.status).toBe(200);
    expect(replay.headers.get("Idempotent-Replay")).toBe("true");
  });

  it("does not expose another customer's current stop id in the portal", async () => {
    const response = await getPortal(new Request("http://localhost/api/portal/sonnenhof-demo"), {
      params: Promise.resolve({ token: "sonnenhof-demo" }),
    });
    expect(response.status).toBe(200);
    const payload = await response.json() as { order: { portalToken?: string }; route?: { currentStopId?: string } };
    expect(payload.order.portalToken).toBeUndefined();
    expect(payload.route?.currentStopId).toBeUndefined();
    expect(payload.route).not.toHaveProperty("lastLocation");
  });
});
