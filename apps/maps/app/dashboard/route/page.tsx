"use client";
import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import { optimizeRoute, routeWithLegs, computeEtas, type EtaResult } from "@/lib/routing";
import { buildAppointmentEmail, mailtoLink, etaPhrase } from "@/lib/notify";
import type { MapStop, RouteLine } from "@/components/Map";

const Map = dynamic(() => import("@/components/Map"), { ssr: false, loading: () => <div className="map-wrap" style={{ display:"grid", placeItems:"center", color:"var(--muted)" }}>Karte lädt…</div> });

interface Stop {
  id: string; name: string; address: string;
  lat: number | null; lng: number | null; status: string; priority: number;
  time_from: string | null; time_to: string | null; estimated_minutes: number | null;
  customer_email: string | null; assigned_technician_id: string | null;
}
interface Technician { id: string; name: string; color: string | null; }

interface Tour {
  techId: string | null; techName: string; color: string;
  ordered: Stop[]; line: Array<[number, number]>;
  distanceKm: number; durationMin: number; etas: EtaResult[];
}

const GRAY = "#94a3b8";

export default function RoutePage() {
  const [allStops, setAllStops] = useState<Stop[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [selected, setSelected] = useState<string>("all");
  const [startHm, setStartHm] = useState("08:00");
  const [serviceMin, setServiceMin] = useState(45);
  const [tours, setTours] = useState<Tour[]>([]);
  const [unassigned, setUnassigned] = useState<Stop[]>([]);
  const [optimizing, setOptimizing] = useState(false);
  const [mapKey, setMapKey] = useState(0);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const sb = createClient();
  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    const s = localStorage.getItem("route-start"); if (s) setStartHm(s);
    const m = localStorage.getItem("route-service"); if (m) setServiceMin(parseInt(m) || 45);
  }, []);

  const loadStops = useCallback(async () => {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    const { data: member } = await sb.from("org_members").select("org_id").eq("user_id", user.id).single();
    if (!member) return;
    const [{ data: stopsData }, { data: techs }, { data: org }] = await Promise.all([
      sb.from("stops").select("*").eq("org_id", member.org_id).eq("scheduled_date", today).neq("status", "cancelled").order("priority", { ascending: false }),
      sb.from("technicians").select("id,name,color").eq("org_id", member.org_id).eq("active", true).order("name"),
      sb.from("organizations").select("name").eq("id", member.org_id).single(),
    ]);
    setAllStops(stopsData ?? []);
    setTechnicians(techs ?? []);
    setOrgName(org?.name ?? null);
  }, [today]);

  useEffect(() => { loadStops(); }, [loadStops]);

  const techColor = (id: string | null) => technicians.find(t => t.id === id)?.color ?? GRAY;
  const techName = (id: string | null) => technicians.find(t => t.id === id)?.name ?? "Nicht zugewiesen";

  // Optimize one set of stops into an ordered tour + polyline + per-stop ETAs.
  async function buildTour(techId: string | null, stops: Stop[]): Promise<Tour | null> {
    const valid = stops.filter(s => s.lat && s.lng);
    if (valid.length === 0) return null;
    const opt = await optimizeRoute(valid.map(s => ({ id: s.id, name: s.name, lat: s.lat!, lng: s.lng! })));
    if (!opt) return null;
    const ordered = opt.orderedStops.map(o => valid.find(s => s.id === o.id)!);
    const legs = await routeWithLegs(opt.orderedStops.map(o => ({ id: o.id, name: o.name, lat: o.lat, lng: o.lng })));
    const etas = computeEtas(
      ordered.map(s => ({ estimatedMinutes: s.estimated_minutes, timeFrom: s.time_from, timeTo: s.time_to })),
      legs?.legDurationsSec ?? [], startHm, serviceMin
    );
    return {
      techId, techName: techName(techId), color: techColor(techId),
      ordered, line: legs?.polyline ?? [],
      distanceKm: legs?.distanceKm ?? opt.distanceKm, durationMin: legs?.durationMin ?? opt.durationMin, etas,
    };
  }

  async function optimizeNow() {
    setOptimizing(true);
    let newTours: Tour[] = [];
    let newUnassigned: Stop[] = [];
    if (selected === "all") {
      for (const t of technicians) {
        const tour = await buildTour(t.id, allStops.filter(s => s.assigned_technician_id === t.id));
        if (tour) newTours.push(tour);
      }
      newUnassigned = allStops.filter(s => !s.assigned_technician_id && s.lat && s.lng);
    } else {
      const tour = await buildTour(selected, allStops.filter(s => s.assigned_technician_id === selected));
      if (tour) newTours = [tour];
    }
    setTours(newTours);
    setUnassigned(newUnassigned);
    setOptimizing(false);
    setMapKey(k => k + 1);
  }

  function persistStart(v: string) { setStartHm(v); localStorage.setItem("route-start", v); }
  function persistService(v: number) { setServiceMin(v); localStorage.setItem("route-service", String(v)); }

  async function notifyCustomer(stop: Stop, eta: EtaResult, tour: Tour) {
    if (!stop.customer_email) return;
    const etaText = etaPhrase(eta.etaHm, stop.time_from, stop.time_to);
    const { subject, body } = buildAppointmentEmail({
      customerName: stop.name, date: today, etaText,
      technicianName: tour.techId ? tour.techName : null, companyName: orgName,
    });
    // Audit trail (best-effort)
    const { data: { user } } = await sb.auth.getUser();
    const { data: member } = user ? await sb.from("org_members").select("org_id").eq("user_id", user.id).single() : { data: null };
    if (member) {
      await sb.from("email_suggestions").insert({
        org_id: member.org_id, recipient_name: stop.name, recipient_address: stop.address,
        recipient_email: stop.customer_email, subject, body,
        reason: "Terminbestätigung / ETA", status: "sent",
      });
    }
    window.open(mailtoLink(stop.customer_email, subject, body), "_blank");
    setSent(prev => new Set(prev).add(stop.id));
  }

  // ── Map data ──
  const mapStops: MapStop[] = [
    ...tours.flatMap(tour => tour.ordered.filter(s => s.lat && s.lng).map((s, i) => ({
      id: s.id, name: s.name, address: s.address, lat: s.lat!, lng: s.lng!, status: s.status, index: i + 1, color: tour.color,
    }))),
    ...unassigned.map((s, i) => ({ id: s.id, name: s.name, address: s.address, lat: s.lat!, lng: s.lng!, status: "pending", index: i + 1, color: GRAY })),
  ];
  const routeLines: RouteLine[] = tours.filter(t => t.line.length).map(t => ({ points: t.line, color: t.color }));

  const totalStops = tours.reduce((n, t) => n + t.ordered.length, 0);
  const totalKm = Math.round(tours.reduce((n, t) => n + t.distanceKm, 0) * 10) / 10;
  const lateCount = tours.reduce((n, t) => n + t.etas.filter(e => e.status === "spaet").length, 0);
  const assignedWithCoords = allStops.filter(s => (selected === "all" || s.assigned_technician_id === selected) && s.assigned_technician_id && s.lat && s.lng).length;

  return (
    <>
      <div className="page-header" style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
        <div>
          <div className="section-kicker">Heute · Route</div>
          <h1>Karte & Routenplanung</h1>
          <p>Optimierte Touren pro Techniker mit Ankunftszeiten (ETA)</p>
        </div>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
          <select value={selected} onChange={e => setSelected(e.target.value)}
            style={{ fontSize:13, padding:"8px 12px", borderRadius:10, border:"1px solid var(--line)", fontWeight:700, cursor:"pointer" }}>
            <option value="all">Alle Touren</option>
            {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <label style={{ fontSize:12, color:"var(--muted)", fontWeight:700, display:"flex", alignItems:"center", gap:6 }}>
            Start
            <input type="time" value={startHm} onChange={e => persistStart(e.target.value)}
              style={{ fontSize:13, padding:"6px 8px", borderRadius:8, border:"1px solid var(--line)" }} />
          </label>
          <label style={{ fontSize:12, color:"var(--muted)", fontWeight:700, display:"flex", alignItems:"center", gap:6 }}>
            Dauer/Stop
            <input type="number" min={5} step={5} value={serviceMin} onChange={e => persistService(parseInt(e.target.value) || 45)}
              style={{ width:64, fontSize:13, padding:"6px 8px", borderRadius:8, border:"1px solid var(--line)" }} />
          </label>
          <button className="btn green" onClick={optimizeNow} disabled={optimizing || assignedWithCoords < 1}>
            {optimizing ? "⏳ Optimiert…" : "⚡ Route optimieren"}
          </button>
        </div>
      </div>

      {technicians.length === 0 && (
        <div className="error-msg" style={{ marginBottom:16 }}>
          ⚠ Noch keine Techniker angelegt. Unter „Techniker-Einteilung" zuerst das Team anlegen und Aufträge zuweisen.
        </div>
      )}

      {tours.length > 0 && (
        <div className="stats-row" style={{ marginBottom:20 }}>
          <div className="stat-card"><div className="val"><em>{totalKm}</em> km</div><div className="lbl">Gesamtstrecke</div></div>
          <div className="stat-card"><div className="val">{totalStops}</div><div className="lbl">Stops auf Touren</div></div>
          <div className="stat-card"><div className="val">{tours.length}</div><div className="lbl">Touren</div></div>
          <div className="stat-card"><div className="val" style={{ color: lateCount ? "var(--rose)" : "var(--green)" }}>{lateCount}</div><div className="lbl">Terminkonflikte</div></div>
        </div>
      )}

      <div style={{ display:"grid", gridTemplateColumns:"1fr 360px", gap:20, alignItems:"start" }} className="route-grid">
        <Map key={mapKey} stops={mapStops} routeLines={routeLines} className="map-wrap" />

        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          {tours.length === 0 ? (
            <div className="card" style={{ padding:24, textAlign:"center", color:"var(--muted)", fontSize:13 }}>
              Wähle einen Techniker (oder „Alle Touren") und klicke auf „Route optimieren".
            </div>
          ) : tours.map(tour => (
            <div key={tour.techId ?? "none"} className="card" style={{ padding:0, overflow:"hidden" }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 16px", borderBottom:"1px solid var(--line)" }}>
                <span style={{ width:12, height:12, borderRadius:"50%", background:tour.color, flexShrink:0 }} />
                <strong style={{ flex:1, fontSize:14 }}>{tour.techName}</strong>
                <span style={{ fontSize:12, color:"var(--muted)", fontWeight:700 }}>{tour.distanceKm} km · {tour.durationMin} min</span>
              </div>
              {tour.ordered.map((s, i) => {
                const eta = tour.etas[i];
                const etaColor = eta?.status === "spaet" ? "var(--rose)" : eta?.status === "warten" ? "#ef6c00" : "var(--green)";
                return (
                  <div key={s.id} style={{ padding:"10px 14px", borderBottom:"1px solid var(--line)", display:"flex", gap:12, alignItems:"flex-start" }}>
                    <div style={{ width:26, height:26, borderRadius:"50%", background:tour.color, color:"white", display:"grid", placeItems:"center", fontSize:12, fontWeight:900, flexShrink:0 }}>{i+1}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:700, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.name}</div>
                      <div style={{ fontSize:11, color:"var(--muted)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.address}</div>
                      <div style={{ display:"flex", gap:8, alignItems:"center", marginTop:3, flexWrap:"wrap" }}>
                        <span style={{ fontSize:11, fontWeight:800, color:etaColor }}>🕐 ETA {eta?.etaHm}</span>
                        {(s.time_from || s.time_to) && <span style={{ fontSize:11, color:"var(--muted)" }}>Fenster {s.time_from ?? "?"}–{s.time_to ?? "?"}</span>}
                        {eta?.status === "spaet" && <span style={{ fontSize:11, color:"var(--rose)", fontWeight:700 }}>⚠ {eta.deltaMin} Min zu spät</span>}
                        {eta?.status === "warten" && <span style={{ fontSize:11, color:"#ef6c00", fontWeight:700 }}>{eta.deltaMin} Min Wartezeit</span>}
                      </div>
                      {s.customer_email && (
                        <button onClick={() => notifyCustomer(s, eta, tour)}
                          style={{ marginTop:6, fontSize:11, fontWeight:700, background: sent.has(s.id) ? "var(--soft)" : "var(--blue)", color: sent.has(s.id) ? "var(--muted)" : "white", border:0, borderRadius:8, padding:"4px 10px", cursor:"pointer" }}>
                          {sent.has(s.id) ? "✓ Benachrichtigt" : "✉ Kunde benachrichtigen"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          {unassigned.length > 0 && (
            <div className="card" style={{ padding:"12px 16px" }}>
              <div style={{ fontSize:12, fontWeight:800, color:"var(--muted)", marginBottom:6 }}>Nicht zugewiesen ({unassigned.length})</div>
              {unassigned.map(s => <div key={s.id} style={{ fontSize:12, color:"var(--muted)" }}>• {s.name}</div>)}
              <div style={{ fontSize:11, color:"var(--muted)", marginTop:8 }}>Unter „Techniker-Einteilung" einem Techniker zuweisen.</div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media(max-width:900px){
          .route-grid{grid-template-columns:1fr!important;}
        }
      `}</style>
    </>
  );
}
