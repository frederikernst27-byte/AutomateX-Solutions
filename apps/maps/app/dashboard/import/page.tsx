"use client";
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { parseExcelFile, autoDetectMapping, applyMapping, type ColumnMapping, type ExcelData } from "@/lib/excel";
import { geocode } from "@/lib/routing";

const FIELDS: Array<{ key: keyof ColumnMapping; label: string; required?: boolean }> = [
  { key: "name", label: "Kundenname", required: true },
  { key: "address", label: "Adresse", required: true },
  { key: "date", label: "Datum" },
  { key: "time_from", label: "Zeit von" },
  { key: "time_to", label: "Zeit bis" },
  { key: "priority", label: "Priorität" },
  { key: "notes", label: "Notiz" }
];

export default function ImportPage() {
  const router = useRouter();
  const [data, setData] = useState<ExcelData | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; failures: string[] } | null>(null);
  const [error, setError] = useState("");

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    try {
      const parsed = await parseExcelFile(file);
      setData(parsed);
      setMapping(autoDetectMapping(parsed.headers));
    } catch (e) {
      setError("Datei konnte nicht gelesen werden. Excel oder CSV?");
    }
  }

  const setMap = useCallback((field: keyof ColumnMapping, col: string) => {
    setMapping(m => ({ ...m, [field]: col || undefined }));
  }, []);

  async function runImport() {
    if (!data) return;
    if (!mapping.name || !mapping.address) {
      setError("Bitte mindestens Kundenname und Adresse zuordnen.");
      return;
    }
    setImporting(true);
    setError("");

    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    const { data: member } = await sb.from("org_members").select("org_id").eq("user_id", user!.id).single();
    if (!member) { setError("Org nicht gefunden"); setImporting(false); return; }

    const items = applyMapping(data.rows, mapping);
    setProgress({ done: 0, total: items.length, failures: [] });

    const failures: string[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const coords = await geocode(item.address);
      const { error: err } = await sb.from("stops").insert({
        org_id: member.org_id,
        name: item.name, address: item.address,
        lat: coords?.lat ?? null, lng: coords?.lng ?? null,
        time_from: item.time_from, time_to: item.time_to,
        notes: item.notes, priority: item.priority,
        scheduled_date: item.date ?? new Date().toISOString().split("T")[0],
        status: "pending"
      });
      if (err) failures.push(`${item.name}: ${err.message}`);
      setProgress({ done: i + 1, total: items.length, failures });
    }

    setImporting(false);
    if (failures.length === 0) {
      setTimeout(() => router.push("/dashboard"), 1500);
    }
  }

  const items = data ? applyMapping(data.rows, mapping) : [];

  return (
    <>
      <div className="page-header">
        <div className="section-kicker">Massenimport</div>
        <h1>Excel-Import</h1>
        <p>Lade eine Excel-/CSV-Datei hoch. Adressen werden automatisch geokodiert.</p>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {!data ? (
        <div className="card" style={{ textAlign: "center", padding: 60 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
          <h3 style={{ margin: "0 0 8px" }}>Datei wählen</h3>
          <p style={{ color: "var(--muted)", margin: "0 0 20px", fontSize: 14 }}>
            .xlsx, .xls oder .csv
          </p>
          <label className="btn green" style={{ cursor: "pointer" }}>
            📂 Datei auswählen
            <input type="file" accept=".xlsx,.xls,.csv" onChange={onFile} style={{ display: "none" }} />
          </label>
          <div style={{ marginTop: 24, fontSize: 12, color: "var(--muted)" }}>
            Erwartete Spalten (mind. Name & Adresse): Kunde, Adresse, Datum, Zeit von, Zeit bis, Priorität, Notiz
          </div>
        </div>
      ) : (
        <>
          {/* Mapping */}
          <div className="card" style={{ marginBottom: 20 }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 17 }}>Spalten zuordnen</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
              {FIELDS.map(f => (
                <div key={f.key} className="form-group" style={{ marginBottom: 0 }}>
                  <label>{f.label}{f.required && " *"}</label>
                  <select value={mapping[f.key] ?? ""} onChange={e => setMap(f.key, e.target.value)}>
                    <option value="">— nicht zuordnen —</option>
                    {data.headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="card" style={{ marginBottom: 20, padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong>Vorschau · {items.length} gültige Zeilen von {data.rows.length}</strong>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>Zeilen ohne Name oder Adresse werden übersprungen</span>
            </div>
            <div style={{ maxHeight: 320, overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead style={{ background: "var(--soft)", position: "sticky", top: 0 }}>
                  <tr>
                    <th style={{ padding: "8px 12px", textAlign: "left" }}>Name</th>
                    <th style={{ padding: "8px 12px", textAlign: "left" }}>Adresse</th>
                    <th style={{ padding: "8px 12px", textAlign: "left" }}>Datum</th>
                    <th style={{ padding: "8px 12px", textAlign: "left" }}>Zeit</th>
                    <th style={{ padding: "8px 12px", textAlign: "left" }}>Prio</th>
                  </tr>
                </thead>
                <tbody>
                  {items.slice(0, 50).map((r, i) => (
                    <tr key={i} style={{ borderTop: "1px solid var(--line)" }}>
                      <td style={{ padding: "8px 12px", fontWeight: 700 }}>{r.name}</td>
                      <td style={{ padding: "8px 12px", color: "var(--muted)" }}>{r.address}</td>
                      <td style={{ padding: "8px 12px" }}>{r.date ?? "heute"}</td>
                      <td style={{ padding: "8px 12px" }}>{r.time_from ?? "—"}{r.time_to ? `–${r.time_to}` : ""}</td>
                      <td style={{ padding: "8px 12px" }}>{["Normal", "Hoch", "Dringend"][r.priority]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {progress ? (
            <div className="card">
              <h3 style={{ margin: "0 0 14px" }}>Import läuft…</h3>
              <div style={{ background: "var(--soft)", borderRadius: 999, height: 8, overflow: "hidden", marginBottom: 10 }}>
                <div style={{ background: "var(--green)", height: "100%", width: `${(progress.done / progress.total) * 100}%`, transition: "width .2s" }} />
              </div>
              <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>
                {progress.done} / {progress.total} verarbeitet
                {progress.failures.length > 0 && ` · ${progress.failures.length} Fehler`}
              </p>
              {progress.done === progress.total && (
                <div className="success-msg" style={{ marginTop: 14, marginBottom: 0 }}>
                  ✓ Import abgeschlossen. Du wirst zum Dashboard weitergeleitet…
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn ghost" onClick={() => { setData(null); setMapping({}); }}>← Andere Datei</button>
              <button className="btn green" onClick={runImport} disabled={importing || items.length === 0}>
                ⚡ {items.length} Stops importieren
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}
