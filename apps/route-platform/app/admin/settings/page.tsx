"use client";

import { useEffect, useRef, useState } from "react";
import { DatabaseZap, Loader2, Map, Save, Settings2, ShieldCheck, SlidersHorizontal, Trash2 } from "lucide-react";
import { AdminContent, TopBar } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useDemoStore } from "@/lib/demo-store";
import type { PlanningSettings } from "@/lib/types";

export default function SettingsPage() {
  const { state, hydrate, updateSettings, notify } = useDemoStore();
  const settings = state.settings;
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  async function persistSettings(next: PlanningSettings) {
    setSaveState("saving");
    try {
      const response = await fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify(next) });
      if (!response.ok) throw new Error((await response.json().catch(() => ({})) as { error?: string }).error || "Speichern fehlgeschlagen");
      setSaveState("saved");
    } catch (error) {
      setSaveState("error");
      notify("Einstellungen nicht gespeichert", error instanceof Error ? error.message : "Bitte erneut versuchen.", "warning");
    }
  }

  // Load persisted planning parameters once so a refresh shows the stored values
  // rather than the transient defaults.
  useEffect(() => { void fetch("/api/settings", { credentials: "same-origin", cache: "no-store" }).then(async (response) => response.ok ? response.json() as Promise<{ settings?: PlanningSettings }> : undefined).then((body) => { if (body?.settings) updateSettings(body.settings); }).catch(() => undefined); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const set = <K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) => {
    const next = { ...settings, [key]: value };
    updateSettings(next);
    setSaveState("saving");
    window.clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { void persistSettings(next); }, 600);
  };
  const [testBatch, setTestBatch] = useState<{ batchId: string; drivers: number; customers: number; workOrders: number }>();
  const [testDataSaving, setTestDataSaving] = useState(false);
  useEffect(() => { void fetch("/api/test-data", { credentials: "same-origin", cache: "no-store" }).then(async (response) => response.ok ? response.json() as Promise<{ batch?: typeof testBatch }> : undefined).then((body) => setTestBatch(body?.batch)).catch(() => undefined); }, []);
  async function createTestData() {
    setTestDataSaving(true);
    try {
      const response = await fetch("/api/test-data", { method: "POST", credentials: "same-origin" });
      const body = await response.json().catch(() => ({})) as { batch?: typeof testBatch; error?: string };
      if (!response.ok || !body.batch) throw new Error(body.error || "Testdaten konnten nicht angelegt werden.");
      setTestBatch(body.batch);
      const plans = await fetch("/api/plans", { credentials: "same-origin", cache: "no-store" });
      const snapshot = plans.ok ? await plans.json() as { state?: Parameters<typeof hydrate>[0] } : undefined;
      if (snapshot?.state) hydrate(snapshot.state);
      notify("Testdaten angelegt", "4 Testfahrer, 12 Kunden und 16 planbare Aufträge stehen jetzt in der Planung bereit.", "success");
    } catch (error) { notify("Testdaten nicht angelegt", error instanceof Error ? error.message : "Bitte erneut versuchen.", "warning"); } finally { setTestDataSaving(false); }
  }
  async function deleteTestData() {
    if (!window.confirm("Nur die eindeutig markierten Testdaten werden entfernt. Echte Daten bleiben erhalten.")) return;
    setTestDataSaving(true);
    try {
      const response = await fetch("/api/test-data", { method: "DELETE", credentials: "same-origin" });
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Testdaten konnten nicht entfernt werden.");
      setTestBatch(undefined);
      const plans = await fetch("/api/plans", { credentials: "same-origin", cache: "no-store" });
      const snapshot = plans.ok ? await plans.json() as { state?: Parameters<typeof hydrate>[0] } : undefined;
      if (snapshot?.state) hydrate(snapshot.state);
      notify("Testdaten entfernt", "Ausschließlich die erzeugten Testdaten wurden entfernt.", "success");
    } catch (error) { notify("Testdaten nicht entfernt", error instanceof Error ? error.message : "Bitte erneut versuchen.", "warning"); } finally { setTestDataSaving(false); }
  }

  return <>
    <TopBar eyebrow="System" title="Planungsparameter" description="Diese Werte gelten für neue Planungsläufe in der gesamten Organisation. Änderungen werden automatisch gespeichert." actions={<Button variant="outline" onClick={() => void persistSettings(settings)} disabled={saveState === "saving"}>{saveState === "saving" ? <><Loader2 className="h-4 w-4 animate-spin" />Speichere…</> : <><Save className="h-4 w-4" />{saveState === "error" ? "Erneut speichern" : saveState === "saved" ? "Gespeichert" : "Speichern"}</>}</Button>} />
    <AdminContent><div className="grid gap-5 xl:grid-cols-2">
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><SlidersHorizontal className="h-4 w-4 text-brand-600" />Routen & Kapazität</CardTitle></CardHeader><CardContent className="space-y-5">
        <label className="block text-xs font-extrabold text-muted">Maximale Stopps pro Fahrer und Tag<Input className="mt-1.5" type="number" min="1" max="20" value={settings.defaultMaxStops} onChange={(event) => set("defaultMaxStops", Math.max(1, Number(event.target.value) || 1))} /></label>
        <label className="block text-xs font-extrabold text-muted">Maximale Fahrzeit pro Fahrer (Minuten)<Input className="mt-1.5" type="number" min="15" max="720" value={settings.defaultMaxTravelMinutes} onChange={(event) => set("defaultMaxTravelMinutes", Math.max(15, Number(event.target.value) || 15))} /></label>
        <label className="block text-xs font-extrabold text-muted">Maximale Gesamtdauer pro Route (Minuten)<Input className="mt-1.5" type="number" min="60" max="960" value={settings.defaultMaxRouteMinutes} onChange={(event) => set("defaultMaxRouteMinutes", Math.max(60, Number(event.target.value) || 60))} /></label>
        <p className="rounded-xl bg-soft p-3 text-xs leading-5 text-muted">Individuelle Fahrergrenzen und Skills aus „Fahrer & Skills“ bleiben zusätzliche harte Grenzen.</p>
      </CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Map className="h-4 w-4 text-brand-600" />Live-Standort</CardTitle></CardHeader><CardContent className="space-y-5">
        <Switch checked={settings.gpsEnabled} onCheckedChange={(value) => set("gpsEnabled", value)} label="Standortübermittlung während aktiver Touren erlauben" />
        <label className="block text-xs font-extrabold text-muted">Aufbewahrung von Standortprotokollen (Tage)<Input className="mt-1.5" type="number" min="1" max="365" value={settings.locationRetentionDays} onChange={(event) => set("locationRetentionDays", Math.max(1, Number(event.target.value) || 1))} /></label>
        <div className="flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-blue-800"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />Der Fahrer entscheidet auf dem Gerät aktiv über die Standortfreigabe. Die Einstellung steuert nur, ob die Übertragung erlaubt ist.</div>
      </CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Settings2 className="h-4 w-4 text-brand-600" />Automationen</CardTitle></CardHeader><CardContent className="space-y-4"><Switch checked={settings.autoConfirm} onCheckedChange={(value) => set("autoConfirm", value)} label="Terminbestätigungen mit hoher Konfidenz automatisch übernehmen" /><p className="rounded-xl bg-soft p-3 text-xs leading-5 text-muted">Alle automatischen Änderungen erscheinen nachvollziehbar im Vorgangsprotokoll.</p></CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><DatabaseZap className="h-4 w-4 text-brand-600" />Testdaten</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm leading-6 text-muted">Erstellt ein vollständig planbares Testszenario ohne Logins, E-Mails oder Benachrichtigungen.</p>{testBatch ? <div className="rounded-xl border border-brand-100 bg-brand-50 p-3 text-xs font-bold text-brand-900">Aktiv: {testBatch.drivers} Testfahrer · {testBatch.customers} Kunden · {testBatch.workOrders} Aufträge</div> : <div className="rounded-xl bg-soft p-3 text-xs text-muted">Noch keine Testdaten in diesem Account.</div>}<div className="flex flex-wrap gap-2">{!testBatch ? <Button onClick={() => void createTestData()} disabled={testDataSaving}>{testDataSaving ? "Lege an…" : "Testdaten anlegen"}</Button> : <Button variant="danger" onClick={() => void deleteTestData()} disabled={testDataSaving}><Trash2 className="h-4 w-4" />{testDataSaving ? "Entferne…" : "Testdaten entfernen"}</Button>}</div></CardContent></Card>
    </div></AdminContent>
  </>;
}
