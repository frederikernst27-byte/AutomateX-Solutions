"use client";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { geocode } from "@/lib/routing";

interface Stop {
  id: string; name: string; address: string;
  lat: number | null; lng: number | null;
  time_from: string | null; time_to: string | null;
  status: "pending" | "in_progress" | "done" | "cancelled";
  notes: string | null; priority: number;
  scheduled_date: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Ausstehend", in_progress: "Unterwegs", done: "Erledigt", cancelled: "Abgesagt"
};

const today = () => new Date().toISOString().split("T")[0];

export default function DashboardPage() {
  const [stops, setStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [form, setForm] = useState({ name: "", address: "", time_from: "", time_to: "", notes: "", priority: "0", scheduled_date: today() });
  const [error, setError] = useState("");

  const sb = createClient();

  const loadOrgAndStops = useCallback(async () => {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    const { data: member } = await sb.from("org_members").select("org_id").eq("user_id", user.id).single();
    if (!member) return;
    setOrgId(member.org_id);
    const { data } = await sb.from("stops").select("*")
      .eq("org_id", member.org_id)
      .eq("scheduled_date", today())
      .order("priority", { ascending: false })
      .order("time_from", { ascending: true });
    setStops(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadOrgAndStops(); }, [loadOrgAndStops]);

  function setF(key: string, val: string) { setForm(f => ({ ...f, [key]: val })); }

  async function addStop(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId) return;
    setGeocoding(true); setError("");
    const coords = await geocode(form.address);
    setGeocoding(false);
    const { error: err } = await sb.from("stops").insert({
      org_id: orgId,
      name: form.name, address: form.address,
      lat: coords?.lat ?? null, lng: coords?.lng ?? null,
      time_from: form.time_from || null, time_to: form.time_to || null,
      notes: form.notes || null, priority: parseInt(form.priority),
      scheduled_date: form.scheduled_date, status: "pending"
    });
    if (err) { setError(err.message); return; }
    setForm({ name: "", address: "", time_from: "", time_to: "", notes: "", priority: "0", scheduled_date: today() });
    setShowForm(false);
    loadOrgAndStops();
  }

  async function updateStatus(id: string, status: Stop["status"]) {
    await sb.from("stops").update({ status }).eq("id", id);
    setStops(s => s.map(x => x.id === id ? { ...x, status } : x));
  }

  async function deleteStop(id: string) {
    if (!confirm("Stop wirklich löschen?")) return;
    await sb.from("stops").delete().eq("id", id);
    setStops(s => s.filter(x => x.id !== id));
  }

  const counts = { pending: stops.filter(s => s.status === "pending").length, done: stops.filter(s => s.status === "done").length, cancelled: stops.filter(s => s.status === "cancelled").length };

  return (
    <>
      <div className="page-header" style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
        <div>
          <div className="section-kicker">Heute · {new Date().toLocaleDateString("de-DE", { weekday:"long", day:"numeric", month:"long" })}</div>
          <h1>Heutige Stops</h1>
          <p>Verwalten Sie Ihre Kunden-Stops für heute</p>
        </div>
        <button className="btn green" onClick={() => setShowForm(s => !s)}>
          {showForm ? "✕ Schließen" : "+ Stop hinzufügen"}
        </button>
      </div>

      <div className="stats-row">
        <div className="stat-card"><div className="val">{stops.length}</div><div className="lbl">Stops gesamt</div></div>
        <div className="stat-card"><div className="val" style={{color:"var(--blue)"}}>{counts.pending}</div><div className="lbl">Ausstehend</div></div>
        <div className="stat-card"><div className="val" style={{color:"var(--green)"}}>{counts.done}</div><div className="lbl">Erledigt</div></div>
        <div className="stat-card"><div className="val" style={{color:"var(--rose)"}}>{counts.cancelled}</div><div className="lbl">Abgesagt</div></div>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ margin:"0 0 18px", fontSize:17, letterSpacing:"-.03em" }}>Neuer Stop</h3>
          {error && <div className="error-msg">{error}</div>}
          <form onSubmit={addStop}>
            <div className="form-row">
              <div className="form-group">
                <label>Kundenname *</label>
                <input value={form.name} onChange={e => setF("name", e.target.value)} required placeholder="Müller GmbH" />
              </div>
              <div className="form-group">
                <label>Datum</label>
                <input type="date" value={form.scheduled_date} onChange={e => setF("scheduled_date", e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label>Adresse *</label>
              <input value={form.address} onChange={e => setF("address", e.target.value)} required placeholder="Musterstraße 1, 45127 Essen" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Von</label>
                <input type="time" value={form.time_from} onChange={e => setF("time_from", e.target.value)} />
              </div>
              <div className="form-group">
                <label>Bis</label>
                <input type="time" value={form.time_to} onChange={e => setF("time_to", e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Priorität</label>
                <select value={form.priority} onChange={e => setF("priority", e.target.value)}>
                  <option value="0">Normal</option>
                  <option value="1">Hoch</option>
                  <option value="2">Dringend</option>
                </select>
              </div>
              <div className="form-group">
                <label>Notiz</label>
                <input value={form.notes} onChange={e => setF("notes", e.target.value)} placeholder="Optional" />
              </div>
            </div>
            <button className="btn green" type="submit" disabled={geocoding}>
              {geocoding ? "Adresse wird geokodiert…" : "Stop speichern"}
            </button>
          </form>
        </div>
      )}

      {loading ? (
        <div style={{ color:"var(--muted)", padding:40, textAlign:"center" }}>Lädt…</div>
      ) : stops.length === 0 ? (
        <div className="card" style={{ textAlign:"center", padding:48, color:"var(--muted)" }}>
          <div style={{ fontSize:40, marginBottom:12 }}>📍</div>
          <strong>Noch keine Stops für heute</strong>
          <p style={{ margin:"8px 0 0" }}>Klicken Sie auf „+ Stop hinzufügen" um zu starten.</p>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {stops.map((stop, i) => (
            <div key={stop.id} className="stop-card">
              <div className={`stop-num ${stop.status === "done" ? "done" : stop.status === "cancelled" ? "cancelled" : ""}`}>
                {i + 1}
              </div>
              <div className="stop-body">
                <strong>{stop.name}</strong>
                <span>{stop.address}</span>
                {(stop.time_from || stop.time_to) && (
                  <span style={{ display:"block", marginTop:2 }}>🕐 {stop.time_from ?? "?"} – {stop.time_to ?? "?"}</span>
                )}
                {stop.notes && <span style={{ display:"block", marginTop:2, fontStyle:"italic" }}>💬 {stop.notes}</span>}
                {!stop.lat && <span style={{ display:"block", color:"var(--rose)", fontSize:11, marginTop:2 }}>⚠ Kein Koordinaten – Route kann diesen Stop evtl. nicht anzeigen</span>}
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:6, alignItems:"flex-end", flexShrink:0 }}>
                <span className={`stop-badge ${stop.status}`}>{STATUS_LABELS[stop.status]}</span>
                <select
                  value={stop.status}
                  onChange={e => updateStatus(stop.id, e.target.value as Stop["status"])}
                  style={{ fontSize:11, padding:"3px 6px", borderRadius:8, border:"1px solid var(--line)", cursor:"pointer" }}
                >
                  <option value="pending">Ausstehend</option>
                  <option value="in_progress">Unterwegs</option>
                  <option value="done">Erledigt</option>
                  <option value="cancelled">Abgesagt</option>
                </select>
                <button onClick={() => deleteStop(stop.id)} style={{ fontSize:11, color:"var(--muted)", background:"none", border:"none", cursor:"pointer" }}>🗑 Löschen</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
