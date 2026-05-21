"use client";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";

export interface MapStop {
  id: string; name: string; address: string;
  lat: number; lng: number; status: string; index: number;
}

interface Props {
  stops: MapStop[];
  routePolyline?: Array<[number, number]>;
  className?: string;
  onStopClick?: (stop: MapStop) => void;
}

export default function Map({ stops, routePolyline, className = "map-wrap", onStopClick }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;

    import("leaflet").then(L => {
      if (!ref.current || mapRef.current) return;

      const center: [number, number] = stops.length
        ? [stops.reduce((s, x) => s + x.lat, 0) / stops.length, stops.reduce((s, x) => s + x.lng, 0) / stops.length]
        : [51.49, 7.15];

      const map = L.map(ref.current, { center, zoom: stops.length > 1 ? 11 : 13, zoomControl: true });
      mapRef.current = map;

      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://openstreetmap.org">OpenStreetMap</a>',
        maxZoom: 19
      }).addTo(map);

      // Force invalidate size after mount to ensure tiles render correctly
      setTimeout(() => map.invalidateSize(), 100);

      stops.forEach(stop => {
        const color = stop.status === "done" ? "#16b67f" : stop.status === "cancelled" ? "#f0829a" : stop.status === "in_progress" ? "#d7ff72" : "#070912";
        const icon = L.divIcon({
          className: "",
          html: `<div style="width:36px;height:36px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 4px 14px rgba(0,0,0,.3);display:grid;place-items:center;font-weight:900;font-size:13px;color:${stop.status==="in_progress"?"#070912":"white"}">${stop.index}</div>`,
          iconSize: [36, 36], iconAnchor: [18, 18], popupAnchor: [0, -22]
        });
        const marker = L.marker([stop.lat, stop.lng], { icon }).addTo(map);
        marker.bindPopup(`<div style="font-family:'DM Sans',sans-serif;min-width:160px"><strong>${stop.name}</strong><br><small style="color:#667085">${stop.address}</small></div>`);
        if (onStopClick) marker.on("click", () => onStopClick(stop));
      });

      if (routePolyline?.length) {
        L.polyline(routePolyline, { color: "#16b67f", weight: 4, opacity: .8 }).addTo(map);
      }

      if (stops.length > 1) {
        const bounds = L.latLngBounds(stops.map(s => [s.lat, s.lng]));
        map.fitBounds(bounds.pad(.15), { animate: false });
      }
    });

    return () => {
      if (mapRef.current) {
        (mapRef.current as { remove: () => void }).remove();
        mapRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={ref} className={className} style={{ position: "relative" }} />;
}
