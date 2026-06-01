"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  autoAssign,
  isQualified,
  SKILL_CATALOG,
  type DispatchJob,
  type DispatchTechnician,
} from "@/lib/dispatch";

interface Technician {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  skills: string[];
  max_stops_per_day: number;
  color: string | null;
  active: boolean;
}

interface Stop {
  id: string;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  priority: number;
  time_from: string | null;
  required_skills: string[];
  assigned_technician_id: string | null;
  status: string;
}

const PRIORITY = ["Normal", "Hoch", "Dringend"];
const PRIORITY_COLOR = ["var(--muted)", "var(--blue)", "var(--rose)"];
const COLORS = ["#16b67f", "#2f6df6", "#ef6c00", "#9333ea", "#e11d48", "#0891b2", "#65a30d", "#db2777"];
const today = () => new Date().toISOString().split("T")[0];

function SkillChips({ skills, onRemove }: { skills: string[]; onRemove?: (s: string) => void }) {
  if (skills.length === 0)
    return <span style={{ color: "var(--muted)", fontSize: 12 }}>—</span>;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {skills.map(s => (
        <span
          key={s}
          style={{
            background: "var(--soft)",
            border: "1px solid var(--line)",
            borderRadius: 999,
            padding: "2px 9px",
            fontSize: 11,
            fontWeight: 700,
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          {s}
          {onRemove && (
            <button
              onClick={() => onRemove(s)}
              style={{ background: "none", border: 0, cursor: "pointer", color: "var(--muted)", fontSize: 13, lineHeight: 1, padding: 0 }}
              aria-label={`${s} entfernen`}
            >
              ×
            </button>
          )}
        </span>
      ))}
    </div>
  );
}

export default function DispatchPage() {
  const sb = createClient();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [techs, setTechs] = useState<Technician[]>([]);
  const [stops, setStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTechForm, setShowTechForm] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [notice, setNotice] = useState<string>("");

  const [techForm, setTechForm] = useState({
    name: "",
    email: "",
    phone: "",
    max_stops_per_day: "8",
    skills: [] as string[],
  });
  const [skillInput, setSkillInput] = useState("");

  const load = useCallback(async () => {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    const { data: member } = await sb.from("org_members").select("org_id").eq("user_id", user.id).single();
    if (!member) return;
    setOrgId(member.org_id);
    const [{ data: t }, { data: s }] = await Promise.all([
      sb.from("technicians").select("*").eq("org_id", member.org_id).order("name"),
      sb.from("stops").select("*")
        .eq("org_id", member.org_id).eq("scheduled_date", today())
        .neq("status", "cancelled")
        .order("priority", { ascending: false }),
    ]);
    setTechs(t ?? []);
    setStops(s ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ---- Technician management ----
  function addSkillToForm() {
    const v = skillInput.trim();
    if (v && !techForm.skills.includes(v)) {
      setTechForm(f => ({ ...f, skills: [...f.skills, v] }));
    }
    setSkillInput("");
  }

  async function saveTechnician(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId || !techForm.name.trim()) return;
    const color = COLORS[techs.length % COLORS.length];
    const { error } = await sb.from("technicians").insert({
      org_id: orgId,
      name: techForm.name.trim(),
      email: techForm.email || null,
      phone: techForm.phone || null,
      skills: techForm.skills,
      max_stops_per_day: parseInt(techForm.max_stops_per_day) || 8,
      color,
      active: true,
    });
    if (error) { setNotice("Fehler: " + error.message); return; }
    setTechForm({ name: "", email: "", phone: "", max_stops_per_day: "8", skills: [] });
    setShowTechForm(false);
    load();
  }

  async function toggleActive(t: Technician) {
    await sb.from("technicians").update({ active: !t.active }).eq("id", t.id);
    setTechs(prev => prev.map(x => x.id === t.id ? { ...x, active: !x.active } : x));
  }

  async function deleteTechnician(t: Technician) {
    if (!confirm(`Techniker „${t.name}" löschen? Zugewiesene Aufträge werden freigegeben.`)) return;
    await sb.from("technicians").delete().eq("id", t.id);
    setTechs(prev => prev.filter(x => x.id !== t.id));
    setStops(prev => prev.map(s => s.assigned_technician_id === t.id ? { ...s, assigned_technician_id: null } : s));
  }

  // ---- Job required skills ----
  async function updateRequiredSkills(stop: Stop, skills: string[]) {
    setStops(prev => prev.map(s => s.id === stop.id ? { ...s, required_skills: skills } : s));
    await sb.from("stops").update({ required_skills: skills }).eq("id", stop.id);
  }

  async function setAssignment(stopId: string, techId: string | null) {
    setStops(prev => prev.map(s => s.id === stopId ? { ...s, assigned_technician_id: techId } : s));
    await sb.from("stops").update({ assigned_technician_id: techId }).eq("id", stopId);
  }

  // ---- Auto-assign ----
  async function runAutoAssign() {
    setAssigning(true);
    setNotice("");
    const dTechs: DispatchTechnician[] = techs.map(t => ({
      id: t.id, name: t.name, skills: t.skills,
      maxStopsPerDay: t.max_stops_per_day, active: t.active,
    }));
    const dJobs: DispatchJob[] = stops.map(s => ({
      id: s.id, name: s.name, lat: s.lat, lng: s.lng,
      priority: s.priority ?? 0, requiredSkills: s.required_skills ?? [],
      timeFrom: s.time_from,
    }));
    const result = autoAssign(dTechs, dJobs);

    // Persist all assignments
    await Promise.all(
      result.map(a =>
        sb.from("stops").update({ assigned_technician_id: a.technicianId }).eq("id", a.jobId)
      )
    );
    const byJob = new Map(result.map(a => [a.jobId, a.technicianId]));
    setStops(prev => prev.map(s => ({ ...s, assigned_technician_id: byJob.get(s.id) ?? s.assigned_technician_id })));

    const unassigned = result.filter(a => !a.technicianId).length;
    setNotice(
      unassigned === 0
        ? `✓ ${result.length} Aufträge automatisch eingeteilt.`
        : `✓ ${result.length - unassigned} eingeteilt · ⚠ ${unassigned} ohne passenden Techniker (Qualifikation fehlt).`
    );
    setAssigning(false);
  }

  async function resetAssignments() {
    if (!confirm("Alle Zuweisungen für heute zurücksetzen?")) return;
    await Promise.all(stops.map(s => sb.from("stops").update({ assigned_technician_id: null }).eq("id", s.id)));
    setStops(prev => prev.map(s => ({ ...s, assigned_technician_id: null })));
    setNotice("");
  }

  const techById = useMemo(() => new Map(techs.map(t => [t.id, t])), [techs]);
  const dTechs: DispatchTechnician[] = useMemo(
    () => techs.map(t => ({ id: t.id, name: t.name, skills: t.skills, maxStopsPerDay: t.max_stops_per_day, active: t.active })),
    [techs]
  );

  const workload = useMemo(() => {
    const m = new Map<string, number>();
    stops.forEach(s => { if (s.assigned_technician_id) m.set(s.assigned_technician_id, (m.get(s.assigned_technician_id) ?? 0) + 1); });
    return m;
  }, [stops]);

  const assignedCount = stops.filter(s => s.assigned_technician_id).length;

  return (
    <>
      <div className="page-header" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div className="section-kicker">Heute · Disposition</div>
          <h1>Techniker-Einteilung</h1>
          <p>Aufträge automatisch nach Qualifikation &amp; Auslastung auf Ihre Techniker verteilen</p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn green" onClick={runAutoAssign} disabled={assigning || techs.length === 0 || stops.length === 0}>
            {assigning ? "⏳ Teilt ein…" : "⚡ Automatisch einteilen"}
          </button>
          {assignedCount > 0 && (
            <button className="btn" onClick={resetAssignments} style={{ background: "var(--soft)", color: "var(--ink)", border: "1px solid var(--line)" }}>
              Zurücksetzen
            </button>
          )}
        </div>
      </div>

      {notice && (
        <div className="card" style={{ marginBottom: 18, padding: "12px 16px", fontSize: 14, fontWeight: 600 }}>{notice}</div>
      )}

      <div className="stats-row">
        <div className="stat-card"><div className="val">{stops.length}</div><div className="lbl">Aufträge heute</div></div>
        <div className="stat-card"><div className="val" style={{ color: "var(--green)" }}>{assignedCount}</div><div className="lbl">Eingeteilt</div></div>
        <div className="stat-card"><div className="val" style={{ color: "var(--blue)" }}>{stops.length - assignedCount}</div><div className="lbl">Offen</div></div>
        <div className="stat-card"><div className="val">{techs.filter(t => t.active).length}</div><div className="lbl">Aktive Techniker</div></div>
      </div>

      {loading ? (
        <div style={{ color: "var(--muted)", padding: 40, textAlign: "center" }}>Lädt…</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 20, alignItems: "start" }} className="dispatch-grid">
          {/* ---- Technicians column ---- */}
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div className="section-kicker" style={{ margin: 0 }}>Team</div>
              <button className="btn green sm" onClick={() => setShowTechForm(s => !s)}>
                {showTechForm ? "✕" : "+ Techniker"}
              </button>
            </div>

            {showTechForm && (
              <form onSubmit={saveTechnician} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid var(--line)" }}>
                <div className="form-group">
                  <label>Name *</label>
                  <input value={techForm.name} onChange={e => setTechForm(f => ({ ...f, name: e.target.value }))} required placeholder="Max Mustermann" />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Telefon</label>
                    <input value={techForm.phone} onChange={e => setTechForm(f => ({ ...f, phone: e.target.value }))} placeholder="Optional" />
                  </div>
                  <div className="form-group">
                    <label>Max. Stops/Tag</label>
                    <input type="number" min={1} value={techForm.max_stops_per_day} onChange={e => setTechForm(f => ({ ...f, max_stops_per_day: e.target.value }))} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Qualifikationen</label>
                  <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                    <input
                      list="skill-catalog"
                      value={skillInput}
                      onChange={e => setSkillInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addSkillToForm(); } }}
                      placeholder="z.B. Heizung"
                    />
                    <button type="button" className="btn green sm" onClick={addSkillToForm}>+</button>
                  </div>
                  <SkillChips skills={techForm.skills} onRemove={s => setTechForm(f => ({ ...f, skills: f.skills.filter(x => x !== s) }))} />
                </div>
                <button className="btn green full sm" type="submit">Techniker speichern</button>
              </form>
            )}

            {techs.length === 0 ? (
              <div style={{ color: "var(--muted)", fontSize: 13, padding: "8px 0" }}>
                Noch keine Techniker. Legen Sie Ihr Team mit Qualifikationen an, damit die automatische Einteilung passende Mitarbeiter findet.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {techs.map(t => (
                  <div key={t.id} style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 12, opacity: t.active ? 1 : 0.55 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <span style={{ width: 12, height: 12, borderRadius: "50%", background: t.color ?? "var(--ink)", flexShrink: 0 }} />
                      <strong style={{ flex: 1, fontSize: 14 }}>{t.name}</strong>
                      <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700 }}>
                        {workload.get(t.id) ?? 0}/{t.max_stops_per_day}
                      </span>
                    </div>
                    <SkillChips skills={t.skills} />
                    <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
                      <button onClick={() => toggleActive(t)} style={{ background: "none", border: 0, cursor: "pointer", fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>
                        {t.active ? "Pausieren" : "Aktivieren"}
                      </button>
                      <button onClick={() => deleteTechnician(t)} style={{ background: "none", border: 0, cursor: "pointer", fontSize: 11, color: "var(--muted)" }}>
                        🗑 Löschen
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ---- Jobs column ---- */}
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--line)", fontWeight: 800, fontSize: 14 }}>
              📋 Aufträge &amp; Zuweisung
            </div>
            {stops.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
                Keine Aufträge für heute. Stops werden unter „Heutige Stops" oder per Excel-/E-Mail-Import angelegt.
              </div>
            ) : (
              stops.map(stop => {
                const assigned = stop.assigned_technician_id ? techById.get(stop.assigned_technician_id) : null;
                const jobForCheck: DispatchJob = {
                  id: stop.id, name: stop.name, priority: stop.priority,
                  requiredSkills: stop.required_skills ?? [], lat: stop.lat, lng: stop.lng, timeFrom: stop.time_from,
                };
                const noQualified = dTechs.filter(t => t.active).length > 0 &&
                  !dTechs.some(t => t.active && isQualified(t, jobForCheck));
                return (
                  <div key={stop.id} style={{ padding: "14px 16px", borderBottom: "1px solid var(--line)", display: "grid", gridTemplateColumns: "1fr 220px", gap: 16, alignItems: "start" }} className="job-row">
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <strong style={{ fontSize: 14 }}>{stop.name}</strong>
                        <span style={{ fontSize: 11, fontWeight: 800, color: PRIORITY_COLOR[stop.priority] ?? "var(--muted)" }}>
                          {PRIORITY[stop.priority] ?? "Normal"}
                        </span>
                        {stop.time_from && <span style={{ fontSize: 11, color: "var(--muted)" }}>🕐 {stop.time_from}</span>}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--muted)", margin: "2px 0 8px" }}>{stop.address}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)" }}>Benötigt:</span>
                        <SkillChips
                          skills={stop.required_skills ?? []}
                          onRemove={s => updateRequiredSkills(stop, (stop.required_skills ?? []).filter(x => x !== s))}
                        />
                        <select
                          value=""
                          onChange={e => {
                            const v = e.target.value;
                            if (v && !(stop.required_skills ?? []).includes(v)) {
                              updateRequiredSkills(stop, [...(stop.required_skills ?? []), v]);
                            }
                            e.target.value = "";
                          }}
                          style={{ fontSize: 11, padding: "2px 6px", borderRadius: 8, border: "1px dashed var(--line)", cursor: "pointer", color: "var(--muted)" }}
                        >
                          <option value="">+ Skill</option>
                          {SKILL_CATALOG.filter(s => !(stop.required_skills ?? []).includes(s)).map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                      {noQualified && (
                        <div style={{ fontSize: 11, color: "var(--rose)", fontWeight: 700, marginTop: 6 }}>
                          ⚠ Kein aktiver Techniker erfüllt diese Qualifikation
                        </div>
                      )}
                    </div>

                    <div>
                      <select
                        value={stop.assigned_technician_id ?? ""}
                        onChange={e => setAssignment(stop.id, e.target.value || null)}
                        style={{
                          width: "100%", fontSize: 13, padding: "8px 10px", borderRadius: 10,
                          border: "1px solid var(--line)", cursor: "pointer",
                          borderLeft: `4px solid ${assigned?.color ?? "var(--line)"}`,
                          fontWeight: assigned ? 700 : 400,
                        }}
                      >
                        <option value="">— Nicht zugewiesen —</option>
                        {techs.map(t => {
                          const qualified = isQualified(
                            { id: t.id, name: t.name, skills: t.skills, maxStopsPerDay: t.max_stops_per_day, active: t.active },
                            jobForCheck
                          );
                          return (
                            <option key={t.id} value={t.id} disabled={!t.active}>
                              {t.name}{!qualified ? " (nicht qualifiziert)" : ""}{!t.active ? " (pausiert)" : ""}
                            </option>
                          );
                        })}
                      </select>
                      {assigned && (
                        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>
                          {workload.get(assigned.id)} Auftrag{(workload.get(assigned.id) ?? 0) > 1 ? "e" : ""} heute
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      <datalist id="skill-catalog">
        {SKILL_CATALOG.map(s => <option key={s} value={s} />)}
      </datalist>

      <style>{`
        @media(max-width:900px){
          .dispatch-grid{grid-template-columns:1fr!important;}
          .job-row{grid-template-columns:1fr!important;}
        }
      `}</style>
    </>
  );
}
