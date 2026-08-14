"use client";

import { BarChart3, CheckCircle2, Gauge, MapPinned, Route as RouteIcon, Timer } from "lucide-react";
import { AdminContent, TopBar } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDemoStore } from "@/lib/demo-store";
import { businessDate, calculateMetrics } from "@/lib/metrics";
import { formatNumber } from "@/lib/utils";

function downloadCsv(rows: Array<[string, string, string]>) {
  const csv = ["Kennzahl;Wert;Datengrundlage", ...rows.map((row) => row.map((cell) => `\"${cell.replace(/\"/g, '\"\"')}\"`).join(";"))].join("\n");
  const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `automatex-kpi-bericht-${businessDate()}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function KpisPage() {
  const { state } = useDemoStore();
  const metrics = calculateMetrics(state, businessDate());
  const rows: Array<[string, string, string]> = [
    ["Heute geplante Stopps", String(metrics.todayOrders), "Aufträge mit heutigem Termin"],
    ["Abgeschlossene Aufträge", String(metrics.completed), "Status erledigt"],
    ["Fahrzeit je Stopp", metrics.totalStops ? `${formatNumber(metrics.travelMinutesPerStop, 1)} min` : "–", "Routen mit Stopps"],
    ["Kapazitätsauslastung heute", `${metrics.capacityPercent}%`, "Geplante Stopps / aktive Tageskapazität"],
    ["Planabdeckung", `${metrics.coveragePercent}%`, "Nicht abgesagte Aufträge mit Termin"],
    ["Digitale Serviceberichte", `${metrics.digitalReportPercent}%`, "Berichte / abgeschlossene Aufträge"],
    ["Gesamtstrecke", `${formatNumber(metrics.totalDistanceKm, 1)} km`, "Alle gespeicherten Routen"],
  ];
  return <>
    <TopBar eyebrow="Wirkungsmessung" title="KPIs & Wirkung" description="Ausschließlich aus gespeicherten Aufträgen, Touren und Serviceberichten berechnet." actions={<Button variant="outline" onClick={() => downloadCsv(rows)}><BarChart3 className="h-4 w-4" />Bericht exportieren</Button>} />
    <AdminContent>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={RouteIcon} label="Heute geplant" value={String(metrics.todayOrders)} detail="Aufträge mit heutigem Termin" />
        <KpiCard icon={MapPinned} label="Fahrzeit / Stopp" value={metrics.totalStops ? `${formatNumber(metrics.travelMinutesPerStop, 1)} min` : "–"} detail="Aus gespeicherten Routenzeiten" />
        <KpiCard icon={Gauge} label="Kapazität heute" value={`${metrics.capacityPercent}%`} detail="Geplante gegen verfügbare Stopps" />
        <KpiCard icon={CheckCircle2} label="Digital dokumentiert" value={`${metrics.digitalReportPercent}%`} detail="Serviceberichte je erledigtem Auftrag" />
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,.8fr)]">
        <Card><CardHeader className="flex-row items-center justify-between"><div><CardTitle>Datengrundlage</CardTitle><p className="mt-1 text-sm text-muted">Jede Kennzahl zeigt ihre Berechnung transparent an.</p></div><Badge variant="blue">Live aus Betriebsdaten</Badge></CardHeader><CardContent className="divide-y divide-line">{rows.map(([label, value, source]) => <div key={label} className="flex items-center gap-4 py-4"><span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-700"><Timer className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="text-sm font-extrabold">{label}</p><p className="mt-0.5 text-xs text-muted">{source}</p></div><span className="text-lg font-black">{value}</span></div>)}</CardContent></Card>
        <Card><CardHeader><CardTitle>Qualitätshinweis</CardTitle></CardHeader><CardContent className="space-y-3 text-sm leading-6 text-muted"><p>„Pünktliche Ankunft“ und eingesparte Dispositionszeit werden erst ausgewiesen, sobald historische Plan- und tatsächliche Ankunftszeitpunkte vorhanden sind. Die App rät diese Werte nicht.</p><p>Standort-, Status- und Routenänderungen sind im <a className="font-extrabold text-brand-700" href="/admin/vorgaenge">Vorgangsprotokoll</a> nachvollziehbar.</p></CardContent></Card>
      </div>
    </AdminContent>
  </>;
}

function KpiCard({ icon: Icon, label, value, detail }: { icon: typeof Timer; label: string; value: string; detail: string }) {
  return <Card><CardContent className="p-5"><span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-700"><Icon className="h-4.5 w-4.5" /></span><p className="mt-4 text-[11px] font-black uppercase tracking-[.12em] text-muted">{label}</p><p className="mt-1 text-2xl font-black tracking-tight">{value}</p><p className="mt-1 text-[11px] font-bold text-muted">{detail}</p></CardContent></Card>;
}
