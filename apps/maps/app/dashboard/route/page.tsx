"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import { optimizeRoute, getRoutePolyline } from "@/lib/routing";
import type { MapStop } from "@/components/Map";

const Map = dynamic(() => import("@/components/Map"), {
  ssr: false,
  loading: () => <div className="map-wrap" style={{ display:"grid", placeItems:"center", color:"var(--muted)" }}>Karte lädt…</div>
});

interface Stop { id: string; name: string; address: string; lat: number | null; lng: number | null; status: string; }
interface EmailSuggestion { id: string; recipient_name: string; recipient_address: string; subject: string; body: string; reason: string; }

export default function RoutePage() {
  const [stops, setStops] = useState<Stop[]>([]);
  const [orderedStops, setOrderedStops] = useState<Stop[]>([]);
  const [polyline, setPolyline] = useState<Array<[number, number]>>([]);
  const [optimizing, setOptimizing] = useState(false);
  const [stats, setStats] = useState<{ distanceKm: number; durationMin: number } | null>(null);
  const [mapKey, setMapKey] = useState(0);
  const [emailSuggestions, setEmailSuggestions] = useState<EmailSuggestion[]>([]);
  const [generatingEmails, setGeneratingEmails] = useState(false);
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null);
  const sbRef = useRef(createClient());
  const sb = sbRef.current;
  const today = new Date().toISOString().split("T")[0];

  const loadStops = useCallback(async () => {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    const { data: member } = await sb.from("org_members").select("org_id").eq("user_id", user.id).single();
    if (!member) return;
    const { data } = await sb.from("stops").select("*")
      .eq("org_id", member.org_id).eq("scheduled_date", today)
      .neq("status", "cancelled").order("priority", { ascending: false });
    setStops(data ?? []);
    setOrderedStops((data ?? []).filter(s => s.lat && s.lng));

    // Load existing email suggestions
    const { data: suggestions } = await sb.from("email_suggestions")
      .select("*").eq("org_id", member.org_id).eq("status", "draft")
      .order("created_at", { ascending: false }).limit(5);
    setEmailSuggestions((suggestions ?? []) as EmailSuggestion[]);
  }, [today]);

  useEffect(() => {
    loadStops();
    const channel = sb.channel("route-stops-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "stops" }, () => loadStops())
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, [loadStops]);

  async function optimizeNow() {
    const valid = stops.filter(s => s.lat && s.lng);
    if (valid.length < 2) return;
    setOptimizing(true);
    const result = await optimizeRoute(valid.map(s => ({ id: s.id, name: s.name, lat: s.lat!, lng: s.lng! })));
    setOptimizing(false);
    if (!result) return;
    setOrderedStops(result.orderedStops.map(o => stops.find(s => s.id === o.id)!));
    setStats({ distanceKm: result.distanceKm, durationMin: result.durationMin });

    try {
      const coords = result.orderedStops.map(s => `${s.lng},${s.lat}`).join(";");
      const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=polyline`);
      const data = await res.json();
      if (data.routes?.[0]?.geometry) setPolyline(getRoutePolyline(data.routes[0].geometry));
    } catch { /* no polyline */ }
    setMapKey(k => k + 1);
  }

  async function generateEmails() {
    setGeneratingEmails(true);
    const res = await fetch("/api/ai/email-suggest", { method: "POST" });
    const data = await res.json();
    setGeneratingEmails(false);
    if (data.suggestions) setEmailSuggestions(data.suggestions);
  }

  async function ignoreEmail(id: string) {
    const sb2 = createClient();
    await sb2.from("email_suggestions").update({ status: "ignored" }).eq("id", id);
    setEmailSuggestions(prev => prev.filter(e => e.id !== id));
  }

  const mapStops: MapStop[] = orderedStops
    .filter(s => s.lat && s.lng)
    .map((s, i) => ({ id: s.id, name: s.name, address: s.address, lat: s.lat!, lng: s.lng!, status: s.status, index: i + 1 }));

  const noCoords = stops.filter(s => !s.lat || !s.lng);

  return (
    <>
      <div className="page-header" style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
        <div>
          <div className="section-kicker">Heute · Route</div>
          <h1>Karte & Routenplanung</h1>
          <p>KI-optimierte Reihenfolge via OSRM · Live-Updates</p>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button className="btn ghost sm" onClick={generateEmails} disabled={generatingEmails || stops.length === 0}>
            {generatingEmails ? "⏳ Generiert…" : "📧 Email-Vorschläge"}
          </button>
          <button className="btn green" onClick={optimizeNow} disabled={optimizing || mapStops.length < 2}>
            {optimizing ? "⏳ Optimiert…" : "⚡ Route optimieren"}
          </button>
        </div>
      </div>

      {noCoords.length > 0 && (
        <div className="error-msg" style={{ marginBottom:16 }}>
          ⚠ {noCoords.length} Stop{noCoords.length > 1 ? "s haben" : " hat"} keine Koordinaten: {noCoords.map(s => s.name).join(", ")}
        </div>
      )}

      {stats && (
        <div className="stats-row" style={{ marginBottom:20 }}>
          <div className="stat-card"><div className="val"><em>{stats.distanceKm}</em> km</div><div className="lbl">Gesamtstrecke</div></div>
          <div className="stat-card"><div className="val"><em>{stats.durationMin}</em> min</div><div className="lbl">Fahrzeit (ca.)</div></div>
          <div className="stat-card"><div className="val">{mapStops.length}</div><div className="lbl">Stops auf Route</div></div>
        </div>
      )}

      <div style={{ display:"grid", gridTemplateColumns:"1fr 320px", gap:20, alignItems:"start" }} className="route-grid">
        <Map key={mapKey} stops={mapStops} routePolyline={polyline} className="map-wrap" />

        <div className="card" style={{ padding:0, overflow:"hidden" }}>
          <div style={{ padding:"14px 16px", borderBottom:"1px solid var(--line)", fontWeight:800, fontSize:14 }}>
            📋 Reihenfolge {stats ? "(optimiert)" : "(unsortiert)"}
          </div>
          <div style={{ maxHeight:440, overflowY:"auto" }}>
            {mapStops.length === 0 ? (
              <div style={{ padding:24, textAlign:"center", color:"var(--muted)", fontSize:13 }}>Keine Stops mit Koordinaten</div>
            ) : mapStops.map((s, i) => (
              <div key={s.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px", borderBottom:"1px solid var(--line)" }}>
                <div style={{ width:28,height:28,borderRadius:"50%",background:s.status==="done"?"var(--green)":"var(--ink)",color:"white",display:"grid",placeItems:"center",fontSize:12,fontWeight:900,flexShrink:0 }}>{i+1}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:700, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.name}</div>
                  <div style={{ fontSize:11, color:"var(--muted)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.address}</div>
                </div>
              </div>
            ))}
          </div>
          {mapStops.length >= 2 && !stats && (
            <div style={{ padding:14, borderTop:"1px solid var(--line)" }}>
              <button className="btn green full sm" onClick={optimizeNow}>⚡ Route optimieren</button>
            </div>
          )}
        </div>
      </div>

      {/* AI Email Suggestions */}
      {emailSuggestions.length > 0 && (
        <div style={{ marginTop:24 }}>
          <div style={{ fontWeight:800, fontSize:16, marginBottom:12, display:"flex", alignItems:"center", gap:8 }}>
            📧 KI Email-Vorschläge
            <span style={{ fontSize:11, fontWeight:600, color:"var(--muted)", background:"var(--soft)", padding:"2px 8px", borderRadius:999 }}>
              {emailSuggestions.length} Vorschläge
            </span>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {emailSuggestions.map(email => (
              <div key={email.id} className="card" style={{ padding:16 }}>
                <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:800, fontSize:14 }}>{email.recipient_name}</div>
                    <div style={{ fontSize:12, color:"var(--muted)", marginTop:2 }}>{email.recipient_address}</div>
                    <div style={{ fontSize:13, fontWeight:700, marginTop:6 }}>Betreff: {email.subject}</div>
                    <div style={{ fontSize:12, color:"var(--muted)", marginTop:4, fontStyle:"italic" }}>💡 {email.reason}</div>
                  </div>
                  <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                    <button onClick={() => setExpandedEmail(expandedEmail === email.id ? null : email.id)}
                      className="btn ghost sm">
                      {expandedEmail === email.id ? "Einklappen" : "Ansehen"}
                    </button>
                    <button onClick={() => ignoreEmail(email.id)}
                      style={{ fontSize:11, padding:"4px 10px", borderRadius:999, border:"1px solid var(--line)", background:"none", cursor:"pointer", color:"var(--muted)" }}>
                      Ignorieren
                    </button>
                  </div>
                </div>
                {expandedEmail === email.id && (
                  <div style={{ marginTop:12, padding:12, background:"var(--soft)", borderRadius:10, fontSize:13, whiteSpace:"pre-wrap", lineHeight:1.6 }}>
                    {email.body}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @media(max-width:900px){
          .route-grid{grid-template-columns:1fr!important;}
        }
      `}</style>
    </>
  );
}
