"use client";

import { useRef, useState } from "react";
import { AlertCircle, Check, CheckCircle2, FileSpreadsheet, FileUp, Loader2, Sparkles, UploadCloud } from "lucide-react";
import { AdminContent, TopBar } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDemoStore } from "@/lib/demo-store";
import { parseCsv, parseWorkbook, rowsToCustomers, type ImportPreview } from "@/lib/importer";
import type { Customer } from "@/lib/types";

export default function ImportPage() {
  const { state, hydrate, notify } = useDemoStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [committed, setCommitted] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  async function handleFile(file?: File) { if (!file) return; setLoading(true); setCommitted(false); try { const parsed = file.name.toLowerCase().endsWith(".csv") ? parseCsv(await file.text()) : await parseWorkbook(file); setPreview(parsed); } catch { notify("Import konnte nicht gelesen werden", "Bitte nutze eine .xlsx-, .xls- oder .csv-Datei.", "warning"); } finally { setLoading(false); } }
  async function commit() {
    if (!preview) return;
    const payload = rowsToCustomers(preview)
      .filter((customer) => customer.address.trim().length >= 3)
      .map((customer) => ({
        name: customer.name, contact: customer.contact, email: customer.email, phone: customer.phone,
        address: customer.address, asset: customer.asset, speciality: customer.speciality,
        nextDue: /^\d{4}-\d{2}-\d{2}$/.test(customer.nextDue) ? customer.nextDue : "",
        intervalMonths: customer.intervalMonths, sla: customer.sla,
      }));
    if (payload.length === 0) { notify("Kein Import möglich", "Keine Zeile enthält eine verwertbare Adresse.", "warning"); return; }
    // The server geocodes every address once and inserts the batch into
    // Supabase, so precise coordinates are stored from the start and nothing is
    // inserted twice.
    setGeocoding(true);
    notify("Import läuft", `${payload.length} Adressen werden über OpenStreetMap geokodiert…`, "info");
    try {
      const response = await fetch("/api/customers/import", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ customers: payload }) });
      const body = await response.json().catch(() => ({})) as { customers?: Customer[]; imported?: number; located?: number; error?: string };
      if (!response.ok || !body.customers) throw new Error(body.error || "Der Import konnte nicht abgeschlossen werden.");
      hydrate({ customers: [...body.customers, ...state.customers] });
      setCommitted(true);
      notify("Import abgeschlossen", `${body.imported ?? body.customers.length} Kunden übernommen · ${body.located ?? 0} präzise verortet.`, "success");
    } catch (error) {
      notify("Import fehlgeschlagen", error instanceof Error ? error.message : "Bitte erneut versuchen.", "warning");
    } finally {
      setGeocoding(false);
    }
  }
  return <><TopBar eyebrow="Daten & Automationen" title="Import-Copilot" description="Importiere Kunden und Wartungsobjekte aus Excel oder CSV. Die KI schlägt die Spaltenzuordnung vor, die Regeln bleiben deterministisch." actions={<Button variant="outline" onClick={() => { const csv = "Kunde,Adresse,Fachgebiet,Nächste Wartung,Anlage,E-Mail"; const blob = new Blob([csv], { type: "text/csv" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "automatex-import-vorlage.csv"; anchor.click(); URL.revokeObjectURL(url); }}>Leere Vorlage herunterladen</Button>} /><AdminContent><div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]"><div className="space-y-5"><Card><CardContent className="p-5"><input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(event) => handleFile(event.target.files?.[0])} /><button type="button" onClick={() => inputRef.current?.click()} onDragEnter={() => setDragging(true)} onDragLeave={() => setDragging(false)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); setDragging(false); handleFile(event.dataTransfer.files[0]); }} className={`flex min-h-[230px] w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition ${dragging ? "border-brand-500 bg-brand-50" : "border-line bg-soft/40 hover:border-brand-300 hover:bg-brand-50/40"}`}><span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-100 text-brand-700"><UploadCloud className="h-7 w-7" /></span><p className="mt-5 text-base font-extrabold">Datei hier ablegen oder auswählen</p><p className="mt-1 max-w-sm text-sm leading-6 text-muted">XLSX, XLS und CSV bis 10 MB · Adressen, Zeitfenster, Anlagen und Fachgebiete werden erkannt.</p><span className="mt-4 rounded-xl bg-white px-4 py-2 text-xs font-extrabold text-brand-700 shadow-sm">Datei auswählen</span></button></CardContent></Card>{loading && <Card><CardContent className="flex items-center gap-3 p-5"><Loader2 className="h-5 w-5 animate-spin text-brand-600" /><div><p className="text-sm font-extrabold">Import-Copilot analysiert die Datei…</p><p className="mt-1 text-xs text-muted">Spalten, Dubletten und Pflichtfelder werden geprüft.</p></div></CardContent></Card>}{preview && <Card><CardHeader className="flex-row flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><CardTitle>Vorschau & Prüfung</CardTitle>{preview.errors.length === 0 ? <Badge>Bereit zum Import</Badge> : <Badge variant="warning">Prüfung nötig</Badge>}</div><p className="mt-1 text-sm text-muted">{preview.rows.length} Zeilen · {preview.errors.length} Fehler · {preview.duplicates.length} mögliche Dubletten</p></div><Button onClick={commit} disabled={preview.errors.length > 0 || committed || geocoding}>{geocoding ? <><Loader2 className="h-4 w-4 animate-spin" />Geokodiere…</> : committed ? <><Check className="h-4 w-4" />Übernommen</> : <><CheckCircle2 className="h-4 w-4" />Import bestätigen</>}</Button></CardHeader><CardContent><div className="rounded-xl border border-line bg-soft/50 p-3"><div className="flex items-center gap-2 text-xs font-extrabold"><Sparkles className="h-4 w-4 text-brand-600" />Vorgeschlagene Spaltenzuordnung</div><div className="mt-3 flex flex-wrap gap-2">{Object.entries(preview.mapping).map(([field, header]) => <span key={field} className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-[11px] font-bold"><span className="text-muted">{field}</span><span className="mx-1.5 text-slate-300">→</span>{header}</span>)}</div></div>{preview.errors.length > 0 && <div className="mt-4 rounded-xl border border-orange-100 bg-orange-50 p-3"><div className="flex items-center gap-2 text-xs font-extrabold text-orange-800"><AlertCircle className="h-4 w-4" />Fehler vor dem Commit korrigieren</div><div className="mt-2 grid gap-1 text-[11px] text-orange-900/80 sm:grid-cols-2">{preview.errors.slice(0, 8).map((error) => <span key={`${error.row}-${error.field}`}>Zeile {error.row}: {error.message}</span>)}</div></div>}<div className="mt-4 overflow-x-auto rounded-xl border border-line"><table className="w-full min-w-[600px] text-left text-xs"><thead><tr className="border-b border-line bg-soft text-[10px] font-black uppercase tracking-[.12em] text-muted">{preview.headers.slice(0, 6).map((header) => <th key={header} className="px-3 py-2.5">{header}</th>)}</tr></thead><tbody>{preview.rows.slice(0, 5).map((row, index) => <tr key={index} className="border-b border-line/70 last:border-0"><td className="px-3 py-3 font-bold">{String(row[preview.mapping.name] ?? "—")}</td><td className="px-3 py-3 text-muted">{String(row[preview.mapping.address] ?? "—")}</td><td className="px-3 py-3 text-muted">{String(row[preview.mapping.speciality] ?? "—")}</td><td className="px-3 py-3 text-muted">{String(row[preview.mapping.nextDue] ?? "—")}</td><td className="px-3 py-3 text-muted">{String(row[preview.mapping.asset] ?? "—")}</td><td className="px-3 py-3 text-muted">{String(row[preview.mapping.email] ?? "—")}</td></tr>)}</tbody></table></div></CardContent></Card>}</div><div className="space-y-5"><Card className="border-0 bg-navy text-white shadow-float"><CardContent className="p-5"><div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500/15 text-brand-400"><FileSpreadsheet className="h-5 w-5" /></div><h2 className="mt-5 text-lg font-extrabold">Für große Datenbestände vorbereitet</h2><p className="mt-2 text-sm leading-6 text-slate-400">Große Imports laufen im Worker weiter. Du siehst Fortschritt, problematische Adressen und Dubletten, bevor sie in den Bestand gelangen.</p><div className="mt-5 space-y-3">{["Spalten automatisch erkennen", "Adressen normalisieren", "Dubletten markieren", "Geocoding im Hintergrund"].map((item) => <div key={item} className="flex items-center gap-2 text-xs font-bold text-slate-300"><span className="grid h-5 w-5 place-items-center rounded-full bg-brand-500/15 text-brand-400"><Check className="h-3 w-3" /></span>{item}</div>)}</div></CardContent></Card><Card><CardHeader><CardTitle>Letzte Imports</CardTitle></CardHeader><CardContent><p className="py-8 text-center text-sm text-muted">Noch keine Imports vorhanden.</p></CardContent></Card></div></div></AdminContent></>;
}

function ImportHistory({ date, name, count, status }: { date: string; name: string; count: string; status: string }) { return <div className="flex items-start gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700"><FileSpreadsheet className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="truncate text-xs font-extrabold">{name}</p><p className="mt-0.5 text-[11px] text-muted">{date} · {count} Zeilen</p></div><Badge variant={status === "Erfolgreich" ? "default" : "warning"}>{status}</Badge></div>; }
