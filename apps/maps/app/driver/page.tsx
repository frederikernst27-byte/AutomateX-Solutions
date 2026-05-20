"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import type { MapStop } from "@/components/Map";

const Map = dynamic(() => import("@/components/Map"), { ssr: false, loading: () => <div className="driver-map" style={{ display:"grid", placeItems:"center", background:"#0d1117", color:"rgba(255,255,255,.4)" }}>Karte lädt…</div> });

interface Stop { id: string; name: string; address: string; lat: number | null; lng: number | null; status: string; time_from: string | null; time_to: string | null; notes: string | null; }

export default function DriverPage() {
  const [stops, setStops] = useState<Stop[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapKey, setMapKey] = useState(0);
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);
  const sb = createClient();
  const today = new Date().toISOString().split("T")[0];

  const loadData = useCallback(async () => {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    const { data: member } = await sb.from("org_members").select("org_id").eq("user_id", user.id).single();
    if (!member) return;
    setOrgId(member.org_id);
    const { data } = await sb.from("stops").select("*")
      .eq("org_id", member.org_id).eq("scheduled_date", today)
      .order("priority", { ascending: false }).order("time_from", { ascending: true });
    setStops(data ?? []);
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

  async function markDone(id: string) {
    await sb.from("stops").update({ status: "done" }).eq("id", id);
    setStops(s => s.map(x => x.id === id ? { ...x, status: "done" } : x));
    setMapKey(k => k + 1);
  }

  async function markInProgress(id: string) {
    await sb.from("stops").update({ status: "in_progress" }).eq("id", id);
    setStops(s => s.map(x => x.id === id ? { ...x, status: "in_progress" } : x));
    setMapKey(k => k + 1);
  }

  const active = stops.find(s => s.status === "in_progress");
  const pending = stops.filter(s => s.status === "pending");
  const done = stops.filter(s => s.status === "done");

  const mapStops: MapStop[] = stops
    .filter(s => s.lat && s.lng)
    .map((s, i) => ({ id: s.id, name: s.name, address: s.address, lat: s.lat!, lng: s.lng!, status: s.status, index: i + 1 }));

  const navUrl = (s: Stop) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(s.address)}`;

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
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <span style={{ width:8, height:8, borderRadius:"50%", background:"var(--green)", display:"inline-block", boxShadow:"0 0 0 3px rgba(22,182,127,.25)" }} />
          <span style={{ fontSize:12, color:"rgba(255,255,255,.5)" }}>Live</span>
        </div>
      </div>

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
