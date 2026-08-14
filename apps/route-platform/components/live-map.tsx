"use client";

import { useEffect, useMemo, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import type { Customer, Driver, Route, WorkOrder } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Real interactive OpenStreetMap. Drop-in replacement for the former CSS
 * "Pilotkarte": same props, but renders live OSM tiles, real markers and
 * road-accurate route lines via OSRM (with a straight-line fallback when the
 * public router is unavailable). Leaflet is imported lazily inside an effect so
 * nothing touches `window` during server rendering.
 */
export function LiveMap({
  routes,
  drivers,
  customers,
  workOrders,
  focusDriverId,
  className,
  live = false,
}: {
  routes: Route[];
  drivers: Driver[];
  customers: Customer[];
  workOrders: WorkOrder[];
  focusDriverId?: string;
  className?: string;
  live?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const geometryCacheRef = useRef(new Map<string, [number, number][]>());
  const lastBoundsKeyRef = useRef("");

  const customerMap = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);
  const orderMap = useMemo(() => new Map(workOrders.map((o) => [o.id, o])), [workOrders]);

  // Build the render model: per visible route, the ordered geo points plus the
  // metadata each marker needs. Kept as a memo so the draw effect only reruns
  // when the underlying data actually changes.
  const model = useMemo(() => {
    const visibleRoutes = routes.filter((r) => !focusDriverId || r.driverId === focusDriverId);
    const routePoints = visibleRoutes.map((route) => {
      const driver = drivers.find((d) => d.id === route.driverId);
      const stops = route.stops
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((stop) => {
          const customer = customerMap.get(orderMap.get(stop.workOrderId)?.customerId ?? "");
          return customer ? { stop, customer } : null;
        })
        .filter((v): v is { stop: Route["stops"][number]; customer: Customer } => Boolean(v));
      return { route, driver, stops };
    });
    const visibleDrivers = drivers.filter((d) => !focusDriverId || d.id === focusDriverId);
    return { routePoints, visibleDrivers };
  }, [routes, drivers, focusDriverId, customerMap, orderMap]);

  // Tear the Leaflet map down only when the component unmounts.
  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
      leafletRef.current = null;
    };
  }, []);

  // Load Leaflet (once), create the map (once), then draw / redraw whenever the
  // model or live flag changes. A single effect avoids coordinating an init and
  // a draw effect and keeps a constant-length dependency array.
  useEffect(() => {
    let cancelled = false;

    const draw = (L: typeof import("leaflet"), map: LeafletMap, layer: LayerGroup) => {
      if (cancelled) return;
      layer.clearLayers();

      const allLatLng: [number, number][] = [];

    const stopIcon = (color: string, label: string | number) =>
      L.divIcon({
        className: "",
        html: `<div style="width:30px;height:30px;border:3px solid #fff;border-radius:999px 999px 999px 3px;transform:rotate(-45deg);box-shadow:0 5px 15px rgba(8,13,23,.25);display:grid;place-items:center;background:${color}"><span style="transform:rotate(45deg);color:#fff;font-size:11px;font-weight:800">${label}</span></div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 30],
        popupAnchor: [0, -30],
      });

    const driverIcon = (color: string, initials: string) =>
      L.divIcon({
        className: "",
        html: `<div style="width:34px;height:34px;border:3px solid #fff;border-radius:999px;box-shadow:0 5px 15px rgba(8,13,23,.3);display:grid;place-items:center;background:${color};color:#fff;font-size:11px;font-weight:900">${initials}</div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        popupAnchor: [0, -18],
      });

    // Route lines + stop markers.
    model.routePoints.forEach(({ route, driver, stops }) => {
      const color = driver?.color ?? "#16b67f";
      const line: [number, number][] = [];
      if (driver) line.push([driver.location.lat, driver.location.lng]);
      stops.forEach(({ stop, customer }) => {
        const latlng: [number, number] = [customer.location.lat, customer.location.lng];
        line.push(latlng);
        allLatLng.push(latlng);
        const eta = stop.eta ? `${stop.eta} · ` : "";
        L.marker(latlng, { icon: stopIcon(color, stop.order) })
          .bindPopup(
            `<strong>${escapeHtml(customer.name)}</strong><br/><span style="color:#64748b">${eta}${escapeHtml(driver?.name ?? "Tour")}</span><br/><span style="color:#94a3b8;font-size:11px">${escapeHtml(customer.address)}</span>`,
          )
          .addTo(layer);
      });

      if (line.length >= 2) {
        // A light casing keeps each driver's colour readable when routes
        // overlap. Draw it immediately, then replace it with road geometry
        // when OSRM responds.
        const drawRouteLine = (points: [number, number][]) => {
          const casing = L.polyline(points, { color: "#ffffff", weight: 9, opacity: 0.92, lineCap: "round", lineJoin: "round" }).addTo(layer);
          const coloured = L.polyline(points, { color, weight: 5, opacity: 0.98, lineCap: "round", lineJoin: "round" })
            .bindTooltip(`${driver?.name ?? "Tour"} · ${route.stops.length} Stopps`, { sticky: true, direction: "top" })
            .addTo(layer);
          return { casing, coloured };
        };
        const routeKey = `${route.id}:${line.map(([lat, lng]) => `${lat.toFixed(5)},${lng.toFixed(5)}`).join(";")}`;
        const cached = geometryCacheRef.current.get(routeKey);
        if (cached) { drawRouteLine(cached); return; }
        const straight = drawRouteLine(line);
        void fetchRoadGeometry(line)
          .then((geometry) => {
            if (cancelled || !geometry) return;
            geometryCacheRef.current.set(routeKey, geometry);
            straight.casing.remove();
            straight.coloured.remove();
            drawRouteLine(geometry);
          })
          .catch(() => undefined);
      }
    });

    // Driver markers.
    model.visibleDrivers.forEach((driver) => {
      const latlng: [number, number] = [driver.location.lat, driver.location.lng];
      allLatLng.push(latlng);
      const liveBadge = live && driver.status === "on_route" ? '<br/><span style="color:#16b67f;font-weight:800">● LIVE</span>' : "";
      L.marker(latlng, { icon: driverIcon(driver.color, driver.initials), zIndexOffset: 1000 })
        .bindPopup(`<strong>${escapeHtml(driver.name)}</strong><br/><span style="color:#64748b">${escapeHtml(driver.depot)}</span>${liveBadge}`)
        .addTo(layer);
    });

      const boundsKey = allLatLng.map(([lat, lng]) => `${lat.toFixed(4)},${lng.toFixed(4)}`).sort().join(";");
      if (allLatLng.length > 0 && boundsKey !== lastBoundsKeyRef.current) {
        lastBoundsKeyRef.current = boundsKey;
        const bounds = L.latLngBounds(allLatLng);
        map.fitBounds(bounds.pad(0.2), { maxZoom: 14, animate: false });
      }
    };

    void (async () => {
      const L = leafletRef.current ?? (leafletRef.current = await import("leaflet"));
      if (cancelled || !containerRef.current) return;
      let map = mapRef.current;
      if (!map) {
        map = L.map(containerRef.current, { center: [51.44, 6.94], zoom: 11, scrollWheelZoom: false, attributionControl: true });
        // CARTO Voyager keeps the OpenStreetMap data but uses quieter colours
        // and clearer road hierarchy, so the dispatch routes stay dominant.
        const tiles = L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende &copy; <a href="https://carto.com/attributions">CARTO</a>',
        });
        // A missing OSM tile is a recoverable network condition. Stop the raw
        // image error at the tile so Next's development overlay does not try
        // to interpret it as an application exception (`file.split`). Leaflet
        // still handles the tile error and continues rendering the map.
        tiles.on("tileloadstart", (event: { tile: HTMLImageElement }) => {
          event.tile.addEventListener("error", (errorEvent) => {
            errorEvent.preventDefault();
            errorEvent.stopImmediatePropagation();
          }, { capture: true, once: true });
        });
        tiles.addTo(map);
        map.on("click", () => map!.scrollWheelZoom.enable());
        layerRef.current = L.layerGroup().addTo(map);
        mapRef.current = map;
        window.setTimeout(() => map!.invalidateSize(), 60);
      }
      if (layerRef.current) draw(L, map, layerRef.current);
    })();

    return () => {
      cancelled = true;
    };
  }, [model, live]);

  return (
    <div className={cn("relative overflow-hidden rounded-2xl border border-line", className)} style={{ minHeight: 330 }}>
      <div ref={containerRef} className="absolute inset-0" style={{ zIndex: 0 }} />
      <div className="pointer-events-none absolute bottom-3 left-3 z-[500] rounded-lg border border-white/70 bg-white/85 px-2.5 py-1.5 text-[10px] font-bold text-slate-600 backdrop-blur">
        <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-brand-500" />CARTO Voyager · OSM
      </div>
    </div>
  );
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch] ?? ch);
}

// Public OSRM demo router. Returns [lat,lng] pairs for a road-following line,
// or null so the caller keeps the straight-line fallback.
async function fetchRoadGeometry(points: [number, number][]): Promise<[number, number][] | null> {
  if (points.length < 2) return null;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch("/api/osrm/route", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ points }), signal: controller.signal });
    if (!response.ok) return null;
    const data = (await response.json()) as { geometry?: [number, number][] };
    const line = data.geometry;
    if (!line || line.length === 0) return null;
    return line;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
}
