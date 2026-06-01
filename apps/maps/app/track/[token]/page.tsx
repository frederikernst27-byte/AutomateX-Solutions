"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import { getRoutePolyline } from "@/lib/routing";
import { hm } from "@/lib/notify";
import type { MapStop, RouteLine } from "@/components/Map";

const Map = dynamic(() => import("@/components/Map"), { ssr: false, loading: () => <div style={{ height: 300, display: "grid", placeItems: "center", color: "#667085", background: "#e8eef3" }}>Karte lädt…</div> });

interface Tracking {
  stop: { name: string; address: string; status: string; scheduled_date: string; time_from: string | null; time_to: string | null; lat: number | null; lng: number | null };
  technician: { name: string; color: string | null; lat: number | null; lng: number | null; updated_at: string | null } | null;
}

const FRESH_MS = 10 * 60 * 1000; // a location older than 10 min is "stale"

export default function TrackPage() {
  const params = useParams();
  const token = params.token as string;
  const sb = createClient();
  const [data, setData] = useState<Tracking | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [eta, setEta] = useState<{ minutes: number; polyline: Array<[number, number]> } | null>(null);

  const load = useCallback(async () => {
    const { data: res, error } = await sb.rpc("get_tracking", { p_token: token });
    if (error || !res || !res.stop) { setNotFound(true); return; }
    setData(res as Tracking);
  }, [token]);

  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load]);

  // Whenever we have a fresh technician location, compute live route + ETA to the stop.
  const techLoc = data?.technician?.lat != null && data?.technician?.lng != null ? data.technician : null;
  const locFresh = techLoc?.updated_at ? Date.now() - new Date(techLoc.updated_at).getTime() < FRESH_MS : false;
  const stopLat = data?.stop.lat, stopLng = data?.stop.lng;

  useEffect(() => {
    if (!techLoc || !locFresh || stopLat == null || stopLng == null || data?.stop.status === "done") { setEta(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${techLoc.lng},${techLoc.lat};${stopLng},${stopLat}?overview=full&geometries=polyline`;
        const res = await fetch(url);
        const d = await res.json();
        if (cancelled || !d.routes?.[0]) return;
        setEta({ minutes: Math.round(d.routes[0].duration / 60), polyline: d.routes[0].geometry ? getRoutePolyline(d.routes[0].geometry) : [] });
      } catch { /* keep previous */ }
    })();
    return () => { cancelled = true; };
  }, [techLoc?.lat, techLoc?.lng, locFresh, stopLat, stopLng, data?.stop.status]);

  if (notFound) {
    return (
      <Shell>
        <div style={{ textAlign: "center", padding: "40px 20px" }}>
          <div style={{ fontSize: 40 }}>🔍</div>
          <h2 style={{ margin: "12px 0 6px" }}>Termin nicht gefunden</h2>
          <p style={{ color: "#667085", margin: 0 }}>Dieser Tracking-Link ist ungültig oder abgelaufen.</p>
        </div>
      </Shell>
    );
  }
  if (!data) return <Shell><div style={{ padding: 40, textAlign: "center", color: "#667085" }}>Lädt…</div></Shell>;

  const { stop, technician } = data;
  const showLive = locFresh && (stop.status === "pending" || stop.status === "in_progress");
  const arrivalClock = eta ? new Date(Date.now() + eta.minutes * 60000).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) : null;

  let banner: { color: string; title: string; sub: string };
  if (stop.status === "done") banner = { color: "#16b67f", title: "✅ Auftrag abgeschlossen", sub: "Vielen Dank!" };
  else if (stop.status === "cancelled") banner = { color: "#f0829a", title: "Termin abgesagt", sub: "Bitte kontaktieren Sie uns für einen neuen Termin." };
  else if (showLive && eta) banner = { color: technician?.color ?? "#5795ff", title: "🚐 Ihr Techniker ist unterwegs", sub: `Ankunft in ca. ${eta.minutes} Min${arrivalClock ? ` · gegen ${arrivalClock} Uhr` : ""}` };
  else if (stop.status === "in_progress") banner = { color: "#5795ff", title: "🚐 Ihr Techniker ist unterwegs", sub: "Standort wird gleich aktualisiert…" };
  else banner = { color: "#070912", title: "🗓 Termin geplant", sub: stop.time_from ? `Zeitfenster ${hm(stop.time_from)}${stop.time_to ? `–${hm(stop.time_to)}` : ""} Uhr` : "Wir melden uns, sobald der Techniker startet." };

  const mapStops: MapStop[] = [];
  if (stop.lat != null && stop.lng != null) mapStops.push({ id: "dest", name: stop.name, address: stop.address, lat: stop.lat, lng: stop.lng, status: stop.status, index: 1, color: "#070912", label: "📍" });
  if (showLive && techLoc) mapStops.push({ id: "tech", name: technician?.name ?? "Techniker", address: "Aktuelle Position", lat: techLoc.lat!, lng: techLoc.lng!, status: "pending", index: 2, color: technician?.color ?? "#5795ff", label: "🚐" });
  const routeLines: RouteLine[] = showLive && eta?.polyline.length ? [{ points: eta.polyline, color: technician?.color ?? "#5795ff" }] : [];

  return (
    <Shell>
      <div style={{ borderLeft: `5px solid ${banner.color}`, background: "white", borderRadius: 14, padding: "16px 18px", boxShadow: "0 8px 24px rgba(15,23,42,.08)", marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: "-.02em" }}>{banner.title}</div>
        <div style={{ color: "#667085", fontSize: 14, marginTop: 2 }}>{banner.sub}</div>
      </div>

      {mapStops.length > 0 && (
        <div style={{ borderRadius: 14, overflow: "hidden", boxShadow: "0 8px 24px rgba(15,23,42,.08)", marginBottom: 16 }}>
          <Map key={`${showLive}-${techLoc?.lat}-${techLoc?.lng}`} stops={mapStops} routeLines={routeLines} className="track-map" />
          <style>{`.track-map{height:340px;}`}</style>
        </div>
      )}

      <div style={{ background: "white", borderRadius: 14, padding: "16px 18px", boxShadow: "0 8px 24px rgba(15,23,42,.08)" }}>
        <Row label="Adresse" value={stop.address} />
        {technician && <Row label="Ihr Techniker" value={technician.name} />}
        {(stop.time_from || stop.time_to) && <Row label="Zeitfenster" value={`${hm(stop.time_from) || "?"}–${hm(stop.time_to) || "?"} Uhr`} />}
        {showLive && techLoc?.updated_at && (
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 10 }}>
            Standort aktualisiert {Math.max(0, Math.round((Date.now() - new Date(techLoc.updated_at).getTime()) / 60000))} Min her · aktualisiert automatisch
          </div>
        )}
      </div>
    </Shell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: "1px solid rgba(15,23,42,.06)" }}>
      <span style={{ color: "#667085", fontSize: 13 }}>{label}</span>
      <span style={{ fontWeight: 700, fontSize: 13, textAlign: "right" }}>{value}</span>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "#f4f7fb", fontFamily: "'DM Sans', sans-serif", padding: "20px 16px" }}>
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, fontWeight: 900, fontSize: 18, letterSpacing: "-.03em" }}>
          AutomateX <span style={{ background: "#070912", color: "white", borderRadius: 8, padding: "2px 8px", fontSize: 12 }}>Maps</span>
        </div>
        {children}
        <div style={{ textAlign: "center", color: "#94a3b8", fontSize: 11, marginTop: 20 }}>Live-Terminverfolgung · AutomateX Solutions</div>
      </div>
    </div>
  );
}
