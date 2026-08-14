"use client";

import Link from "next/link";
import { ArrowRight, CalendarClock, CheckCircle2, Clock3, MapPinned, Plus, Sparkles, TriangleAlert, Truck, Users } from "lucide-react";
import { AdminContent, TopBar } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPreview } from "@/components/map-preview";
import { useDemoStore } from "@/lib/demo-store";
import { businessDate, calculateMetrics } from "@/lib/metrics";
import { formatDate, formatNumber, priorityColor, priorityLabel, statusLabel } from "@/lib/utils";

export default function AdminOverviewPage() {
  const { state, notify } = useDemoStore();
  const today = businessDate();
  const metrics = calculateMetrics(state, today);
  const todayOrders = state.workOrders.filter((item) => item.scheduledDate === today);
  const todayRoutes = state.routes.filter((route) => route.date === today);
  const activeWorkOrder = state.workOrders.find((item) => item.status === "en_route" || item.status === "on_site");
  return <>
    <TopBar eyebrow={formatDate(today, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} title="Übersicht" description="Aktueller Überblick über Planung, Fahrer und Wartungsbestand." actions={<><Button variant="outline" asChild><Link href="/admin/import"><Plus className="h-4 w-4" />Kunden importieren</Link></Button><Button onClick={() => notify("Planung bereit", "Der Planungsassistent verwendet die gespeicherten Standardparameter.")} asChild><Link href="/admin/planung"><Sparkles className="h-4 w-4" />Planung starten</Link></Button></>} />
    <AdminContent>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={CalendarClock} label="Heute geplant" value={String(metrics.todayOrders)} detail="Stops im Tagesplan" />
        <MetricCard icon={Truck} label="Aktive Fahrten" value={`${metrics.activeRoutes}/${metrics.activeDrivers}`} detail="Fahrer unterwegs" />
        <MetricCard icon={TriangleAlert} label="Überfällig" value={String(metrics.overdue)} detail="Wartungen ohne Termin" />
        <MetricCard icon={CheckCircle2} label="Planabdeckung" value={`${metrics.coveragePercent}%`} detail="Aufträge mit Termin" />
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(340px,.8fr)]">
        <Card className="overflow-hidden"><CardHeader className="flex-row items-start justify-between"><div><p className="text-[11px] font-black uppercase tracking-[.14em] text-brand-700">Live-Übersicht</p><CardTitle className="mt-1 text-xl">Fahrer im Einsatz</CardTitle><p className="mt-1 text-sm text-muted">Positionen werden nach einer Standortübermittlung automatisch aktualisiert.</p></div><Button variant="ghost" size="sm" asChild><Link href="/admin/live">Vollansicht <ArrowRight className="h-3.5 w-3.5" /></Link></Button></CardHeader><CardContent><MapPreview routes={todayRoutes} drivers={state.drivers} customers={state.customers} workOrders={state.workOrders} live className="min-h-[360px]" /></CardContent></Card>
        <div className="space-y-5"><Card className="border-0 bg-navy text-white shadow-float"><CardContent className="p-5"><Sparkles className="h-5 w-5 text-brand-500" /><h2 className="mt-5 text-lg font-extrabold">Nächster Schritt</h2><p className="mt-2 text-sm leading-6 text-slate-400">{metrics.overdue ? `${metrics.overdue} fällige Wartung${metrics.overdue === 1 ? "" : "en"} braucht eine Dispositionsentscheidung.` : "Keine überfälligen Wartungen. Plane den nächsten Zeitraum, wenn neue Aufträge vorliegen."}</p><Button className="mt-5 w-full bg-brand-500 hover:bg-brand-600" asChild><Link href="/admin/planung">Planung öffnen <ArrowRight className="h-4 w-4" /></Link></Button></CardContent></Card><Card><CardHeader className="flex-row items-center justify-between pb-3"><CardTitle>Offene Nachrichten</CardTitle><Link className="text-xs font-extrabold text-brand-700" href="/admin/inbox">Alle ansehen</Link></CardHeader><CardContent className="space-y-3">{state.inbox.filter((item) => item.actionStatus === "pending").slice(0, 3).map((item) => <div key={item.id}><p className="truncate text-xs font-extrabold">{item.subject}</p><p className="mt-0.5 truncate text-[11px] text-muted">{item.sender} · {Math.round(item.confidence * 100)}% erkannt</p></div>)}</CardContent></Card></div>
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,.85fr)]">
        <Card><CardHeader className="flex-row items-center justify-between"><div><CardTitle>Heutige Aufträge</CardTitle><p className="mt-1 text-sm text-muted">Nach Zeitfenster und Dringlichkeit.</p></div><Button size="sm" variant="outline" asChild><Link href="/admin/planung">Tagesplan öffnen <ArrowRight className="h-3.5 w-3.5" /></Link></Button></CardHeader><CardContent className="space-y-2">{todayOrders.length ? todayOrders.map((item, index) => { const customer = state.customers.find((entry) => entry.id === item.customerId); const driver = state.drivers.find((entry) => entry.id === item.assignedDriverId); return <div key={item.id} className="flex items-center gap-3 rounded-xl border border-line px-3 py-3"><span className="grid h-8 w-8 place-items-center rounded-full bg-ink text-xs font-black text-white">{index + 1}</span><div className="min-w-0 flex-1"><div className="flex gap-2"><p className="truncate text-sm font-extrabold">{customer?.name}</p><Badge variant={priorityColor(item.priority) as "danger" | "warning" | "blue" | "muted"}>{priorityLabel(item.priority)}</Badge></div><p className="mt-1 truncate text-xs text-muted">{item.title} · {item.timeFrom}–{item.timeTo}</p></div><p className="hidden text-xs font-bold sm:block">{driver?.name ?? statusLabel(item.status)}</p></div>; }) : <p className="py-8 text-center text-sm text-muted">Für heute sind keine Aufträge geplant.</p>}</CardContent></Card>
        <Card><CardHeader><CardTitle>Wirkung aus Betriebsdaten</CardTitle><p className="mt-1 text-sm text-muted">Keine geschätzten Vergleichswerte.</p></CardHeader><CardContent><div className="grid grid-cols-2 gap-3"><ImpactMetric label="Fahrzeit / Stopp" value={metrics.totalStops ? `${formatNumber(metrics.travelMinutesPerStop, 1)} min` : "–"} sub="gespeicherte Routen" icon={Clock3} /><ImpactMetric label="Gesamtstrecke" value={`${formatNumber(metrics.totalDistanceKm, 1)} km`} sub="gespeicherte Touren" icon={MapPinned} /><ImpactMetric label="Dokumentiert" value={`${metrics.digitalReportPercent}%`} sub="Serviceberichte" icon={CheckCircle2} /><ImpactMetric label="Erledigt" value={String(metrics.completed)} sub="Aufträge" icon={Users} /></div><Link href="/admin/kpis" className="mt-5 inline-block text-xs font-extrabold text-brand-700">Alle Kennzahlen und Datengrundlagen →</Link></CardContent></Card>
      </div>
      {activeWorkOrder && <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900"><span className="font-extrabold">Live-Hinweis:</span> Aktive Bearbeitung bei {state.customers.find((customer) => customer.id === activeWorkOrder.customerId)?.name ?? "einem Kunden"} · Status: {statusLabel(activeWorkOrder.status)}.</div>}
    </AdminContent>
  </>;
}

function MetricCard({ icon: Icon, label, value, detail }: { icon: typeof CalendarClock; label: string; value: string; detail: string }) { return <Card><CardContent className="p-5"><span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-700"><Icon className="h-4.5 w-4.5" /></span><p className="mt-4 text-[11px] font-black uppercase tracking-[.12em] text-muted">{label}</p><p className="mt-1 text-3xl font-extrabold tracking-[-.05em] text-ink">{value}</p><p className="mt-2 text-[11px] font-bold text-muted">{detail}</p></CardContent></Card>; }
function ImpactMetric({ icon: Icon, label, value, sub }: { icon: typeof Clock3; label: string; value: string; sub: string }) { return <div className="rounded-xl bg-soft p-3"><Icon className="h-4 w-4 text-brand-600" /><p className="mt-2 text-[11px] font-bold text-muted">{label}</p><p className="mt-0.5 text-lg font-black tracking-tight">{value}</p><p className="mt-0.5 text-[10px] font-extrabold text-brand-700">{sub}</p></div>; }
