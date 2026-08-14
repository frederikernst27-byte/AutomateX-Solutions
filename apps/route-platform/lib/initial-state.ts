import type { DemoState } from "./types";

/** Clean operational state. Normal development and production starts must
 * never populate customer or route records from synthetic fixtures. */
export function createEmptyState(): DemoState {
  return {
    drivers: [],
    customers: [],
    workOrders: [],
    routes: [],
    reports: [],
    planningRuns: [],
    inbox: [],
    notifications: [],
    settings: {
      defaultMaxStops: 4,
      defaultMaxTravelMinutes: 180,
      defaultMaxRouteMinutes: 480,
      autoConfirm: false,
      gpsEnabled: true,
      locationRetentionDays: 30,
    },
    lastUpdated: new Date().toISOString(),
  };
}
