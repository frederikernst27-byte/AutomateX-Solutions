"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { createEmptyState } from "./initial-state";
import type { Customer, DemoState, Driver, InboxItem, PlanningSettings, Route, ServiceReport, WorkOrder } from "./types";

// Version 2 intentionally does not read the former demo cache. This prevents
// synthetic records from reappearing after the application was upgraded.
const STORAGE_KEY = "automatex-route-offline-state-v2";
const DemoContext = createContext<null | {
  state: DemoState;
  updateWorkOrder: (id: string, patch: Partial<WorkOrder>) => void;
  updateRoute: (id: string, patch: Partial<Route>) => void;
  setRoutes: (routes: Route[]) => void;
  addReport: (report: ServiceReport) => void;
  addCustomers: (customers: DemoState["customers"]) => void;
  updateCustomer: (id: string, patch: Partial<Customer>) => void;
  updateDriver: (id: string, patch: Partial<Driver>) => void;
  addWorkOrder: (workOrder: WorkOrder, persistRemote?: boolean) => void;
  hydrate: (patch: Partial<DemoState>) => void;
  updateInbox: (id: string, patch: Partial<InboxItem>) => void;
  updateSettings: (settings: PlanningSettings) => void;
  notify: (title: string, message: string, type?: "success" | "warning" | "info") => void;
  reset: () => void;
}> (null);

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DemoState>(() => createEmptyState());
  const [hydrated, setHydrated] = useState(false);
  const pathname = usePathname();
  const canSyncServer = !pathname.startsWith("/p/") && !pathname.startsWith("/login") && !pathname.startsWith("/api/");
  const allowLocalCache = pathname.startsWith("/driver");

  useEffect(() => {
    // localStorage is an offline fallback only. The authenticated admin view
    // always prefers the server snapshot so a second browser sees the same
    // plan and customer changes.
    const cached = allowLocalCache ? (() => { try { const stored = localStorage.getItem(STORAGE_KEY); return stored ? JSON.parse(stored) as DemoState : undefined; } catch { return undefined; } })() : undefined;
    if (!canSyncServer) { if (cached) setState(cached); setHydrated(true); return; }
    let cancelled = false;
    const load = async () => {
      for (let attempt = 0; attempt < 3 && !cancelled; attempt += 1) {
        try {
          const response = await fetch("/api/state", { credentials: "same-origin", cache: "no-store" });
          if (response.ok) {
            const payload = await response.json() as { state?: DemoState };
            if (payload.state && !cancelled) setState(payload.state);
            setHydrated(true);
            return;
          }
        } catch { /* use cached state while offline */ }
        await new Promise((resolve) => window.setTimeout(resolve, 150 * (attempt + 1)));
      }
      if (!cancelled && cached) setState(cached);
      if (!cancelled) setHydrated(true);
    };
    void load();
    return () => { cancelled = true; };
  }, [allowLocalCache, canSyncServer, pathname]);
  useEffect(() => { if (hydrated && allowLocalCache) localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }, [state, hydrated, allowLocalCache]);
  useEffect(() => {
    // Admin views use the API as their source of truth. Polling keeps an
    // explicitly submitted driver location visible in another browser even
    // when Supabase Realtime is not configured for a local deployment.
    if (!canSyncServer || !pathname.startsWith("/admin")) return;
    const refresh = async () => {
      try {
        const response = await fetch("/api/state", { credentials: "same-origin", cache: "no-store" });
        const payload = response.ok ? await response.json() as { state?: DemoState } : undefined;
        if (payload?.state) setState(payload.state);
      } catch { /* Keep the most recent confirmed snapshot while offline. */ }
    };
    const timer = window.setInterval(() => { void refresh(); }, 10_000);
    return () => window.clearInterval(timer);
  }, [canSyncServer, pathname]);

  const persist = useCallback((action: unknown) => {
    if (!canSyncServer) return;
    void fetch("/api/state", { method: "PATCH", headers: { "Content-Type": "application/json", "Idempotency-Key": `state-${Date.now()}-${Math.random().toString(36).slice(2)}` }, credentials: "same-origin", body: JSON.stringify(action) }).catch(() => undefined);
  }, [canSyncServer]);

  const value = useMemo(() => ({
    state,
    updateWorkOrder: (id: string, patch: Partial<WorkOrder>) => { setState((current) => ({ ...current, workOrders: current.workOrders.map((item) => item.id === id ? { ...item, ...patch } : item), lastUpdated: new Date().toISOString() })); persist({ type: "workOrder", id, patch }); },
    updateRoute: (id: string, patch: Partial<Route>) => { setState((current) => ({ ...current, routes: current.routes.map((item) => item.id === id ? { ...item, ...patch } : item), lastUpdated: new Date().toISOString() })); persist({ type: "route", id, patch }); },
    setRoutes: (routes: Route[]) => { setState((current) => ({ ...current, routes, lastUpdated: new Date().toISOString() })); persist({ type: "routes", routes }); },
    addReport: (report: ServiceReport) => { setState((current) => ({ ...current, reports: [report, ...current.reports], lastUpdated: new Date().toISOString() })); persist({ type: "report", report }); },
    addCustomers: (customers: DemoState["customers"]) => { const nextCustomers = [...customers, ...state.customers]; setState((current) => ({ ...current, customers: [...customers, ...current.customers], lastUpdated: new Date().toISOString() })); persist({ type: "customers", customers: nextCustomers }); },
    updateCustomer: (id: string, patch: Partial<Customer>) => { const nextCustomers = state.customers.map((item) => item.id === id ? { ...item, ...patch } : item); setState((current) => ({ ...current, customers: current.customers.map((item) => item.id === id ? { ...item, ...patch } : item), lastUpdated: new Date().toISOString() })); persist({ type: "customers", customers: nextCustomers }); },
    updateDriver: (id: string, patch: Partial<Driver>) => { setState((current) => ({ ...current, drivers: current.drivers.map((item) => item.id === id ? { ...item, ...patch } : item), lastUpdated: new Date().toISOString() })); persist({ type: "driver", id, patch }); },
    addWorkOrder: (workOrder: WorkOrder, persistRemote = true) => { setState((current) => ({ ...current, workOrders: [workOrder, ...current.workOrders], lastUpdated: new Date().toISOString() })); if (persistRemote) persist({ type: "workOrderAdd", workOrder }); },
    hydrate: (patch: Partial<DemoState>) => setState((current) => ({ ...current, ...patch, lastUpdated: new Date().toISOString() })),
    updateInbox: (id: string, patch: Partial<InboxItem>) => { setState((current) => ({ ...current, inbox: current.inbox.map((item) => item.id === id ? { ...item, ...patch } : item), lastUpdated: new Date().toISOString() })); persist({ type: "inbox", id, patch }); },
    updateSettings: (settings: PlanningSettings) => { setState((current) => ({ ...current, settings, lastUpdated: new Date().toISOString() })); persist({ type: "settings", settings }); },
    notify: (title: string, message: string, type: "success" | "warning" | "info" = "info") => { const notification = { id: `note-${Date.now()}`, title, message, type, createdAt: new Date().toISOString() }; setState((current) => ({ ...current, notifications: [notification, ...current.notifications].slice(0, 10), lastUpdated: new Date().toISOString() })); persist({ type: "notification", notification }); },
    reset: () => { setState(createEmptyState()); localStorage.removeItem(STORAGE_KEY); localStorage.removeItem("automatex-route-demo-state-v1"); persist({ type: "reset" }); }
  }), [state, persist]);
  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemoStore() {
  const context = useContext(DemoContext);
  if (!context) throw new Error("useDemoStore must be used inside DemoProvider");
  return context;
}
