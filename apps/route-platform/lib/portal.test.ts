import { afterEach, describe, expect, it, vi } from "vitest";
import { publicPortalOrder, portalTokenIsValid, resetPortalTokenRecords, resolvePortalOrder, rotatePortalToken, serverDemoState } from "./server-demo";
import { POST as postPortal } from "@/app/api/portal/[token]/route";

const originalState = structuredClone(serverDemoState);

afterEach(() => {
  vi.useRealTimers();
  Object.assign(serverDemoState, structuredClone(originalState));
  resetPortalTokenRecords();
});

describe("Portal token lifecycle", () => {
  it("resolves the active order behind the demo token without exposing the raw token", () => {
    const resolved = resolvePortalOrder("keller-demo", new Date("2026-07-17T12:00:00Z"));
    expect("order" in resolved).toBe(true);
    if ("order" in resolved) {
      expect(resolved.order.id).toBe("wo-1005");
      expect(publicPortalOrder(resolved.order)).not.toHaveProperty("portalToken");
    }
  });

  it("rejects expired or revoked records", () => {
    expect(portalTokenIsValid({ tokenHash: "x", workOrderId: "wo-1005", expiresAt: "2026-07-16T23:59:59Z" }, new Date("2026-07-17T00:00:00Z"))).toBe(false);
    expect(portalTokenIsValid({ tokenHash: "x", workOrderId: "wo-1005", expiresAt: "2099-01-01T00:00:00Z", revokedAt: "2026-07-16T23:59:59Z" }, new Date("2026-07-17T00:00:00Z"))).toBe(false);
  });

  it("does not contain duplicate active demo portal tokens", () => {
    const active = serverDemoState.workOrders.filter((order) => !["cancelled"].includes(order.status));
    const tokens = active.map((order) => order.portalToken);
    expect(new Set(tokens).size).toBe(tokens.length);
  });

  it("rotates a token and invalidates the previous credential", () => {
    const order = serverDemoState.workOrders.find((item) => item.id === "wo-1005")!;
    const previous = { token: order.portalToken, expiresAt: order.portalTokenExpiresAt, revokedAt: order.portalTokenRevokedAt };
    try {
      const rotated = rotatePortalToken(order.id, "2099-12-31T23:59:59.000Z");
      expect(rotated).not.toBe(previous.token);
      expect("error" in resolvePortalOrder(previous.token, new Date("2026-07-17T12:00:00Z"))).toBe(true);
      expect("order" in resolvePortalOrder(rotated, new Date("2026-07-17T12:00:00Z"))).toBe(true);
    } finally {
      order.portalToken = previous.token;
      order.portalTokenExpiresAt = previous.expiresAt;
      order.portalTokenRevokedAt = previous.revokedAt;
      resetPortalTokenRecords();
    }
  });

  it("allows the explicitly offered weekend slot but rejects a forged alternative", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-17T12:00:00Z"));
    const confirmed = await postPortal(new Request("http://localhost/api/portal/keller-demo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "confirm" }),
    }), { params: Promise.resolve({ token: "keller-demo" }) });
    expect(confirmed.status).toBe(200);
    expect((await confirmed.json()).order).toMatchObject({ id: "wo-1005", status: "confirmed", scheduledDate: "2026-07-18" });

    Object.assign(serverDemoState, structuredClone(originalState));
    resetPortalTokenRecords();
    const forged = await postPortal(new Request("http://localhost/api/portal/keller-demo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "alternative", date: "2099-01-01" }),
    }), { params: Promise.resolve({ token: "keller-demo" }) });
    expect(forged.status).toBe(409);
  });
});
