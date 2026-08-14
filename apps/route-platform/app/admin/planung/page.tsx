"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  ChevronDown,
  GripVertical,
  Lock,
  Mic,
  MicOff,
  Plus,
  RefreshCw,
  Send,
  Settings2,
  Sparkles,
  Table2,
  Unlock,
  WandSparkles,
} from "lucide-react";
import { AdminContent, TopBar } from "@/components/admin-shell";
import { RouteMapWorkspace } from "@/components/route-map-workspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useDemoStore } from "@/lib/demo-store";
import { defaultConstraints } from "@/lib/planner";
import { commandToConstraints, parsePlanningCommand } from "@/lib/ai";
import { addDays, dateRange, formatDate, formatNumber, statusLabel } from "@/lib/utils";
import type { DemoState, PlanningConstraints, PlanningResult, Route } from "@/lib/types";

type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: new () => BrowserSpeechRecognition;
  webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
};

export default function PlanningPage() {
  const { state, hydrate, updateWorkOrder, notify } = useDemoStore();
  const [constraints, setConstraints] = useState<PlanningConstraints>(() =>
    ({ ...defaultConstraints(state.drivers), ...state.settings }),
  );
  const [command, setCommand] = useState(
    "Plane die nächsten 2 Wochen mit maximal 4 Stopps pro Fahrer und maximal 3 Stunden Fahrzeit",
  );
  const [copilotPreview, setCopilotPreview] = useState<PlanningConstraints>();
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotRationale, setCopilotRationale] = useState<string>();
  const [copilotJson, setCopilotJson] = useState<string>();
  const [listening, setListening] = useState(false);
  const [result, setResult] = useState(state.planningRuns[0]);
  const [planRunId, setPlanRunId] = useState<string | undefined>(state.planningRuns[0]?.runId);
  const [running, setRunning] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [activeTab, setActiveTab] = useState<"board" | "routes">("board");
  const [draggedStop, setDraggedStop] = useState<{
    workOrderId: string;
    routeId?: string;
  } | null>(null);
  const [manualDate, setManualDate] = useState(constraints.from);
  const [manualDriverId, setManualDriverId] = useState(state.drivers.find((driver) => driver.active)?.id ?? "");
  const [manualOrderId, setManualOrderId] = useState("");
  const [draftSaving, setDraftSaving] = useState(false);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const dictationBaseRef = useRef("");
  const dictationFinalRef = useRef("");

  useEffect(() => () => recognitionRef.current?.abort(), []);

  useEffect(() => {
    let active = true;
    void fetch("/api/plans", { credentials: "same-origin", cache: "no-store" }).then(async (response) => {
      if (!response.ok) return;
      const body = await response.json() as { constraints?: PlanningConstraints; runs?: PlanningResult[]; state?: Pick<DemoState, "drivers" | "customers" | "workOrders" | "routes"> };
      if (!active) return;
      if (body.state) hydrate(body.state);
      if (body.constraints) setConstraints((current) => ({ ...body.constraints!, driverAvailability: body.constraints!.driverAvailability ?? {}, ...state.settings, from: current.from, to: current.to }));
      if (body.runs?.[0]) { setResult(body.runs[0]); setPlanRunId(body.runs[0].runId); }
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const planningDays = Math.round(
    (new Date(`${constraints.to}T12:00:00`).getTime() -
      new Date(`${constraints.from}T12:00:00`).getTime()) /
      86400000,
  );
  const dateError =
    !/^\d{4}-\d{2}-\d{2}$/.test(constraints.from) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(constraints.to) ||
    planningDays < 0 ||
    planningDays > 90;
  const planningDates = useMemo(
    () => dateError ? [] : dateRange(constraints.from, constraints.to),
    [constraints.from, constraints.to, dateError],
  );
  const planningWorkDays = planningDates.filter((date) => ![0, 6].includes(new Date(`${date}T12:00:00`).getDay()));
  const activeDrivers = state.drivers.filter((driver) => driver.active);
  const plannableOrders = state.workOrders.filter((order) => !["completed", "cancelled"].includes(order.status));
  const driversForDay = (date: string) => constraints.driverAvailability?.[date] ?? constraints.driverIds;
  const isDriverAvailable = (date: string, driverId: string) => driversForDay(date).includes(driverId);
  const staffedDays = planningWorkDays.filter((date) => activeDrivers.some((driver) => isDriverAvailable(date, driver.id) && !driver.daysOff.includes(date)));
  const canPlan = activeDrivers.length > 0 && plannableOrders.length > 0 && staffedDays.length > 0;
  const manualOrders = state.workOrders.filter((order) => !["completed", "cancelled"].includes(order.status));

  async function previewCopilot() {
    if (!command.trim()) { notify("Anweisung fehlt", "Beschreibe zuerst, was die KI bei der Planung beachten soll.", "warning"); return; }
    // The typed instruction is part of the input contract, not a decorative
    // note. Apply deterministic values such as "maximal 3 Stopps" before the
    // snapshot is sent to the model, so the server validates against them too.
    const nextConstraints = commandToConstraints(parsePlanningCommand(command), constraints);
    setConstraints(nextConstraints);
    if (nextConstraints.from <= nextConstraints.to) setManualDate((current) => current < nextConstraints.from || current > nextConstraints.to ? nextConstraints.from : current);
    setCopilotLoading(true);
    try {
      const response = await fetch("/api/ai/plan-preview", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ command, constraints: nextConstraints }) });
      const body = await response.json().catch(() => ({})) as { error?: string; result?: PlanningResult; aiOutput?: { rationale?: string } };
      if (!response.ok || !body.result) throw new Error(body.error || "Die KI konnte keine gültige Vorschau erstellen.");
      // A short, visible processing state makes the proposed JSON plan feel
      // deliberate rather than an instantaneous, unexplained board change.
      await new Promise((resolve) => window.setTimeout(resolve, 450));
      setResult(body.result); setPlanRunId(undefined); hydrate({ routes: body.result.routes });
      setCopilotPreview(body.result.constraints); setCopilotRationale(body.aiOutput?.rationale); setCopilotJson(body.aiOutput ? JSON.stringify(body.aiOutput, null, 2) : undefined);
      notify("KI-Vorschau bereit", `${body.result.summary.assigned} Aufträge wurden als Entwurf auf ${body.result.routes.length} Touren verteilt.`, "success");
    } catch (error) {
      notify("KI-Vorschau nicht erstellt", error instanceof Error ? error.message : "Bitte erneut versuchen.", "warning");
    } finally { setCopilotLoading(false); }
  }

  function toggleDictation() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const SpeechRecognition = (window as SpeechRecognitionWindow).SpeechRecognition ?? (window as SpeechRecognitionWindow).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      notify("Diktieren nicht verfügbar", "Dein Browser unterstützt die Live-Transkription nicht. Bitte Chrome oder Safari verwenden.", "warning");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "de-DE";
    recognition.continuous = true;
    recognition.interimResults = true;
    dictationBaseRef.current = command.trimEnd();
    dictationFinalRef.current = "";
    recognition.onresult = (event) => {
      let interim = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const transcript = event.results[index][0]?.transcript.trim() ?? "";
        if (!transcript) continue;
        if (event.results[index].isFinal) dictationFinalRef.current = `${dictationFinalRef.current} ${transcript}`.trim();
        else interim = `${interim} ${transcript}`.trim();
      }
      setCommand([dictationBaseRef.current, dictationFinalRef.current, interim].filter(Boolean).join(" "));
    };
    recognition.onerror = (event) => {
      if (event.error !== "aborted" && event.error !== "no-speech") notify("Diktieren beendet", "Der Browser konnte die Spracheingabe nicht verarbeiten. Prüfe bitte die Mikrofonfreigabe.", "warning");
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
      setCommand([dictationBaseRef.current, dictationFinalRef.current].filter(Boolean).join(" "));
    };
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }
  function applyCopilot() {
    const next = copilotPreview;
    if (!next) return;
    setConstraints(next);
    if (next.from <= next.to && (next.from !== constraints.from || next.to !== constraints.to)) setManualDate(next.from);
    setCopilotPreview(undefined);
    notify("Copilot angewendet", "Die bestätigten Regeln wurden übernommen. Du kannst sie weiterhin manuell anpassen.", "success");
  }
  function toggleDriverForDay(date: string, driverId: string) {
    setConstraints((current) => {
      const currentIds = current.driverAvailability?.[date] ?? current.driverIds;
      const nextIds = currentIds.includes(driverId) ? currentIds.filter((id) => id !== driverId) : [...currentIds, driverId];
      return { ...current, driverAvailability: { ...(current.driverAvailability ?? {}), [date]: nextIds } };
    });
  }

  const runPlanning = () => {
    if (dateError) {
      notify(
        "Zeitraum prüfen",
        "Ein Planungslauf darf höchstens 90 Tage umfassen und muss ein gültiges Enddatum haben.",
        "warning",
      );
      return;
    }
    if (!canPlan) {
      const missing = [
        !activeDrivers.length && "mindestens ein aktiver Fahrer",
        !plannableOrders.length && "mindestens ein echter Planungsauftrag",
        !staffedDays.length && "mindestens ein Fahrer in der Tagesbesetzung",
      ].filter(Boolean).join(", ");
      notify(
        "Planung noch nicht möglich",
        `Bitte zuerst ${missing} anlegen bzw. auswählen.`,
        "warning",
      );
      return;
    }
    setRunning(true);
    void (async () => {
      try {
        const response = await fetch("/api/plans", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": `plan-ui-${Date.now()}`,
          },
          credentials: "same-origin",
          body: JSON.stringify(constraints),
        });
        const body = await response.json().catch(() => ({})) as { error?: string } & Partial<PlanningResult>;
        if (!response.ok || !body.runId || !body.routes || !body.summary) throw new Error(body.error || "Die Routen konnten nicht berechnet werden.");
        const planningResult = body as PlanningResult;
        setPlanRunId(planningResult.runId);
        setResult(planningResult);
        hydrate({ routes: planningResult.routes.map((route: Route) => ({ ...route, status: "draft" })) });
        if (planningResult.summary.assigned === 0 && planningResult.unassigned.length > 0) {
          const reason = planningResult.unassigned[0]?.reason ?? "Keine zulässige Zuordnung gefunden.";
          notify("Keine Route zugewiesen", `${planningResult.unassigned.length} Aufträge sind offen: ${reason}`, "warning");
        } else {
          const solver = planningResult.mode === "vroom" ? "mit Straßenzeiten optimiert" : "mit dem lokalen Optimierer berechnet";
          notify("Routen berechnet", `${planningResult.summary.assigned} Aufträge wurden auf ${planningResult.routes.length} Touren verteilt (${solver}).`, "success");
        }
      } catch (error) {
        notify("Routenoptimierung fehlgeschlagen", error instanceof Error ? error.message : "VROOM ist nicht erreichbar.", "warning");
      } finally {
        setRunning(false);
      }
    })();
  };

  async function publishPlan() {
    if (!result || publishing) return;
    setPublishing(true);
    try {
      if (planRunId) {
        const response = await fetch(
          `/api/plans/${encodeURIComponent(planRunId)}/publish`,
          {
            method: "POST",
            headers: { "Idempotency-Key": `publish-ui-${planRunId}` },
            credentials: "same-origin",
          },
        );
        if (!response.ok)
          throw new Error("Plan konnte nicht veröffentlicht werden");
      }
      const published = routes.map((route) => ({
        ...route,
        status: "published" as const,
      }));
      hydrate({ routes: published });
      const snapshot = await fetch("/api/state", { credentials: "same-origin", cache: "no-store" });
      const stateBody = snapshot.ok ? await snapshot.json() as { state?: Partial<DemoState> } : undefined;
      if (stateBody?.state) hydrate(stateBody.state);
      notify(
        "Plan veröffentlicht",
        "Die Touren sind jetzt für die jeweils zugewiesenen Fahrer sichtbar.",
        "success",
      );
    } catch (error) {
      notify(
        "Veröffentlichung fehlgeschlagen",
        error instanceof Error ? error.message : "Bitte erneut versuchen.",
        "warning",
      );
    } finally {
      setPublishing(false);
    }
  }

  const routes =
    result?.routes ??
    state.routes.filter(
      (route) => route.date >= constraints.from && route.date <= constraints.to,
    );
  const dateColumns = planningWorkDays;
  const getDriver = (id: string) =>
    state.drivers.find((driver) => driver.id === id);
  const getOrder = (id: string) =>
    state.workOrders.find((order) => order.id === id);
  const getCustomer = (orderId: string) => {
    const order = getOrder(orderId);
    return state.customers.find(
      (customer) => customer.id === order?.customerId,
    );
  };

  async function ensureManualDraft() {
    if (planRunId && result) return { id: planRunId, draft: result };
    const response = await fetch("/api/plans/manual", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify(constraints) });
    const body = await response.json().catch(() => ({})) as { error?: string } & Partial<PlanningResult>;
    if (!response.ok || !body.runId) throw new Error(body.error || "Manueller Entwurf konnte nicht angelegt werden.");
    const draft = body as PlanningResult;
    setPlanRunId(draft.runId);
    setResult(draft);
    return { id: draft.runId, draft };
  }

  async function persistDraft(nextRoutes: Route[], successTitle: string, successMessage: string) {
    if (draftSaving) return;
    setDraftSaving(true);
    try {
      const { id, draft } = await ensureManualDraft();
      const response = await fetch(`/api/plans/${encodeURIComponent(id)}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "same-origin",
        body: JSON.stringify({ revision: draft.revision ?? 1, routes: nextRoutes.map((route) => ({ id: route.id, date: route.date, driverId: route.driverId, stops: route.stops.map((stop) => ({ workOrderId: stop.workOrderId })) })) }),
      });
      const body = await response.json().catch(() => ({})) as { error?: string; result?: PlanningResult } & Partial<PlanningResult>;
      if (response.status === 409 && body.result) {
        setResult(body.result); setPlanRunId(body.result.runId); hydrate({ routes: body.result.routes });
        throw new Error("Der Entwurf wurde parallel geändert und neu geladen. Bitte deine Änderung erneut ausführen.");
      }
      if (!response.ok || !body.runId || !body.routes) throw new Error(body.error || "Entwurf konnte nicht gespeichert werden.");
      const saved = body as PlanningResult;
      setResult(saved); setPlanRunId(saved.runId); hydrate({ routes: saved.routes });
      notify(successTitle, successMessage, "success");
    } catch (error) {
      notify("Entwurf nicht gespeichert", error instanceof Error ? error.message : "Bitte erneut versuchen.", "warning");
    } finally {
      setDraftSaving(false);
    }
  }

  async function toggleLock(workOrderId: string) {
    const order = getOrder(workOrderId);
    if (!order) return;
    const nextLocked = !order.locked;
    // Optimistic echo; the 10s state poll reconciles if the write is rejected.
    updateWorkOrder(workOrderId, { locked: nextLocked });
    notify(
      order.locked ? "Stop entsperrt" : "Stop gesperrt",
      order.locked
        ? "Die KI darf ihn wieder verschieben."
        : "Dieser Stop bleibt bei der Neuoptimierung an seinem Platz.",
      "info",
    );
    try {
      const response = await fetch("/api/work-orders", { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ id: workOrderId, locked: nextLocked }) });
      // 409 is the expected demo-adapter response; the /api/state persist path
      // handles that mode, so only a real failure needs surfacing.
      if (!response.ok && response.status !== 409) throw new Error();
    } catch {
      notify("Sperrung nicht gespeichert", "Die Änderung konnte nicht dauerhaft gespeichert werden.", "warning");
    }
  }
  async function dropOnRoute(targetRoute: Route) {
    if (!draggedStop || draggedStop.routeId === targetRoute.id || targetRoute.stops.some((stop) => stop.workOrderId === draggedStop.workOrderId)) return;
    const sourceRoute = draggedStop.routeId ? routes.find(
      (route) => route.id === draggedStop.routeId,
    ) : undefined;
    const movedStop = sourceRoute?.stops.find(
      (stop) => stop.workOrderId === draggedStop.workOrderId,
    ) ?? {
      workOrderId: draggedStop.workOrderId,
      order: targetRoute.stops.length + 1,
      eta: "",
      distanceFromPreviousKm: 0,
      driveMinutesFromPrevious: 0,
      explanation: "Manuell durch Disposition eingeplant",
    };
    const nextRoutes = routes.map((route) => {
      if (route.id === sourceRoute?.id)
        return {
          ...route,
          stops: route.stops
            .filter((stop) => stop.workOrderId !== draggedStop.workOrderId)
            .map((stop, index) => ({ ...stop, order: index + 1 })),
        };
      if (route.id === targetRoute.id)
        return {
          ...route,
          stops: [
            ...route.stops,
            {
              ...movedStop,
              order: route.stops.length + 1,
              explanation: "Manuell durch Disposition verschoben",
            },
          ],
        };
      return route;
    });
    await persistDraft(nextRoutes, "Stop verschoben", `${getCustomer(draggedStop.workOrderId)?.name ?? "Stop"} wurde manuell umgeplant und gespeichert.`);
    setDraggedStop(null);
  }

  async function addManualRoute() {
    const order = getOrder(manualOrderId);
    const driver = getDriver(manualDriverId);
    if (!order || !driver || !/^\d{4}-\d{2}-\d{2}$/.test(manualDate)) {
      notify("Route ergänzen", "Bitte Datum, Fahrer und einen offenen Auftrag auswählen.", "warning");
      return;
    }
    if (["completed", "cancelled"].includes(order.status)) {
      notify("Auftrag nicht planbar", "Abgeschlossene oder abgesagte Aufträge können nicht hinzugefügt werden.", "warning");
      return;
    }
    const targetRoute = routes.find((route) => route.driverId === driver.id && route.date === manualDate);
    const sourceRoute = routes.find((route) => route.stops.some((stop) => stop.workOrderId === order.id));
    const manualStop = { workOrderId: order.id, order: targetRoute?.stops.length ? targetRoute.stops.length + 1 : 1, eta: order.timeFrom, distanceFromPreviousKm: 0, driveMinutesFromPrevious: 0, explanation: "Manuell durch Disposition hinzugefügt" };
    const nextRoute: Route = targetRoute ?? { id: `manual-${Date.now()}`, date: manualDate, driverId: driver.id, status: "draft", distanceKm: 0, travelMinutes: 0, serviceMinutes: 0, stops: [] };
    const nextRoutes = routes
      .filter((route) => route.id !== sourceRoute?.id && route.id !== targetRoute?.id)
      .concat(sourceRoute && sourceRoute.id !== targetRoute?.id ? [{ ...sourceRoute, stops: sourceRoute.stops.filter((stop) => stop.workOrderId !== order.id).map((stop, index) => ({ ...stop, order: index + 1 })) }] : [])
      .concat({ ...nextRoute, serviceMinutes: nextRoute.serviceMinutes + order.durationMinutes, stops: [...nextRoute.stops.filter((stop) => stop.workOrderId !== order.id), manualStop] });
    await persistDraft(nextRoutes, "Manuelle Route gespeichert", `${getCustomer(order.id)?.name ?? "Auftrag"} wurde als Entwurf ergänzt.`);
    setManualOrderId("");
  }

  async function removeStop(routeId: string, workOrderId: string) {
    const nextRoutes = routes.map((route) => route.id === routeId ? { ...route, stops: route.stops.filter((stop) => stop.workOrderId !== workOrderId).map((stop, index) => ({ ...stop, order: index + 1 })) } : route);
    await persistDraft(nextRoutes, "Stop entfernt", `${getCustomer(workOrderId)?.name ?? "Auftrag"} ist wieder offen und wurde gespeichert.`);
  }

  async function moveStop(routeId: string, workOrderId: string, offset: -1 | 1) {
    const nextRoutes = routes.map((route) => {
      if (route.id !== routeId) return route;
      const index = route.stops.findIndex((stop) => stop.workOrderId === workOrderId);
      const target = index + offset;
      if (index < 0 || target < 0 || target >= route.stops.length) return route;
      const stops = [...route.stops];
      [stops[index], stops[target]] = [stops[target], stops[index]];
      return { ...route, stops: stops.map((stop, stopIndex) => ({ ...stop, order: stopIndex + 1 })) };
    });
    await persistDraft(nextRoutes, "Reihenfolge gespeichert", "Die Stoppreihenfolge wurde aktualisiert.");
  }

  return (
    <>
      <TopBar
        eyebrow="Steuerzentrale · Entwurf"
        title="Planungscockpit"
        description="Stelle deinen Planungshorizont und die Fahrerparameter ein. Die KI erklärt jede Zuweisung und lässt dir die letzte Entscheidung."
        actions={
          <>
            <Button onClick={runPlanning} disabled={running || dateError} title={!canPlan ? "Klicken für die fehlenden Voraussetzungen." : undefined}>
              <WandSparkles className="h-4 w-4" />
              {running ? "Berechne…" : "Optimale Routen berechnen"}
            </Button>
          </>
        }
      />
      <AdminContent>
        <div id="planung-vorbereiten" className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="space-y-5">
            <Card className="overflow-hidden">
              <CardHeader className="bg-navy text-white">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.16em] text-brand-400">
                  <Sparkles className="h-3.5 w-3.5" />
                  Planungs-Copilot
                </div>
                <CardTitle className="mt-2 text-white">
                  Sag, was du brauchst.
                </CardTitle>
                <p className="text-sm leading-6 text-slate-400">
                  Die KI übersetzt deine Anweisung in prüfbare Regeln. Erst mit
                  deiner Freigabe wird geplant.
                </p>
              </CardHeader>
              <CardContent className="p-4">
                <textarea
                  value={command}
                  onChange={(event) => setCommand(event.target.value)}
                  className="min-h-[106px] w-full resize-none rounded-xl border border-line bg-soft p-3 text-sm font-semibold leading-6 text-ink outline-none focus:border-brand-500"
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-lg bg-brand-50 px-2 py-1 text-[10px] font-extrabold text-brand-700">
                    ✓ {constraints.defaultMaxStops} Stopps / Tag
                  </span>
                  <span className="rounded-lg bg-blue-50 px-2 py-1 text-[10px] font-extrabold text-blue-700">
                    ✓ {Math.round((constraints.defaultMaxTravelMinutes / 60) * 10) / 10}h Fahrzeit
                  </span>
                  <span className="rounded-lg bg-violet-50 px-2 py-1 text-[10px] font-extrabold text-violet-700">
                    ✓ Skills beachten
                  </span>
                  <button type="button" disabled={copilotLoading} onClick={() => void previewCopilot()} className="rounded-lg bg-ink px-2.5 py-1 text-[10px] font-extrabold text-white hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60">
                    <Sparkles className="mr-1 inline h-3 w-3" />{copilotLoading ? "KI plant…" : "Vorschau prüfen"}
                  </button>
                  <button type="button" onClick={toggleDictation} aria-pressed={listening} title={listening ? "Diktieren beenden" : "Anweisung diktieren"} className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-extrabold transition ${listening ? "bg-rose-600 text-white shadow-sm animate-pulse" : "border border-line bg-white text-ink hover:border-brand-400 hover:text-brand-700"}`}>
                    {listening ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}{listening ? "Hört zu…" : "Diktieren"}
                  </button>
                </div>
                {copilotPreview && <div className="mt-3 rounded-xl border border-brand-200 bg-brand-50 p-3 text-xs text-brand-900"><p className="font-extrabold">KI-Plan als Entwurf angezeigt</p><p className="mt-1 text-brand-800">{copilotPreview.defaultMaxStops} Stopps · {copilotPreview.defaultMaxTravelMinutes} Min. Fahrzeit · {formatDate(copilotPreview.from)} bis {formatDate(copilotPreview.to)}</p>{copilotRationale && <p className="mt-2 text-brand-800/80">{copilotRationale}</p>}{copilotJson && <details className="mt-2 rounded-lg border border-brand-100 bg-white/70 p-2"><summary className="cursor-pointer font-bold text-brand-800">KI-JSON anzeigen</summary><pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-[10px] leading-4 text-slate-700">{copilotJson}</pre></details>}<div className="mt-2 flex gap-2"><Button size="sm" onClick={applyCopilot}>Parameter übernehmen</Button><Button size="sm" variant="outline" onClick={() => { setCopilotPreview(undefined); setCopilotRationale(undefined); setCopilotJson(undefined); }}>Hinweis schließen</Button></div></div>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Zeitraum</CardTitle>
                <p className="text-sm text-muted">
                  Bis zu 90 Tage · Wochenenden werden automatisch übersprungen.
                </p>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <label className="text-xs font-extrabold text-muted">
                  Von
                  <Input
                    type="date"
                    value={constraints.from}
                    onChange={(event) => { const from = event.target.value; setConstraints((current) => ({ ...current, from })); setManualDate((current) => current < from ? from : current); }}
                    className="mt-1.5"
                  />
                </label>
                <label className="text-xs font-extrabold text-muted">
                  Bis
                  <Input
                    type="date"
                    value={constraints.to}
                    onChange={(event) => { const to = event.target.value; setConstraints((current) => ({ ...current, to })); setManualDate((current) => current > to ? to : current); }}
                    className="mt-1.5"
                  />
                </label>
                <label className="text-xs font-extrabold text-muted">
                  Max. Stopps pro Fahrer
                  <Input
                    type="number"
                    min="1"
                    max="12"
                    value={constraints.defaultMaxStops}
                    onChange={(event) =>
                      setConstraints((current) => ({
                        ...current,
                        defaultMaxStops: Math.max(1, Math.min(12, Number(event.target.value) || 1)),
                        hardRules: { ...current.hardRules, maxStops: true },
                      }))
                    }
                    className="mt-1.5"
                  />
                </label>
                <label className="text-xs font-extrabold text-muted">
                  Max. Fahrzeit (Min.)
                  <Input
                    type="number"
                    min="30"
                    max="600"
                    step="15"
                    value={constraints.defaultMaxTravelMinutes}
                    onChange={(event) =>
                      setConstraints((current) => ({
                        ...current,
                        defaultMaxTravelMinutes: Math.max(30, Math.min(600, Number(event.target.value) || 30)),
                        hardRules: { ...current.hardRules, maxTravel: true },
                      }))
                    }
                    className="mt-1.5"
                  />
                </label>
                <p className="col-span-2 -mt-1 text-[11px] text-muted">Beide Werte werden bei der nächsten KI-Vorschau und Routenberechnung als feste Grenzen verwendet.</p>
                {dateError && <p className="col-span-2 text-[11px] font-bold text-rose-700">Bitte einen gültigen Zeitraum zwischen 0 und 90 Tagen wählen.</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Route manuell ergänzen</CardTitle><p className="text-sm text-muted">Füge einen gespeicherten Kundenauftrag als eigenen Tourentwurf hinzu.</p></CardHeader>
              <CardContent className="space-y-3">
                <Input type="date" value={manualDate} onChange={(event) => setManualDate(event.target.value)} />
                <select value={manualDriverId} onChange={(event) => setManualDriverId(event.target.value)} className="h-10 w-full rounded-xl border border-line bg-white px-3 text-sm font-bold"><option value="">Fahrer wählen</option>{activeDrivers.filter((driver) => isDriverAvailable(manualDate, driver.id) && !driver.daysOff.includes(manualDate)).map((driver) => <option key={driver.id} value={driver.id}>{driver.name}</option>)}</select>
                <select value={manualOrderId} onChange={(event) => setManualOrderId(event.target.value)} className="h-10 w-full rounded-xl border border-line bg-white px-3 text-sm font-bold"><option value="">Kundenauftrag wählen</option>{manualOrders.map((order) => <option key={order.id} value={order.id}>{getCustomer(order.id)?.name ?? order.id} · {order.title}{order.deadlineDate ? ` · bis ${formatDate(order.deadlineDate, { day: "2-digit", month: "2-digit" })}` : ""}</option>)}</select>
                <Button className="w-full" variant="outline" onClick={() => void addManualRoute()} disabled={draftSaving}><Plus className="h-4 w-4" />{draftSaving ? "Speichere…" : "Entwurf hinzufügen"}</Button>
              </CardContent>
            </Card>
            <Card id="tagesbesetzung">
              <CardHeader className="flex-row items-center justify-between">
                <div>
                  <CardTitle>Tagesbesetzung</CardTitle>
                  <p className="text-sm text-muted">
                    Klicke pro Tag die verfügbaren Fahrer an. VROOM plant nur mit dieser Besetzung.
                  </p>
                </div>
                <span className="rounded-full bg-brand-50 px-2 py-1 text-[10px] font-black text-brand-700">
                  {planningWorkDays.length} Tage
                </span>
              </CardHeader>
              <CardContent className="max-h-[620px] space-y-3 overflow-y-auto pr-1">
                {planningDates.map((date) => {
                  const weekend = [0, 6].includes(new Date(`${date}T12:00:00`).getDay());
                  const availableCount = activeDrivers.filter((driver) => isDriverAvailable(date, driver.id) && !driver.daysOff.includes(date)).length;
                  return <div key={date} className={`rounded-xl border p-3 ${weekend ? "border-line bg-soft/70" : "border-brand-100 bg-white"}`}><div className="mb-2 flex items-center justify-between gap-2"><span className="text-xs font-black">{formatPlanningDay(date)}</span><Badge variant={weekend ? "muted" : availableCount ? "default" : "warning"}>{weekend ? "Wochenende" : `${availableCount} aktiv`}</Badge></div>{!weekend && <div className="flex flex-wrap gap-1.5">{activeDrivers.map((driver) => { const dayOff = driver.daysOff.includes(date); const selected = isDriverAvailable(date, driver.id) && !dayOff; return <button key={driver.id} type="button" disabled={dayOff} onClick={() => toggleDriverForDay(date, driver.id)} title={dayOff ? "Als abwesend hinterlegt" : `${driver.name} ${selected ? "abmelden" : "anmelden"}`} className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[10px] font-extrabold transition ${selected ? "border-brand-200 bg-brand-50 text-brand-800" : "border-line bg-white text-muted"} ${dayOff ? "cursor-not-allowed opacity-40" : "hover:border-brand-400"}`}><span className="grid h-4 w-4 place-items-center rounded-full text-[8px] text-white" style={{ background: driver.color }}>{driver.initials}</span>{driver.name.split(" ")[0]}{selected && <Check className="h-3 w-3" />}</button>; })}</div>}{weekend && <p className="text-[10px] text-muted">Kein regulärer Planungstag.</p>}</div>;
                })}
                {!planningDates.length && <p className="text-xs text-rose-700">Bitte zuerst einen gültigen Zeitraum auswählen.</p>}
              </CardContent>
            </Card>
          </div>
          <div className="min-w-0 space-y-5">
            <Card className={canPlan ? "border-brand-100 bg-brand-50/40" : "border-amber-200 bg-amber-50/50"}>
              <CardContent className="p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-extrabold">So funktioniert die Planung</p><p className="mt-1 text-xs text-muted">1. Zeitraum wählen · 2. Fahrer je Tag in „Tagesbesetzung“ aktivieren · 3. Optimale Routen berechnen · 4. Tageskarten prüfen und Stopps bei Bedarf verschieben.</p></div><Badge variant={canPlan ? "default" : "warning"}>{canPlan ? "Bereit zur Optimierung" : "Noch vorbereiten"}</Badge></div><div className="mt-3 grid gap-2 sm:grid-cols-3"><div className={`rounded-xl border p-3 ${activeDrivers.length ? "border-brand-100 bg-white" : "border-amber-200 bg-white/80"}`}><p className="text-[10px] font-black uppercase tracking-[.1em] text-muted">1 · Fahrer</p><p className="mt-1 text-sm font-extrabold">{activeDrivers.length} aktiv</p><a href="/admin/fahrer" className="mt-1 inline-block text-[11px] font-bold text-brand-700 underline">Fahrer verwalten</a></div><div className={`rounded-xl border p-3 ${plannableOrders.length ? "border-brand-100 bg-white" : "border-amber-200 bg-white/80"}`}><p className="text-[10px] font-black uppercase tracking-[.1em] text-muted">2 · Aufträge</p><p className="mt-1 text-sm font-extrabold">{plannableOrders.length} planbar</p><a href="/admin/kunden" className="mt-1 inline-block text-[11px] font-bold text-brand-700 underline">Kunden & Aufträge</a></div><div className={`rounded-xl border p-3 ${staffedDays.length ? "border-brand-100 bg-white" : "border-amber-200 bg-white/80"}`}><p className="text-[10px] font-black uppercase tracking-[.1em] text-muted">3 · Besetzung</p><p className="mt-1 text-sm font-extrabold">{staffedDays.length} von {planningWorkDays.length} Tagen</p><button onClick={() => document.getElementById("tagesbesetzung")?.scrollIntoView({ behavior: "smooth", block: "center" })} className="mt-1 text-[11px] font-bold text-brand-700 underline">Fahrer je Tag wählen</button></div></div></CardContent>
            </Card>
            <div className="grid gap-3 sm:grid-cols-4">
              <SummaryCard
                label="Zugewiesen"
                value={String(result?.summary.assigned ?? 0)}
                tone="green"
              />
              <SummaryCard
                label="Offen"
                value={String(result?.summary.unassigned ?? 0)}
                tone="orange"
              />
              <SummaryCard
                label="Fahrstrecke"
                value={`${formatNumber(result?.summary.distanceKm ?? 0, 1)} km`}
                tone="blue"
              />
              <SummaryCard
                label="Status"
                value={result?.mode === "vroom" ? "VROOM" : result?.mode === "ai" ? "KI-Vorschau" : result?.mode === "manual" ? "Manuell" : result?.mode === "google" ? "Google" : "Lokal"}
                tone="purple"
              />
            </div>
            <Card><CardHeader><CardTitle>Planungskarte</CardTitle><p className="text-sm text-muted">Wähle eine einzelne Tour oder behalte alle Strecken in der Gesamtansicht.</p></CardHeader><CardContent><RouteMapWorkspace routes={routes} drivers={state.drivers} customers={state.customers} workOrders={state.workOrders} /></CardContent></Card>
            <Card className="relative">
              <CardHeader className="sticky top-3 z-20 flex-row flex-wrap items-center justify-between gap-3 border-b border-line bg-white/95 shadow-sm backdrop-blur">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle>Planentwurf</CardTitle>
                    <Badge variant="warning">Noch nicht veröffentlicht</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {dateColumns.length || 1} Tage · {routes.length} Touren ·
                    {activeTab === "board" ? "Ziehe Stopps zwischen den Fahrern hin und her." : "Alle berechneten Touren als Tabelle – klicke eine Zeile für die Stoppfolge."}
                  </p>
                </div>
                <div className="flex items-center gap-1 rounded-xl border border-line bg-soft p-1">
                  <button
                    onClick={() => { setActiveTab("board"); document.getElementById("planung-vorbereiten")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
                    className="rounded-lg px-3 py-1.5 text-xs font-extrabold text-muted"
                  >
                    <Settings2 className="mr-1.5 inline h-3.5 w-3.5" />
                    Vorbereiten
                  </button>
                  <button
                    onClick={() => setActiveTab("board")}
                    className={`rounded-lg px-3 py-1.5 text-xs font-extrabold ${activeTab === "board" ? "bg-white text-ink shadow-sm" : "text-muted"}`}
                  >
                    <CalendarDays className="mr-1.5 inline h-3.5 w-3.5" />
                    Board
                  </button>
                  <button
                    onClick={() => setActiveTab("routes")}
                    className={`rounded-lg px-3 py-1.5 text-xs font-extrabold ${activeTab === "routes" ? "bg-white text-ink shadow-sm" : "text-muted"}`}
                  >
                    <Table2 className="mr-1.5 inline h-3.5 w-3.5" />
                    Tabelle
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                {activeTab === "routes" ? (
                  <RouteTableTab
                    routes={routes}
                    drivers={state.drivers}
                    getCustomer={getCustomer}
                    getOrder={getOrder}
                  />
                ) : (
                  <div className="space-y-4">
                    {dateColumns.map((date) => {
                      const dayRoutes = routes.filter((route) => route.date === date);
                      return <div key={date}>
                        <div className="mb-2 flex items-center gap-2">
                          <span className="text-sm font-black">
                            {formatDate(date, {
                              weekday: "long",
                              day: "numeric",
                              month: "long",
                            })}
                          </span>
                          {date === constraints.from && (
                            <Badge variant="blue">Heute</Badge>
                          )}
                          <span className="h-px flex-1 bg-line" />
                        </div>
                        <div className="grid gap-3 lg:grid-cols-2">
                          {dayRoutes.map((route) => (
                              <RouteColumn
                                key={route.id}
                                route={route}
                                driver={getDriver(route.driverId)}
                                getOrder={getOrder}
                                getCustomer={getCustomer}
                                onDrop={() => void dropOnRoute(route)}
                                onDragStart={(workOrderId) =>
                                  setDraggedStop({
                                    workOrderId,
                                    routeId: route.id,
                                  })
                                }
                                onDragEnd={() => setDraggedStop(null)}
                                onToggleLock={toggleLock}
                                onRemoveStop={(workOrderId) => void removeStop(route.id, workOrderId)}
                                onMoveStop={(workOrderId, offset) => void moveStop(route.id, workOrderId, offset)}
                              />
                            ))}
                          {dayRoutes.length === 0 && (
                            <div className="rounded-xl border border-dashed border-line p-5 text-center text-xs text-muted">
                              Noch keine Route für diesen Tag.
                            </div>
                          )}
                        </div>
                      </div>;
                    })}
                    {(result?.unassigned.length ?? 0) > 0 && (
                      <div className="rounded-xl border border-orange-100 bg-orange-50 p-4">
                        <div className="flex items-center gap-2 text-sm font-extrabold text-orange-800">
                          <AlertTriangle className="h-4 w-4" />
                          {result?.unassigned.length} Aufträge brauchen
                          Entscheidung
                        </div>
                        <div className="mt-2 grid gap-1 text-xs text-orange-800/80 sm:grid-cols-2">
                          {result?.unassigned.slice(0, 6).map((item) => (
                            <div
                              key={item.workOrderId}
                              draggable
                              onDragStart={() => setDraggedStop({ workOrderId: item.workOrderId })}
                              onDragEnd={() => setDraggedStop(null)}
                              className="cursor-grab rounded-lg px-2 py-1 active:cursor-grabbing hover:bg-orange-100"
                              title="Auf eine Fahrer-Tour ziehen, um den Auftrag einzuplanen"
                            >
                              •{" "}
                              {getCustomer(item.workOrderId)?.name ??
                                item.workOrderId}
                              : {item.reason}
                            </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-100 bg-brand-50 p-4">
              <div className="flex items-start gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-brand-600">
                  <Check className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-extrabold text-brand-900">
                    Planung geprüft?
                  </p>
                  <p className="mt-0.5 text-xs text-brand-800/70">
                    Veröffentlichen erstellt Fahrer-Touren und verschickt nur
                    betroffene Kundenlinks.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={runPlanning}
                  disabled={running || dateError}
                >
                  <RefreshCw className="h-4 w-4" />
                  Neu berechnen
                </Button>
                <Button
                  onClick={() => void publishPlan()}
                  disabled={publishing || !result || dateError}
                >
                  <Send className="h-4 w-4" />
                  {publishing ? "Veröffentliche…" : "Veröffentlichen"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </AdminContent>
    </>
  );
}

function formatPlanningDay(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const weekday = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][new Date(year, month - 1, day, 12).getDay()];
  return `${weekday}. ${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}.`;
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "green" | "orange" | "blue" | "purple";
}) {
  const style = {
    green: "text-brand-700 bg-brand-50",
    orange: "text-orange-700 bg-orange-50",
    blue: "text-blue-700 bg-blue-50",
    purple: "text-violet-700 bg-violet-50",
  }[tone];
  return (
    <Card className="border-0">
      <CardContent className="p-4">
        <p className="text-[10px] font-black uppercase tracking-[.12em] text-muted">
          {label}
        </p>
        <p
          className={`mt-2 inline-block rounded-lg px-2 py-1 text-xl font-black ${style}`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function RouteTableTab({
  routes,
  drivers,
  getCustomer,
  getOrder,
}: {
  routes: Route[];
  drivers: ReturnType<typeof useDemoStore>["state"]["drivers"];
  getCustomer: (workOrderId: string) => ReturnType<typeof useDemoStore>["state"]["customers"][number] | undefined;
  getOrder: (id: string) => ReturnType<typeof useDemoStore>["state"]["workOrders"][number] | undefined;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  if (routes.length === 0) {
    return <div className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">Noch keine Touren berechnet. Starte „Optimale Routen berechnen“, um Touren zu erzeugen.</div>;
  }
  const sorted = [...routes].sort((a, b) => (a.date === b.date ? (drivers.find((d) => d.id === a.driverId)?.name ?? "").localeCompare(drivers.find((d) => d.id === b.driverId)?.name ?? "") : a.date < b.date ? -1 : 1));
  const totals = routes.reduce((sum, route) => ({ stops: sum.stops + route.stops.length, km: sum.km + route.distanceKm, travel: sum.travel + route.travelMinutes, service: sum.service + route.serviceMinutes }), { stops: 0, km: 0, travel: 0, service: 0 });
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full min-w-[820px] text-left">
        <thead>
          <tr className="border-b border-line bg-soft/60 text-[10px] font-black uppercase tracking-[.12em] text-muted">
            <th className="px-4 py-3">Fahrer</th>
            <th className="px-4 py-3">Datum</th>
            <th className="px-4 py-3">Stopps</th>
            <th className="px-4 py-3">Strecke</th>
            <th className="px-4 py-3">Fahrzeit</th>
            <th className="px-4 py-3">Servicezeit</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Details</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((route) => {
            const driver = drivers.find((item) => item.id === route.driverId);
            const expanded = expandedId === route.id;
            const stops = route.stops.slice().sort((a, b) => a.order - b.order);
            return (
              <Fragment key={route.id}>
                <tr onClick={() => setExpandedId(expanded ? null : route.id)} className={`cursor-pointer border-b border-line/80 transition hover:bg-brand-50/40 ${expanded ? "bg-brand-50/40" : ""}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[10px] font-black text-white" style={{ background: driver?.color ?? "#16b67f" }}>{driver?.initials ?? "–"}</span>
                      <span className="truncate text-sm font-extrabold">{driver?.name ?? "Nicht zugewiesen"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs font-bold">{formatDate(route.date, { weekday: "short", day: "2-digit", month: "2-digit" })}</td>
                  <td className="px-4 py-3 text-xs font-extrabold">{route.stops.length}</td>
                  <td className="px-4 py-3 text-xs">{formatNumber(route.distanceKm, 1)} km</td>
                  <td className="px-4 py-3 text-xs">{route.travelMinutes} Min.</td>
                  <td className="px-4 py-3 text-xs">{route.serviceMinutes} Min.</td>
                  <td className="px-4 py-3"><Badge variant={route.status === "published" ? "default" : "warning"}>{route.status === "published" ? "Veröffentlicht" : "Entwurf"}</Badge></td>
                  <td className="px-4 py-3 text-right"><ChevronDown className={`ml-auto h-4 w-4 text-slate-400 transition ${expanded ? "rotate-180" : ""}`} /></td>
                </tr>
                {expanded && (
                  <tr className="border-b border-line/80 bg-soft/40">
                    <td colSpan={8} className="px-4 py-3">
                      {stops.length === 0 ? (
                        <p className="text-xs text-muted">Diese Tour enthält noch keine Stopps.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {stops.map((stop) => {
                            const customer = getCustomer(stop.workOrderId);
                            const order = getOrder(stop.workOrderId);
                            return (
                              <div key={stop.workOrderId} className="flex items-center gap-3 rounded-lg bg-white px-3 py-2 shadow-sm">
                                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink text-[10px] font-black text-white">{stop.order}</span>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-xs font-extrabold">{customer?.name ?? "Unbekannter Kunde"}</p>
                                  <p className="truncate text-[11px] text-muted">{customer?.address ?? ""}{order?.title ? ` · ${order.title}` : ""}</p>
                                </div>
                                <span className="shrink-0 text-[11px] font-bold text-brand-700">{stop.eta}</span>
                                <span className="hidden shrink-0 text-[11px] text-muted sm:block">{formatNumber(stop.distanceFromPreviousKm, 1)} km · {stop.driveMinutesFromPrevious} Min.</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-line bg-soft/40 text-xs font-black">
            <td className="px-4 py-3">Summe · {routes.length} Touren</td>
            <td className="px-4 py-3" />
            <td className="px-4 py-3">{totals.stops}</td>
            <td className="px-4 py-3">{formatNumber(totals.km, 1)} km</td>
            <td className="px-4 py-3">{totals.travel} Min.</td>
            <td className="px-4 py-3">{totals.service} Min.</td>
            <td className="px-4 py-3" />
            <td className="px-4 py-3" />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function RouteColumn({
  route,
  driver,
  getOrder,
  getCustomer,
  onDrop,
  onDragStart,
  onDragEnd,
  onToggleLock,
  onRemoveStop,
  onMoveStop,
}: {
  route: Route;
  driver?: ReturnType<typeof useDemoStore>["state"]["drivers"][number];
  getOrder: (
    id: string,
  ) =>
    ReturnType<typeof useDemoStore>["state"]["workOrders"][number] | undefined;
  getCustomer: (
    id: string,
  ) =>
    ReturnType<typeof useDemoStore>["state"]["customers"][number] | undefined;
  onDrop: () => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onToggleLock: (id: string) => void;
  onRemoveStop: (id: string) => void;
  onMoveStop: (id: string, offset: -1 | 1) => void;
}) {
  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        event.currentTarget.classList.add("border-brand-400", "bg-brand-50");
      }}
      onDragLeave={(event) => event.currentTarget.classList.remove("border-brand-400", "bg-brand-50")}
      onDrop={(event) => {
        event.currentTarget.classList.remove("border-brand-400", "bg-brand-50");
        onDrop();
      }}
      className="rounded-xl border border-line bg-soft/60 p-3"
    >
      <div className="flex items-center gap-2">
        <span
          className="grid h-8 w-8 place-items-center rounded-full text-[10px] font-black text-white"
          style={{ background: driver?.color }}
        >
          {driver?.initials ?? "--"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-extrabold">
            {driver?.name ?? "Nicht zugewiesen"}
          </p>
          <p className="text-[10px] text-muted">
            {route.stops.length} Stopps · {formatNumber(route.distanceKm, 1)} km
            · {route.travelMinutes} Min. Fahrt
          </p>
        </div>
        <Badge variant={route.status === "published" ? "default" : "warning"}>
          {route.status === "published" ? "Veröffentlicht" : "Entwurf"}
        </Badge>
      </div>
      <div className="mt-3 space-y-2">
        {route.stops.length === 0 ? (
          <div className="rounded-lg border border-dashed border-line p-4 text-center text-[11px] font-bold text-muted">
            Stopps hier ablegen
          </div>
        ) : (
          route.stops.map((stop, stopIndex) => {
            const order = getOrder(stop.workOrderId);
            const customer = getCustomer(stop.workOrderId);
            if (!order || !customer) return null;
            return (
              <div
                draggable
                onDragStart={() => onDragStart(stop.workOrderId)}
                onDragEnd={onDragEnd}
                key={stop.workOrderId}
                className="group flex cursor-grab items-start gap-2 rounded-xl border border-line bg-white p-2.5 shadow-sm active:cursor-grabbing"
              >
                <GripVertical className="mt-1 h-3.5 w-3.5 shrink-0 text-slate-300" />
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink text-[10px] font-black text-white">
                  {stop.order}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-xs font-extrabold">
                      {customer.name}
                    </p>
                    {order.locked && (
                      <Lock className="h-3 w-3 shrink-0 text-orange-500" />
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-[10px] text-muted">
                    {stop.eta} · {order.title}
                  </p>
                  <p className="mt-1 truncate text-[10px] font-bold text-brand-700">
                    {stop.explanation}
                  </p>
                </div>
                <div className="flex flex-col gap-0.5 opacity-0 transition group-hover:opacity-100"><button onClick={() => onMoveStop(order.id, -1)} disabled={stopIndex === 0} aria-label="Nach oben" className="rounded px-1 text-[10px] text-muted hover:bg-soft disabled:opacity-30">↑</button><button onClick={() => onMoveStop(order.id, 1)} disabled={stopIndex === route.stops.length - 1} aria-label="Nach unten" className="rounded px-1 text-[10px] text-muted hover:bg-soft disabled:opacity-30">↓</button><button onClick={() => onToggleLock(order.id)} aria-label={order.locked ? "Entsperren" : "Sperren"} className="rounded p-1 text-slate-300 hover:bg-soft hover:text-brand-600">{order.locked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}</button><button onClick={() => onRemoveStop(order.id)} aria-label="Aus Route entfernen" className="rounded px-1 text-xs text-rose-400 hover:bg-rose-50 hover:text-rose-700">×</button></div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
