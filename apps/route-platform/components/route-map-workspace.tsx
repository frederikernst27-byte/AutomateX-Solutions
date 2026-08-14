"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Map, Route as RouteIcon } from "lucide-react";
import { MapPreview } from "@/components/map-preview";
import type { Customer, Driver, Route, WorkOrder } from "@/lib/types";
import { formatDate, formatNumber } from "@/lib/utils";

export function RouteMapWorkspace({ routes, drivers, customers, workOrders }: { routes: Route[]; drivers: Driver[]; customers: Customer[]; workOrders: WorkOrder[] }) {
  const [selectedRouteId, setSelectedRouteId] = useState<string>();
  const ordered = useMemo(() => [...routes].sort((a, b) => a.date.localeCompare(b.date) || (drivers.find((driver) => driver.id === a.driverId)?.name ?? "").localeCompare(drivers.find((driver) => driver.id === b.driverId)?.name ?? "")), [routes, drivers]);
  const selected = ordered.find((route) => route.id === selectedRouteId);
  const mapRoutes = selected ? [selected] : ordered;
  return <div className="overflow-hidden rounded-2xl border border-line bg-white lg:grid lg:grid-cols-[310px_minmax(0,1fr)]">
    <aside className="border-b border-line bg-soft/45 lg:max-h-[590px] lg:overflow-y-auto lg:border-b-0 lg:border-r">
      <div className="sticky top-0 z-10 border-b border-line bg-white/95 p-4 backdrop-blur"><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-brand-700"><Map className="h-4 w-4" /></span><div><p className="text-sm font-extrabold">Routen</p><p className="text-[11px] text-muted">{ordered.length} Touren auf der Karte</p></div></div><button type="button" onClick={() => setSelectedRouteId(undefined)} className={`mt-3 w-full rounded-lg border px-3 py-2 text-left text-xs font-extrabold ${!selected ? "border-brand-300 bg-brand-50 text-brand-800" : "border-line bg-white text-muted"}`}>Alle Touren anzeigen</button></div>
      <div className="space-y-2 p-3">{ordered.map((route) => { const driver = drivers.find((item) => item.id === route.driverId); const active = selected?.id === route.id; return <button type="button" key={route.id} onClick={() => setSelectedRouteId(route.id)} className={`w-full rounded-xl border p-3 text-left transition ${active ? "border-brand-300 bg-brand-50 shadow-sm" : "border-line bg-white hover:border-brand-200"}`}><div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: driver?.color ?? "#16b67f" }} /><span className="min-w-0 flex-1 truncate text-xs font-extrabold">{driver?.name ?? "Fahrer"}</span><RouteIcon className="h-3.5 w-3.5 text-brand-600" /></div><p className="mt-2 flex items-center gap-1 text-[11px] font-bold text-muted"><CalendarDays className="h-3 w-3" />{formatDate(route.date, { weekday: "short", day: "2-digit", month: "short" })}</p><div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-extrabold text-slate-600"><span className="rounded bg-soft px-1.5 py-1">{route.stops.length} Stopps</span><span className="rounded bg-soft px-1.5 py-1">{formatNumber(route.distanceKm, 1)} km</span><span className="rounded bg-soft px-1.5 py-1">{route.travelMinutes} Min.</span></div></button>; })}{!ordered.length && <p className="p-5 text-center text-xs text-muted">Noch keine Touren im Entwurf.</p>}</div>
    </aside>
    <div className="relative min-h-[500px] p-3"><MapPreview routes={mapRoutes} drivers={drivers} customers={customers} workOrders={workOrders} focusDriverId={selected?.driverId} className="h-full min-h-[520px]" /><div className="pointer-events-none absolute left-6 top-6 rounded-lg border border-white/70 bg-white/90 px-3 py-2 text-xs font-extrabold text-ink shadow-sm backdrop-blur">{selected ? `${drivers.find((driver) => driver.id === selected.driverId)?.name ?? "Tour"} · ${formatDate(selected.date, { weekday: "long", day: "2-digit", month: "long" })}` : "Gesamtansicht · alle Touren"}</div></div>
  </div>;
}
