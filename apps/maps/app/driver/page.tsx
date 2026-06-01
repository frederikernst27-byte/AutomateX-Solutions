"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import type { MapStop } from "@/components/Map";

const Map = dynamic(() => import("@/components/Map"), { ssr: false, loading: () => <div className="driver-map" style={{ display:"grid", placeItems:"center", background:"#0d1117", color:"rgba(255,255,255,.4)" }}>Karte lädt…</div> });

interface Stop { id: string; name: string; address: string; lat: number | null; lng: number | null; status: string; time_from: string | null; time_to: string | null; notes: string | null; assigned_technician_id: string | null; }
interface Technician { id: string; name: string; color: string | null; }

export default function DriverPage() {
  const [allStops, setAllStops] = useState<Stop[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [driverId, setDriverId] = useState<string>("all");
  const [orgId, setOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapKey, setMapKey] = useState(0);
  const [sharing, setSharing] = useState(false);
  const [locError, setLocError] = useState("");
  const watchRef = useRef<number | null>(null);
  const lastSentRef = useRef<number>(0);
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);
  const sb = createClient();
  const today = new Date().toISOString().split("T")[0];

  // Restore the last selected driver on this device
  useEffect(() => {
    const saved = localStorage.getItem("driver-selected");
    if (saved) setDriverId(saved);
  }, []);

  function selectDriver(id: string) {
    setDriverId(id);
    localStorage.setItem("driver-selected", id);
    setMapKey(k => k + 1);
  }

  const loadData = useCallback(async () => {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    const { data: member } = await sb.from("org_members").select("org_id").eq("user_id", user.id).single();
    if (!member) return;
    setOrgId(member.org_id);
    const [{ data }, { data: techs }] = await Promise.all([
      sb.from("stops").select("*")
        .eq("org_id", member.org_id).eq("scheduled_date", today)
        .order("priority", { ascending: false }).order("time_from", { ascending: true }),
      sb.from("technicians").select("id,name,color").eq("org_id", member.org_id).eq("active", true).order("name"),
    ]);
    setAllStops(data ?? []);
    setTechnicians(techs ?? []);
    setLoading(false);
  }, [today]);

  useEffect(() => {
    loadData();
    // Real-time subscription
    const channel = sb.channel("driver-stops")
      .on("postgres_changes", { event: "*", schema: "public", table: "stops" }, () => {
        loadData();
        setMapKey(k => k + 1);
      })
      .subscribe();
    channelRef.current = channel;
    return () => { channel.unsubscribe(); };
  }, [loadData]);

  // ── Live location sharing ──
  // Pushes the device GPS for the selected technician so customers can track
  // them on the public /track page. Throttled to one update every ~12s.
  // The "is sharing" intent is persisted per device so it auto-resumes when the
  // driver re-opens the app (no extra tap; the GPS permission is usually still granted).
  const startSharing = useCallback((techId: string) => {
    if (!navigator.geolocation) { setLocError("Dieses Gerät unterstützt keine Standortermittlung."); return; }
    setLocError("");
    if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = navigator.geolocation.watchPosition(
      async pos => {
        const now = Date.now();
        if (now - lastSentRef.current < 12000) return;
        lastSentRef.current = now;
        await sb.rpc("set_technician_location", { p_tech: techId, p_lat: pos.coords.latitude, p_lng: pos.coords.longitude });
      },
      () => setLocError("Standort konnte nicht ermittelt werden (Berechtigung?)."),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );
    setSharing(true);
  }, []);

  const stopWatch = useCallback(() => {
    if (watchRef.current != null) { navigator.geolocation.clearWatch(watchRef.current); watchRef.current = null; }
    setSharing(false);
  }, []);

  function toggleSharing() {
    if (sharing) { stopWatch(); localStorage.removeItem("driver-sharing"); return; }
    if (driverId === "all") { setLocError("Bitte zuerst oben einen Fahrer auswählen."); return; }
    localStorage.setItem("driver-sharing", driverId);
    startSharing(driverId);
  }

  // Clear the watch on unmount.
  useEffect(() => { return () => { if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current); }; }, []);
  // On driver change / initial load: stop any running watch, then auto-resume
  // if this driver had sharing enabled before (persisted intent).
  useEffect(() => {
    stopWatch();
    if (driverId !== "all" && localStorage.getItem("driver-sharing") === driverId) startSharing(driverId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId]);

  // Only show the selected driver's stops (or all)
  const stops = driverId === "all"
    ? allStops
    : allStops.filter(s => s.assigned_technician_id === driverId);

  async function markDone(id: string) {
    await sb.from("stops").update({ status: "done" }).eq("id", id);
    setAllStops(s => s.map(x => x.id === id ? { ...x, status: "done" } : x));
    setMapKey(k => k + 1);
  }

  async function markInProgress(id: string) {
    await sb.from("stops").update({ status: "in_progress" }).eq("id", id);
    setAllStops(s => s.map(x => x.id === id ? { ...x, status: "in_progress" } : x));
    setMapKey(k => k + 1);
  }

  const active = stops.find(s => s.status === "in_progress");
  const pending = stops.filter(s => s.status === "pending");
  const done = stops.filter(s => s.status === "done");

  const mapStops: MapStop[] = stops
    .filter(s => s.lat && s.lng)
    .map((s, i) => ({ id: s.id, name: s.name, address: s.address, lat: s.lat!, lng: s.lng!, status: s.status, index: i + 1 }));

  const navUrl = (s: Stop) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(s.address)}`;

  // Full Google-Maps route through all not-yet-done stops of the current driver,
  // in displayed order. Origin = current location, last stop = destination,
  // everything in between = waypoints.
  const tripStops = [...(active ? [active] : []), ...pending];
  function startTrip() {
    if (tripStops.length === 0) return;
    const addrs = tripStops.map(s => encodeURIComponent(s.address));
    const destination = addrs[addrs.length - 1];
    const waypoints = addrs.slice(0, -1).join("%7C");
    let url = `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;
    if (waypoints) url += `&waypoints=${waypoints}`;
    window.open(url, "_blank", "noopener");
  }

  return (
    <div className="driver-page">
      <div className="driver-header">
        <div>
          <h1>🚐 Fahrer-Ansicht</h1>
          <div style={{ fontSize:12, color:"rgba(255,255,255,.5)", marginTop:2 }}>
            {new Date().toLocaleDateString("de-DE", { weekday:"long", day:"numeric", month:"long" })}
            {" · "}{stops.length} Stops · {done.length} erledigt
          </div>
        </div>
        <select
          value={driverId}
          onChange={e => selectDriver(e.target.value)}
          aria-label="Fahrer auswählen"
          style={{ background:"rgba(255,255,255,.08)", color:"white", border:"1px solid rgba(255,255,255,.18)", borderRadius:10, padding:"8px 12px", fontSize:13, fontWeight:700, cursor:"pointer", maxWidth:180 }}
        >
          <option value="all">Alle Fahrer</option>
          {technicians.map(t => (
            <option key={t.id} value={t.id} style={{ color:"#111" }}>{t.name}</option>
          ))}
        </select>
      </div>

      {/* Live location sharing */}
      <div style={{ padding:"0 20px 12px", display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
        <button
          onClick={toggleSharing}
          style={{ display:"flex", alignItems:"center", gap:8, border:0, borderRadius:10, padding:"8px 14px", fontSize:13, fontWeight:800, cursor:"pointer",
            background: sharing ? "rgba(22,182,127,.2)" : "rgba(255,255,255,.08)", color: sharing ? "var(--green)" : "rgba(255,255,255,.7)" }}
        >
          {sharing
            ? <><span style={{ width:8, height:8, borderRadius:"50%", background:"var(--green)", boxShadow:"0 0 0 3px rgba(22,182,127,.25)" }} /> Standort wird geteilt</>
            : <>📍 Standort teilen</>}
        </button>
        {sharing && <span style={{ fontSize:11, color:"rgba(255,255,255,.45)" }}>Kunden sehen Ihre Position live</span>}
        {locError && <span style={{ fontSize:11, color:"#f0829a" }}>{locError}</span>}
      </div>

      {/* Start full route in Google Maps */}
      {!loading && tripStops.length > 0 && (
        <button
          onClick={startTrip}
          style={{ width:"100%", background:"var(--blue)", color:"white", border:0, borderRadius:12, padding:"14px", fontSize:15, fontWeight:800, cursor:"pointer", marginBottom:14, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}
        >
          🧭 Fahrt starten · {tripStops.length} Stop{tripStops.length > 1 ? "s" : ""} in Google Maps
        </button>
      )}

      {/* Map */}
      <Map key={mapKey} stops={mapStops} className="driver-map" />

      {loading ? (
        <div style={{ padding:40, textAlign:"center", color:"rgba(255,255,255,.4)" }}>Lädt…</div>
      ) : (
        <div className="driver-stops">
          {/* Active stop */}
          {active && (
            <div className="driver-stop active-stop">
              <div className="driver-num">▶</div>
              <div className="driver-info">
                <strong>📍 Aktuell: {active.name}</strong>
                <span>{active.address}</span>
                {active.time_from && <span>🕐 {active.time_from}{active.time_to ? ` – ${active.time_to}` : ""}</span>}
                {active.notes && <span>💬 {active.notes}</span>}
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                <a href={navUrl(active)} target="_blank" rel="noopener"
                  style={{ background:"var(--blue)", color:"white", borderRadius:10, padding:"8px 12px", fontSize:12, fontWeight:800, textDecoration:"none", textAlign:"center" }}>
                  🧭 Nav
                </a>
                <button className="check-btn" onClick={() => markDone(active.id)}>✓ Erledigt</button>
              </div>
            </div>
          )}

          {/* Pending stops */}
          {pending.length > 0 && (
            <>
              <div style={{ fontSize:11, fontWeight:800, color:"rgba(255,255,255,.35)", letterSpacing:".1em", textTransform:"uppercase", padding:"6px 4px 2px" }}>
                Ausstehend ({pending.length})
              </div>
              {pending.map((stop, i) => (
                <div key={stop.id} className="driver-stop">
                  <div className="driver-num">{i + 1 + (active ? 1 : 0)}</div>
                  <div className="driver-info">
                    <strong>{stop.name}</strong>
                    <span>{stop.address}</span>
                    {stop.time_from && <span>🕐 {stop.time_from}{stop.time_to ? ` – ${stop.time_to}` : ""}</span>}
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                    <button className="check-btn" onClick={() => markInProgress(stop.id)}>▶ Start</button>
                    <a href={navUrl(stop)} target="_blank" rel="noopener"
                      style={{ background:"rgba(255,255,255,.08)", color:"rgba(255,255,255,.6)", borderRadius:10, padding:"6px 10px", fontSize:11, fontWeight:800, textDecoration:"none", textAlign:"center" }}>
                      🧭
                    </a>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Done stops */}
          {done.length > 0 && (
            <>
              <div style={{ fontSize:11, fontWeight:800, color:"rgba(255,255,255,.35)", letterSpacing:".1em", textTransform:"uppercase", padding:"6px 4px 2px" }}>
                Erledigt ({done.length})
              </div>
              {done.map(stop => (
                <div key={stop.id} className="driver-stop done">
                  <div className="driver-num done-num">✓</div>
                  <div className="driver-info">
                    <strong style={{ textDecoration:"line-through", opacity:.5 }}>{stop.name}</strong>
                    <span>{stop.address}</span>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
