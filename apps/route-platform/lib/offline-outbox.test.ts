import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearOutbox,
  enqueueOutbox,
  flushOutbox,
  getOutboxEntries,
  retryFailedOutbox,
} from "./offline-outbox";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

describe("driver offline outbox", () => {
  const storage = new MemoryStorage();
  beforeEach(() => {
    vi.stubGlobal("window", { localStorage: storage });
    storage.clear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("persists entries and deduplicates an idempotency key", () => {
    const first = enqueueOutbox({ kind: "driver_event", endpoint: "/api/driver/events", body: { type: "problem" }, idempotencyKey: "same-key" });
    const second = enqueueOutbox({ kind: "driver_event", endpoint: "/api/driver/events", body: { type: "problem" }, idempotencyKey: "same-key" });
    expect(second.id).toBe(first.id);
    expect(getOutboxEntries()).toHaveLength(1);
  });

  it("removes successful entries and retains transient failures", async () => {
    enqueueOutbox({ kind: "driver_event", endpoint: "/api/driver/events", body: { type: "completed" }, id: "ok" });
    enqueueOutbox({ kind: "driver_event", endpoint: "/api/driver/events", body: { type: "location" }, id: "retry" });
    const fetcher = vi.fn(async (_endpoint: RequestInfo | URL, init?: RequestInit) => JSON.parse(String(init?.body)).type === "completed"
      ? new Response(null, { status: 200 })
      : new Response(null, { status: 503 }));
    const result = await flushOutbox(fetcher as unknown as typeof fetch);
    expect(result.sent).toBe(1);
    expect(result.kept).toBe(1);
    expect(getOutboxEntries()[0].id).toBe("retry");
  });

  it("marks permanent failures and allows an explicit retry", async () => {
    enqueueOutbox({ kind: "service_report", endpoint: "/api/driver/reports", body: { confirmed: false }, id: "bad" });
    await flushOutbox(vi.fn(async () => new Response(null, { status: 400 })) as unknown as typeof fetch);
    expect(getOutboxEntries()[0].status).toBe("failed");
    retryFailedOutbox();
    expect(getOutboxEntries()[0].status).toBe("pending");
    clearOutbox();
    expect(getOutboxEntries()).toHaveLength(0);
  });
});
