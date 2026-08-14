import { describe, expect, it } from "vitest";
import { createEmptyState } from "./initial-state";

describe("clean application startup", () => {
  it("contains no synthetic operational records", () => {
    const state = createEmptyState();
    expect(state.drivers).toEqual([]);
    expect(state.customers).toEqual([]);
    expect(state.workOrders).toEqual([]);
    expect(state.routes).toEqual([]);
    expect(state.reports).toEqual([]);
    expect(state.inbox).toEqual([]);
  });
});
