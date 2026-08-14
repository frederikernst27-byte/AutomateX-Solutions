"use client";

import { use, useEffect, useMemo, useState } from "react";
import { CalendarCheck, Check, ChevronRight, Clock3, FileText, Lock, MapPin, Navigation, RefreshCw, ShieldCheck, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatLongDate } from "@/lib/utils";
import type { Customer, Route, WorkOrder } from "@/lib/types";

interface PortalPayload {
  accepted?: boolean;
  order: Omit<WorkOrder, "portalToken">;
  customer: Customer;
  route: (Omit<Route, "driverId"> & { driverId?: never }) | null;
  report?: { summary: string; findings: string[]; urgency: string; confirmed: boolean } | null;
}

export default function CustomerPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [payload, setPayload] = useState<PortalPayload>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedAlternative, setSelectedAlternative] = useState<string>();
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string>();

  async function load() {
    setLoading(true);
    try {
      const response = await fetch(`/api/portal/${encodeURIComponent(token)}`, { cache: "no-store" });
      if (!response.ok) throw new Error("not-found");
      setPayload(await response.json() as PortalPayload);
      setError(false);
    } catch { setError(true); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, [token]);

  const alternatives = useMemo(() => [
    { date: "2026-07-20", window: "09:00–10:00", driver: "Route-kompatibel" },
    { date: "2026-07-21", window: "13:30–14:30", driver: "Route-kompatibel" },
    { date: "2026-07-22", window: "08:30–09:30", driver: "Route-kompatibel" },
  ], []);

  async function choose(action: "confirm" | "cancel" | "alternative") {
    if (!payload || actionBusy) return;
    const date = action === "alternative" ? selectedAlternative : payload.order.scheduledDate;
    if (action === "alternative" && !date) return;
    setActionBusy(true);
    setActionError(undefined);
    try {
      const response = await fetch(`/api/portal/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": `portal-${action}-${date ?? "none"}-${Date.now()}` },
        body: JSON.stringify({ action, ...(date ? { date } : {}) }),
      });
      const body = await response.json().catch(() => ({})) as PortalPayload & { error?: string };
      if (!response.ok) throw new Error(body.error || "Aktion konnte nicht verarbeitet werden");
      setPayload(body);
      setShowAlternatives(false);
      setSelectedAlternative(undefined);
    } catch (caught) { setActionError(caught instanceof Error ? caught.message : "Aktion konnte nicht verarbeitet werden"); }
    finally { setActionBusy(false); }
  }

  if (loading) return <PortalFrame><div className="rounded-2xl bg-white p-8 text-center shadow-xl"><RefreshCw className="mx-auto h-6 w-6 animate-spin text-brand-600" /><p className="mt-3 text-sm font-bold text-muted">Termin wird geladen…</p></div></PortalFrame>;
  if (error || !payload?.order || !payload.customer) return <PortalFrame><div className="rounded-2xl bg-white p-8 text-center shadow-xl"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-rose-50 text-rose-600"><X className="h-5 w-5" /></span><h1 className="mt-5 text-xl font-extrabold">Link nicht verfügbar</h1><p className="mt-2 text-sm leading-6 text-muted">Der Terminlink ist abgelaufen, wurde widerrufen oder bereits ersetzt. Bitte wende dich direkt an den Service.</p></div></PortalFrame>;

  const { order, customer, route, report } = payload;
  const status = order.status;
  const isConfirmed = ["confirmed", "planned", "en_route", "on_site", "completed"].includes(status);
  const isCancelled = status === "cancelled";
  const canRespond = !isConfirmed && !isCancelled;

  return <PortalFrame>
    <div className="mb-4 flex items-center gap-2 text-xs font-bold text-slate-500"><span className="grid h-8 w-8 place-items-center rounded-xl bg-brand-500 text-white"><Navigation className="h-4 w-4 rotate-45 fill-white" /></span><span>Automate<span className="text-brand-600">X</span> Route</span><span className="ml-auto flex items-center gap-1 text-[10px] font-extrabold"><Lock className="h-3 w-3" />Sicherer Link</span></div>
    <div className="overflow-hidden rounded-3xl bg-white shadow-float">
      <div className="bg-navy px-6 pb-7 pt-6 text-white"><p className="text-[10px] font-black uppercase tracking-[.16em] text-brand-300">Termin-Portal</p><h1 className="mt-3 text-2xl font-extrabold tracking-tight">Hallo {customer.contact.split(" ")[0]}.</h1><p className="mt-2 text-sm leading-6 text-slate-400">Hier kannst du deinen Wartungstermin sicher bestätigen oder einen passenden Alternativtermin anfragen.</p></div>
      <div className="p-6">
        <div className="flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><CalendarCheck className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="text-sm font-extrabold">{order.title}</p><p className="mt-1 text-xs text-muted">{customer.asset} · {customer.site}</p></div><Badge variant={isConfirmed ? "default" : isCancelled ? "danger" : "warning"}>{isConfirmed ? "Bestätigt" : isCancelled ? "Abgesagt" : "Antwort ausstehend"}</Badge></div>
        <div className="mt-5 rounded-2xl bg-soft p-4"><div className="flex items-start gap-3"><MapPin className="mt-0.5 h-4 w-4 text-brand-600" /><div><p className="text-xs font-extrabold">{customer.address}</p><p className="mt-1 text-[11px] text-muted">{customer.notes ?? "Bitte Zugang zum Technikraum ermöglichen."}</p></div></div><div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-3"><div><p className="text-[10px] font-black uppercase tracking-[.1em] text-muted">Termin</p><p className="mt-1 text-sm font-extrabold">{order.scheduledDate ? formatDate(order.scheduledDate, { weekday: "short", day: "numeric", month: "short" }) : "Termin offen"}</p></div><div><p className="text-[10px] font-black uppercase tracking-[.1em] text-muted">Zeitfenster</p><p className="mt-1 flex items-center gap-1 text-sm font-extrabold"><Clock3 className="h-3.5 w-3.5 text-brand-600" />{order.timeFrom}–{order.timeTo}</p></div></div></div>
        {status === "en_route" && route && <div className="mt-4 rounded-2xl border border-brand-100 bg-brand-50 p-4"><div className="flex items-center gap-2 text-sm font-extrabold text-brand-900"><span className="h-2 w-2 animate-pulse rounded-full bg-brand-500" />Techniker ist unterwegs</div><p className="mt-1 text-xs leading-5 text-brand-800/70">Die aktualisierte Ankunftszeit wird nur während der aktiven Tour angezeigt.</p><div className="mt-3 h-2 overflow-hidden rounded-full bg-brand-100"><div className="h-full w-[64%] rounded-full bg-brand-500" /></div></div>}
        {canRespond && <><div className="mt-6"><p className="text-sm font-extrabold">Passt der vorgeschlagene Termin?</p><div className="mt-3 grid gap-2"><button onClick={() => { setSelectedAlternative(undefined); setShowAlternatives(false); }} className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${!showAlternatives ? "border-brand-300 bg-brand-50" : "border-line"}`}><span className={`grid h-5 w-5 place-items-center rounded-full border ${!showAlternatives ? "border-brand-500 bg-brand-500 text-white" : "border-slate-300"}`}>{!showAlternatives && <Check className="h-3 w-3" />}</span><span><span className="block text-xs font-extrabold">Ja, der Termin passt</span><span className="mt-0.5 block text-[11px] text-muted">{order.scheduledDate ? formatLongDate(order.scheduledDate) : "Der vorgeschlagene Termin"} · {order.timeFrom}–{order.timeTo}</span></span></button><button onClick={() => { setShowAlternatives(true); setSelectedAlternative(undefined); }} className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${showAlternatives ? "border-brand-300 bg-brand-50" : "border-line"}`}><span className={`grid h-5 w-5 place-items-center rounded-full border ${showAlternatives ? "border-brand-500 bg-brand-500 text-white" : "border-slate-300"}`}>{showAlternatives && <Check className="h-3 w-3" />}</span><span><span className="block text-xs font-extrabold">Anderen Termin wählen</span><span className="mt-0.5 block text-[11px] text-muted">Drei route-kompatible Vorschläge anzeigen</span></span><ChevronRight className="ml-auto h-4 w-4 text-slate-300" /></button></div></div>{showAlternatives && <div className="mt-3 space-y-2">{alternatives.map((alternative) => <button key={alternative.date} onClick={() => setSelectedAlternative(alternative.date)} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left ${selectedAlternative === alternative.date ? "border-brand-300 bg-brand-50" : "border-line"}`}><span className="grid h-8 w-8 place-items-center rounded-lg bg-white text-brand-700"><CalendarCheck className="h-4 w-4" /></span><span className="flex-1"><span className="block text-xs font-extrabold">{formatDate(alternative.date, { weekday: "long", day: "numeric", month: "long" })}</span><span className="mt-0.5 block text-[11px] text-muted">{alternative.window} · {alternative.driver}</span></span>{selectedAlternative === alternative.date && <Check className="h-4 w-4 text-brand-600" />}</button>)}</div>}<div className="mt-5 grid gap-2 sm:grid-cols-2"><Button onClick={() => void choose(selectedAlternative ? "alternative" : "confirm")} disabled={actionBusy || (showAlternatives && !selectedAlternative)} className="h-11">{actionBusy ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}{selectedAlternative ? "Termin auswählen" : "Termin bestätigen"}</Button><Button variant="outline" onClick={() => void choose("cancel")} disabled={actionBusy} className="h-11 text-rose-700 hover:border-rose-200 hover:bg-rose-50">Termin absagen</Button></div>{actionError && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-2 text-xs font-bold text-rose-700">{actionError}</p>}</>}
        {isCancelled && <div className="mt-6 rounded-xl border border-orange-100 bg-orange-50 p-4 text-sm leading-6 text-orange-900">Der Termin wurde abgesagt. Die Disposition meldet sich, sobald ein neuer Vorschlag verfügbar ist.</div>}
        {isConfirmed && <div className="mt-6 rounded-xl border border-brand-100 bg-brand-50 p-4 text-sm leading-6 text-brand-900"><p className="font-extrabold">Danke! Der Termin ist bestätigt.</p><p className="mt-1">Du erhältst automatisch eine Nachricht, sobald der Techniker unterwegs ist.</p></div>}
        {report && <div className="mt-5 flex items-start gap-3 rounded-xl border border-line p-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-700"><FileText className="h-4 w-4" /></span><div className="flex-1"><p className="text-xs font-extrabold">Wartungsbericht verfügbar</p><p className="mt-0.5 text-[11px] text-muted">{report.summary}</p><button onClick={() => window.print()} className="mt-2 text-[11px] font-extrabold text-brand-700">Bericht drucken / als PDF speichern</button></div></div>}
        <div className="mt-6 flex items-center gap-2 border-t border-line pt-4 text-[10px] leading-4 text-muted"><ShieldCheck className="h-4 w-4 shrink-0 text-brand-600" />Deine Daten werden nur für diesen Termin verarbeitet. Bei Fragen: {customer.phone}</div>
      </div>
    </div>
  </PortalFrame>;
}

function PortalFrame({ children }: { children: React.ReactNode }) { return <main className="min-h-screen bg-[#f1f5f3] px-4 py-6 sm:py-12"><div className="mx-auto max-w-[500px]">{children}<p className="mt-5 text-center text-[10px] font-bold text-slate-400">AutomateX Route · Sichere Terminverwaltung für Service-Teams</p></div></main>; }
