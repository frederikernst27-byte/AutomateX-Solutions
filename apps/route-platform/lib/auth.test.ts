import { beforeEach, describe, expect, it } from "vitest";
import { createDemoSession, getAuthContext, requireAuth } from "./auth";

describe("request authentication", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "true";
    delete process.env.DEMO_AUTH_SECRET;
    delete process.env.AUTH_SECRET;
  });

  it("accepts an explicitly issued admin demo session", async () => {
    const token = createDemoSession({ role: "admin" });
    const context = await getAuthContext(new Request("http://localhost/api/state", { headers: { Authorization: `Bearer ${token}` } }));
    expect(context).toMatchObject({ role: "admin", orgId: "demo-org", demo: true });
  });

  it("binds a driver session to its driver id", async () => {
    const token = createDemoSession({ role: "driver", driverId: "drv-anna" });
    const context = await getAuthContext(new Request("http://localhost/api/driver/tours", { headers: { "x-automatex-session": token } }));
    expect(context).toMatchObject({ role: "driver", driverId: "drv-anna" });
  });

  it("rejects missing and tampered sessions", async () => {
    const missing = await requireAuth(new Request("http://localhost/api/plans"), { roles: ["admin"] });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.response.status).toBe(401);
    const token = createDemoSession({ role: "admin" });
    const tampered = `${token.slice(0, -1)}x`;
    expect(await getAuthContext(new Request("http://localhost/api/plans", { headers: { Authorization: `Bearer ${tampered}` } }))).toBeNull();
  });
});
