"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Camera,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  CloudOff,
  FileCheck2,
  FileText,
  LocateFixed,
  Lock,
  LogOut,
  MapPin,
  Mic,
  Navigation,
  Pause,
  Play,
  Radio,
  RefreshCw,
  Route as RouteIcon,
  Send,
  ShieldCheck,
  SkipForward,
  Sparkles,
  Upload,
  Wifi,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useDemoStore } from "@/lib/demo-store";
import { generateServiceReport } from "@/lib/ai";
import { googleMapsUrl } from "@/lib/planner";
import {
  enqueueOutbox,
  fileToDataUrl,
  flushOutbox,
  getOutboxEntries,
  retryFailedOutbox,
  type OutboxEntry,
} from "@/lib/offline-outbox";
import { formatLongDate, statusLabel } from "@/lib/utils";
import { businessDate } from "@/lib/metrics";
import type { Route, ServiceAttachment, ServiceReport } from "@/lib/types";

const TODAY = businessDate();

type ReportStep = "capture" | "review";

export default function DriverPage() {
  const router = useRouter();
  const { state, updateRoute, updateWorkOrder, addReport, notify, hydrate } =
    useDemoStore();
  // Driver identity always comes from the authenticated session. There is no
  // default driver because that could expose another person's tour.
  const [driverId, setDriverId] = useState("");
  const driver =
    state.drivers.find((item) => item.id === driverId) ?? state.drivers[0];
  const [routeId, setRouteId] = useState<string>();
  const [online, setOnline] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [lastLocation, setLastLocation] = useState<{
    lat: number;
    lng: number;
  }>();
  const [locationError, setLocationError] = useState<string>();
  const [outboxEntries, setOutboxEntries] = useState<OutboxEntry[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [reportStop, setReportStop] = useState<string>();
  const [reportStep, setReportStep] = useState<ReportStep>("capture");
  const [note, setNote] = useState("");
  const [reporting, setReporting] = useState(false);
  const [reportDraft, setReportDraft] = useState<ServiceReport>();
  const [attachments, setAttachments] = useState<ServiceAttachment[]>([]);
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [mediaError, setMediaError] = useState<string>();
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const signatureCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const locationWatchRef = useRef<number | null>(null);
  const lastLocationSentRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const loadAssignedTour = async () => {
      for (let attempt = 0; attempt < 4 && !cancelled; attempt += 1) {
        try {
          const meResponse = await fetch("/api/auth/me", {
            credentials: "same-origin",
            cache: "no-store",
          });
          if (!meResponse.ok) {
            await new Promise((resolve) =>
              window.setTimeout(resolve, 150 * (attempt + 1)),
            );
            continue;
          }
          const me = (await meResponse.json()) as {
            role?: string;
            driverId?: string | null;
          };
          if (me.role !== "driver" || !me.driverId) return;
          const toursResponse = await fetch(`/api/driver/tours?date=${TODAY}`, {
            credentials: "same-origin",
            cache: "no-store",
          });
          if (!toursResponse.ok) {
            await new Promise((resolve) =>
              window.setTimeout(resolve, 150 * (attempt + 1)),
            );
            continue;
          }
          const snapshot = (await toursResponse.json()) as {
            driver?: (typeof state.drivers)[number];
            routes?: typeof state.routes;
            workOrders?: typeof state.workOrders;
            customers?: typeof state.customers;
          };
          if (!cancelled && snapshot.driver) {
            setDriverId(snapshot.driver.id);
            // The server has already scoped this snapshot to the authenticated
            // driver. Do not keep a client-side copy of other tenants' data.
            hydrate({
              drivers: [snapshot.driver],
              routes: snapshot.routes ?? [],
              workOrders: snapshot.workOrders ?? [],
              customers: snapshot.customers ?? [],
            });
          }
          return;
        } catch {
          /* The authenticated session may still be becoming available. */
        }
        await new Promise((resolve) =>
          window.setTimeout(resolve, 150 * (attempt + 1)),
        );
      }
    };
    void loadAssignedTour();
    return () => {
      cancelled = true;
    };
    // The authenticated driver is loaded once per page mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const routes = state.routes.filter(
    (route) =>
      route.driverId === driver?.id &&
      route.date === TODAY &&
      // Drafts are private to dispatch. A driver can only start a published tour.
      route.status !== "draft" &&
      route.status !== "cancelled",
  );
  const route = routes.find((item) => item.id === routeId) ?? routes[0];
  const workOrders = useMemo(
    () => new Map(state.workOrders.map((item) => [item.id, item])),
    [state.workOrders],
  );
  const customers = useMemo(
    () => new Map(state.customers.map((item) => [item.id, item])),
    [state.customers],
  );
  const pendingCount = outboxEntries.filter(
    (entry) => entry.status === "pending",
  ).length;
  const failedCount = outboxEntries.filter(
    (entry) => entry.status === "failed",
  ).length;
  const activeStop =
    route?.stops.find((stop) => stop.workOrderId === route.currentStopId) ??
    route?.stops.find(
      (stop) =>
        !["completed", "cancelled"].includes(
          workOrders.get(stop.workOrderId)?.status ?? "",
        ),
    );

  const refreshOutbox = useCallback(
    () => setOutboxEntries(getOutboxEntries()),
    [],
  );

  const syncNow = useCallback(async () => {
    if (!online || syncing) return;
    setSyncing(true);
    try {
      const result = await flushOutbox();
      refreshOutbox();
      if (result.sent > 0)
        notify(
          "Änderungen synchronisiert",
          `${result.sent} Änderung${result.sent === 1 ? "" : "en"} an die Disposition übertragen.`,
          "success",
        );
    } finally {
      setSyncing(false);
    }
  }, [notify, online, refreshOutbox, syncing]);

  useEffect(() => {
    setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    refreshOutbox();
    const onOnline = () => {
      setOnline(true);
      void syncNow();
    };
    const onOffline = () => setOnline(false);
    const onOutboxChanged = () => refreshOutbox();
    const onServiceWorkerMessage = (event: MessageEvent<{ type?: string }>) => {
      if (event.data?.type === "automatex:sync-outbox") void syncNow();
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("automatex:outbox-changed", onOutboxChanged);
    navigator.serviceWorker?.addEventListener(
      "message",
      onServiceWorkerMessage,
    );
    const timer = window.setInterval(refreshOutbox, 4_000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("automatex:outbox-changed", onOutboxChanged);
      navigator.serviceWorker?.removeEventListener(
        "message",
        onServiceWorkerMessage,
      );
      window.clearInterval(timer);
    };
  }, [refreshOutbox, syncNow]);

  useEffect(() => {
    if (!signatureOpen) return;
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(280, canvas.clientWidth || 320);
    const height = 150;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.height = `${height}px`;
    const context = canvas.getContext("2d");
    if (context) {
      context.scale(ratio, ratio);
      context.fillStyle = "#f8fafc";
      context.fillRect(0, 0, width, height);
      context.strokeStyle = "#94a3b8";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(12, height - 30);
      context.lineTo(width - 12, height - 30);
      context.stroke();
    }
  }, [signatureOpen]);

  useEffect(
    () => () => {
      if (locationWatchRef.current !== null && navigator.geolocation)
        navigator.geolocation.clearWatch(locationWatchRef.current);
    },
    [],
  );

  if (!driver) return <main className="grid min-h-screen place-items-center bg-navy text-sm font-bold text-slate-300">Fahrerprofil und Touren werden geladen…</main>;

  async function submitMutation(input: {
    kind: "driver_event" | "service_report" | "attachment";
    endpoint: string;
    body: unknown;
    id?: string;
  }) {
    const id =
      input.id ??
      `${driver.id}-${input.kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const idempotencyKey = `driver-${id}`;
    const body =
      input.body && typeof input.body === "object"
        ? { ...(input.body as Record<string, unknown>), idempotencyKey }
        : input.body;
    if (online) {
      try {
        const response = await fetch(input.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          credentials: "include",
          body: JSON.stringify(body),
        });
        if (response.ok || response.status === 409) return true;
      } catch {
        // The entry below makes the mutation durable across a network switch.
      }
    }
    enqueueOutbox({
      kind: input.kind,
      endpoint: input.endpoint,
      body,
      id,
      idempotencyKey,
    });
    refreshOutbox();
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.ready
        .then((registration) => {
          const sync = (
            registration as ServiceWorkerRegistration & {
              sync?: { register: (tag: string) => Promise<void> };
            }
          ).sync;
          if (sync) return sync.register("automatex-driver-outbox");
          return undefined;
        })
        .catch(() => undefined);
    }
    return false;
  }

  async function startRoute() {
    if (!route || !["published", "started"].includes(route.status)) return;
    updateRoute(route.id, {
      status: "started",
      startedAt: route.startedAt ?? new Date().toISOString(),
      currentStopId: route.currentStopId ?? route.stops[0]?.workOrderId,
    });
    const sent = await submitMutation({
      kind: "driver_event",
      endpoint: "/api/driver/events",
      body: { driverId: driver.id, routeId: route.id, type: "route_started" },
    });
    notify(
      "Tour gestartet",
      sent
        ? "Die Disposition wurde informiert."
        : "Offline gespeichert – wird bei Verbindung synchronisiert.",
      sent ? "success" : "warning",
    );
  }

  async function markArrived(stopId: string) {
    if (!route) return;
    updateWorkOrder(stopId, { status: "on_site" });
    const sent = await submitMutation({
      kind: "driver_event",
      endpoint: "/api/driver/events",
      body: {
        driverId: driver.id,
        routeId: route.id,
        workOrderId: stopId,
        type: "arrived",
      },
    });
    notify(
      "Vor Ort markiert",
      sent ? "Der Status ist synchronisiert." : "Offline gespeichert.",
      sent ? "success" : "warning",
    );
  }

  async function completeStop(stopId: string) {
    if (!route) return;
    const currentOrder =
      route.stops.find((item) => item.workOrderId === stopId)?.order ?? 0;
    const next = route.stops.find(
      (item) =>
        item.order === currentOrder + 1 &&
        workOrders.get(item.workOrderId)?.status !== "completed",
    );
    updateWorkOrder(stopId, { status: "completed" });
    updateRoute(route.id, {
      currentStopId: next?.workOrderId,
      status: next ? "started" : "completed",
    });
    const sent = await submitMutation({
      kind: "driver_event",
      endpoint: "/api/driver/events",
      body: {
        driverId: driver.id,
        routeId: route.id,
        workOrderId: stopId,
        type: "completed",
      },
    });
    if (!next) stopLocationSharing();
    notify(
      "Stopp erledigt",
      next
        ? `Nächster Stopp: ${customers.get(workOrders.get(next.workOrderId)?.customerId ?? "")?.name ?? "—"}`
        : "Die Tour ist vollständig abgeschlossen.",
      sent ? "success" : "warning",
    );
  }

  async function reportProblem(stopId: string) {
    if (!route) return;
    updateWorkOrder(stopId, { status: "needs_followup" });
    const sent = await submitMutation({
      kind: "driver_event",
      endpoint: "/api/driver/events",
      body: {
        driverId: driver.id,
        routeId: route.id,
        workOrderId: stopId,
        type: "problem",
        note: "Problem vom Fahrer gemeldet",
      },
    });
    notify(
      "Problem gemeldet",
      sent
        ? "Die Disposition wurde informiert."
        : "Offline gespeichert – die Disposition erhält den Hinweis nach der Synchronisation.",
      "warning",
    );
  }

  async function skipStop(stopId: string) {
    if (!route) return;
    const currentOrder =
      route.stops.find((item) => item.workOrderId === stopId)?.order ?? 0;
    const next = route.stops.find(
      (item) =>
        item.order > currentOrder &&
        workOrders.get(item.workOrderId)?.status !== "completed",
    );
    updateWorkOrder(stopId, { status: "needs_followup" });
    updateRoute(route.id, {
      currentStopId: next?.workOrderId,
      status: next ? "started" : "completed",
    });
    await submitMutation({
      kind: "driver_event",
      endpoint: "/api/driver/events",
      body: {
        driverId: driver.id,
        routeId: route.id,
        workOrderId: stopId,
        type: "skipped",
        note: "Stopp übersprungen – Nacharbeit erforderlich",
      },
    });
    notify(
      "Stopp übersprungen",
      "Der Auftrag wurde als Nacharbeit markiert.",
      "warning",
    );
  }

  function stopLocationSharing() {
    if (locationWatchRef.current !== null && navigator.geolocation)
      navigator.geolocation.clearWatch(locationWatchRef.current);
    locationWatchRef.current = null;
    setSharing(false);
  }

  function startLocationSharing() {
    if (!state.settings.gpsEnabled) {
      notify(
        "Standortfreigabe deaktiviert",
        "Die Disposition hat die Standortübermittlung für diese Organisation deaktiviert.",
        "warning",
      );
      return;
    }
    if (!route || route.status !== "started") {
      notify(
        "Tour noch nicht gestartet",
        "Standortfreigabe ist erst während einer aktiven Tour möglich.",
        "warning",
      );
      return;
    }
    if (!navigator.geolocation) {
      notify(
        "Standort nicht verfügbar",
        "Dieser Browser unterstützt keine Standortfreigabe.",
        "warning",
      );
      return;
    }
    if (locationWatchRef.current !== null) return;
    setLocationError(undefined);
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const coordinates = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setLastLocation(coordinates);
        updateRoute(route.id, { lastLocation: coordinates });
        const now = Date.now();
        // A location event every 15 seconds is enough for ETA and avoids an
        // unbounded offline queue when the driver is out of coverage.
        if (now - lastLocationSentRef.current >= 15_000) {
          lastLocationSentRef.current = now;
          void submitMutation({
            kind: "driver_event",
            endpoint: "/api/driver/events",
            body: {
              driverId: driver.id,
              routeId: route.id,
              type: "location",
              location: coordinates,
            },
          });
        }
      },
      () => {
        setLocationError(
          "Standortfreigabe wurde abgelehnt oder ist nicht verfügbar.",
        );
        setSharing(false);
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 },
    );
    locationWatchRef.current = watchId;
    setSharing(true);
    notify(
      "Standort geteilt",
      "Die Disposition sieht deine Position nur bis zum Ende dieser Tour.",
      "success",
    );
  }

  function toggleLocationSharing() {
    if (sharing) stopLocationSharing();
    else startLocationSharing();
  }

  function openNavigation() {
    if (!route) return;
    const remaining = route.stops.filter(
      (stop) =>
        !["completed", "cancelled"].includes(
          workOrders.get(stop.workOrderId)?.status ?? "",
        ),
    );
    if (remaining.length <= 4) {
      window.open(
        googleMapsUrl({ ...route, stops: remaining }, state),
        "_blank",
        "noopener,noreferrer",
      );
      return;
    }
    // Google Maps URLs support only three intermediate waypoints on mobile.
    // For larger tours navigate robustly to the next stop instead of silently
    // dropping waypoints.
    const next = remaining[0];
    const address = customers.get(
      workOrders.get(next.workOrderId)?.customerId ?? "",
    )?.address;
    if (address)
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}&travelmode=driving&dir_action=navigate`,
        "_blank",
        "noopener,noreferrer",
      );
  }

  function openReport(stopId: string) {
    setReportStop(stopId);
    setReportStep("capture");
    setReportDraft(undefined);
    setNote("");
    setAttachments([]);
    setHasSignature(false);
    setMediaError(undefined);
  }

  function closeReport() {
    setReportStop(undefined);
    setReportStep("capture");
    setReportDraft(undefined);
    setNote("");
    setAttachments([]);
    setHasSignature(false);
    setSignatureOpen(false);
  }

  function generateDraft() {
    if (!reportStop) return;
    const order = workOrders.get(reportStop);
    const generated = generateServiceReport({
      workOrderTitle: order?.title ?? "Serviceeinsatz",
      note,
    });
    setReportDraft({
      ...generated,
      id: `report-${Date.now()}`,
      workOrderId: reportStop,
      createdAt: new Date().toISOString(),
      attachments,
    });
    setReportStep("review");
  }

  async function confirmReport() {
    if (!reportDraft || !route) return;
    setReporting(true);
    const report: ServiceReport = {
      ...reportDraft,
      confirmed: true,
      attachments,
    };
    addReport(report);
    updateWorkOrder(report.workOrderId, { status: "completed" });
    const sent = await submitMutation({
      kind: "service_report",
      endpoint: "/api/driver/reports",
      body: report,
      id: report.id,
    });
    const currentOrder =
      route.stops.find((item) => item.workOrderId === report.workOrderId)
        ?.order ?? 0;
    const next = route.stops.find(
      (item) =>
        item.order > currentOrder &&
        workOrders.get(item.workOrderId)?.status !== "completed",
    );
    updateRoute(route.id, {
      currentStopId: next?.workOrderId,
      status: next ? "started" : "completed",
    });
    if (!next) stopLocationSharing();
    setReporting(false);
    closeReport();
    notify(
      sent ? "Bericht bestätigt" : "Bericht offline gespeichert",
      sent
        ? "Bericht und Abschluss wurden an die Disposition übertragen."
        : "Der Bericht bleibt in der Outbox und wird automatisch synchronisiert.",
      sent ? "success" : "warning",
    );
  }

  async function handleMedia(kind: "photo" | "audio", file?: File) {
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      const attachment: ServiceAttachment = {
        id: `attachment-${Date.now()}`,
        kind,
        name: file.name || `${kind}-${Date.now()}`,
        mimeType: file.type || (kind === "photo" ? "image/*" : "audio/*"),
        sizeBytes: file.size,
        createdAt: new Date().toISOString(),
        dataUrl,
      };
      setAttachments((current) => [...current, attachment].slice(-12));
      setMediaError(undefined);
      notify(
        kind === "photo" ? "Foto angehängt" : "Sprachnotiz angehängt",
        "Die Datei wird mit dem bestätigten Bericht synchronisiert.",
        "success",
      );
    } catch (error) {
      setMediaError(
        error instanceof Error
          ? error.message
          : "Datei konnte nicht angehängt werden.",
      );
    }
  }

  function canvasPoint(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function beginSignature(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = signatureCanvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    drawingRef.current = true;
    canvas.setPointerCapture(event.pointerId);
    const point = canvasPoint(event);
    context.beginPath();
    context.moveTo(point.x, point.y);
  }

  function drawSignature(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const context = signatureCanvasRef.current?.getContext("2d");
    if (!context) return;
    const point = canvasPoint(event);
    context.lineWidth = 2;
    context.lineCap = "round";
    context.strokeStyle = "#0f172a";
    context.lineTo(point.x, point.y);
    context.stroke();
  }

  function endSignature() {
    drawingRef.current = false;
  }

  function applySignature() {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    setAttachments((current) => [
      ...current.filter((item) => item.kind !== "signature"),
      {
        id: `signature-${Date.now()}`,
        kind: "signature",
        name: "Kundenfreigabe.png",
        mimeType: "image/png",
        sizeBytes: Math.round(dataUrl.length * 0.75),
        createdAt: new Date().toISOString(),
        dataUrl,
      },
    ]);
    setHasSignature(true);
    setSignatureOpen(false);
  }

  const statusText = online
    ? pendingCount
      ? `${pendingCount} offen`
      : "Synchronisiert"
    : "Offline";

  return (
    <div className="phone-shell">
      <div className="sticky top-0 z-30 border-b border-white/10 bg-night/95 px-4 py-4 backdrop-blur">
        <div className="flex items-center justify-between">
          <Link
            href="/admin"
            className="flex items-center gap-2 text-[13px] font-extrabold"
          >
            <span className="brand-mark h-8 w-8">
              <img
                src="/brand/small-logo.svg"
                alt=""
                className="h-full w-full object-cover"
              />
            </span>
            Automate<span className="text-brand-500">X</span>{" "}
            <span className="ml-1 rounded-md bg-white/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[.12em] text-slate-400">
              Driver
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <span
              className="flex items-center gap-1 rounded-full bg-white/8 px-2 py-1 text-[10px] font-bold text-slate-300"
              role="status"
              aria-live="polite"
            >
              {online ? (
                <Wifi className="h-3.5 w-3.5 text-brand-400" />
              ) : (
                <CloudOff className="h-3.5 w-3.5 text-orange-400" />
              )}
              {statusText}
            </span>
            <button
              className="rounded-full bg-white/8 p-2 text-slate-300"
              aria-label="Hilfe"
            >
              <CircleHelp className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-500">
              {formatLongDate(TODAY)}
            </p>
            <p className="mt-1 text-lg font-extrabold">
              Hallo, {driver.name.split(" ")[0]}.
            </p>
          </div>
          <div
            className="flex items-center gap-2 rounded-xl bg-white/8 px-2 py-1.5"
            aria-label="Angemeldeter Fahrer"
          >
            <span
              className="grid h-8 w-8 place-items-center rounded-lg text-[10px] font-black text-white"
              style={{ background: driver.color }}
            >
              {driver.initials}
            </span>
            <span className="text-[10px] font-bold text-slate-300">
              Mein Profil
            </span>
            <ShieldCheck className="h-4 w-4 text-brand-400" />
            <button aria-label="Abmelden" className="rounded p-1 text-slate-400 hover:text-white" onClick={() => { void fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).finally(() => router.replace("/login")); }}><LogOut className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      </div>
      <main className="px-4 pb-10 pt-4">
        {!online && (
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-orange-400/30 bg-orange-400/10 px-3 py-2.5 text-xs font-bold text-orange-200">
            <CloudOff className="h-4 w-4" />
            Offline-Modus · Änderungen werden lokal gespeichert
          </div>
        )}
        {(pendingCount > 0 || failedCount > 0) && (
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-brand-400/20 bg-brand-400/10 px-3 py-2.5 text-xs text-brand-100">
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            <span className="flex-1">
              {pendingCount} Änderung{pendingCount === 1 ? "" : "en"} warten
              {failedCount
                ? ` · ${failedCount} prüfen`
                : " auf Synchronisation"}
            </span>
            {failedCount > 0 && (
              <button
                className="font-extrabold text-orange-200 disabled:opacity-50"
                onClick={() => {
                  retryFailedOutbox();
                  refreshOutbox();
                  void syncNow();
                }}
                disabled={!online || syncing}
              >
                Erneut
              </button>
            )}
            <button
              className="font-extrabold text-brand-300 disabled:opacity-50"
              onClick={() => void syncNow()}
              disabled={!online || syncing}
            >
              Synchronisieren
            </button>
          </div>
        )}
        <div className="mb-4 flex gap-2 overflow-x-auto scrollbar-hidden">
          {routes.map((item, index) => (
            <button
              key={item.id}
              onClick={() => setRouteId(item.id)}
              className={`min-w-[138px] rounded-xl border px-3 py-2.5 text-left ${route?.id === item.id ? "border-brand-500 bg-brand-500/15" : "border-white/10 bg-white/5"}`}
            >
              <p className="text-[10px] font-black uppercase tracking-[.12em] text-slate-500">
                Tour {index + 1}
              </p>
              <p className="mt-1 text-xs font-extrabold">
                {item.stops.length} Stopps
              </p>
              <p className="mt-1 text-[10px] text-slate-400">
                {statusLabel(item.status)} · {item.distanceKm} km
              </p>
            </button>
          ))}
          {routes.length === 0 && (
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-xs text-slate-400">
              Keine veröffentlichte Tour zugeteilt
            </div>
          )}
        </div>
        {route && (
          <>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-brand-400" />
                    <span className="text-[10px] font-black uppercase tracking-[.15em] text-brand-300">
                      {route.status === "started"
                        ? "Tour läuft"
                        : "Heute zugeteilt"}
                    </span>
                  </div>
                  <p className="mt-2 text-2xl font-extrabold tracking-tight">
                    {route.stops.length} Stopps
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {route.distanceKm} km · {route.travelMinutes} Min. Fahrt ·{" "}
                    {route.serviceMinutes} Min. Service
                  </p>
                </div>
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500/15 text-brand-300">
                  <RouteIcon />
                </span>
              </div>
              <div className="mt-4 flex gap-2">
                {route.status === "published" ? (
                  <Button
                    className="flex-1 bg-brand-500 hover:bg-brand-600"
                    onClick={() => void startRoute()}
                  >
                    <Play className="h-4 w-4 fill-white" />
                    Tour starten
                  </Button>
                ) : (
                  <Button
                    className="flex-1 bg-brand-500 hover:bg-brand-600"
                    onClick={openNavigation}
                  >
                    <Navigation className="h-4 w-4" />
                    Google Maps öffnen
                  </Button>
                )}
                <Button
                  variant="ghost"
                  className={`bg-white/8 text-white hover:bg-white/15 ${sharing ? "text-brand-300" : ""}`}
                  onClick={toggleLocationSharing}
                  aria-label={
                    sharing
                      ? "Standortfreigabe beenden"
                      : "Standortfreigabe aktivieren"
                  }
                >
                  <LocateFixed className="h-4 w-4" />
                </Button>
              </div>
              {route.status === "started" && (
                <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-400">
                  <Radio
                    className={`h-3 w-3 ${sharing ? "text-brand-400" : "text-slate-500"}`}
                  />
                  {sharing ? "Standort wird geteilt" : "Standort nicht geteilt"}
                  <button
                    className="ml-auto font-extrabold text-brand-300"
                    onClick={toggleLocationSharing}
                  >
                    {sharing ? "Beenden" : "Aktivieren"}
                  </button>
                </div>
              )}
              {locationError && (
                <p className="mt-2 text-[10px] text-orange-300">
                  {locationError}
                </p>
              )}
              {lastLocation && sharing && (
                <p className="mt-1 text-[10px] text-slate-500">
                  Letzter Standort: {lastLocation.lat.toFixed(4)},{" "}
                  {lastLocation.lng.toFixed(4)}
                </p>
              )}
            </div>
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[11px] font-black uppercase tracking-[.15em] text-slate-500">
                  Deine Stopps
                </p>
                <span className="text-[11px] font-bold text-slate-500">
                  {
                    route.stops.filter(
                      (stop) =>
                        workOrders.get(stop.workOrderId)?.status ===
                        "completed",
                    ).length
                  }
                  /{route.stops.length} erledigt
                </span>
              </div>
              <div className="space-y-3">
                {route.stops.map((stop) => {
                  const order = workOrders.get(stop.workOrderId);
                  const customer = customers.get(order?.customerId ?? "");
                  const current =
                    route.currentStopId === stop.workOrderId ||
                    (!route.currentStopId &&
                      activeStop?.workOrderId === stop.workOrderId);
                  const done = order?.status === "completed";
                  const issue = order?.status === "needs_followup";
                  return (
                    <div
                      key={stop.workOrderId}
                      className={`rounded-2xl border p-4 ${current ? "border-brand-500/50 bg-brand-500/10" : done ? "border-brand-500/20 bg-brand-500/5 opacity-70" : issue ? "border-orange-400/40 bg-orange-400/10" : "border-white/10 bg-white/5"}`}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl text-xs font-black ${done ? "bg-brand-500 text-white" : issue ? "bg-orange-400 text-white" : current ? "bg-white text-navy" : "bg-white/10 text-slate-300"}`}
                        >
                          {done ? (
                            <Check className="h-4 w-4" />
                          ) : issue ? (
                            <AlertCircle className="h-4 w-4" />
                          ) : (
                            stop.order
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-extrabold">
                              {customer?.name}
                            </p>
                            {current && !done && (
                              <Badge className="border-brand-400/20 bg-brand-400/10 text-brand-200">
                                Jetzt
                              </Badge>
                            )}
                            {issue && (
                              <Badge className="border-orange-400/20 bg-orange-400/10 text-orange-200">
                                Nacharbeit
                              </Badge>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-slate-400">
                            {customer?.address}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] font-bold text-slate-300">
                            <span className="flex items-center gap-1">
                              <Clock3 className="h-3.5 w-3.5 text-brand-300" />
                              {stop.eta} · {order?.timeTo}
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5 text-slate-500" />
                              {stop.distanceFromPreviousKm} km
                            </span>
                          </div>
                          {order?.notes && (
                            <p className="mt-2 rounded-lg bg-white/5 px-2 py-1.5 text-[11px] text-slate-400">
                              {order.notes}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-col gap-2">
                          {!done && (
                            <button
                              aria-label={`Navigation zu ${customer?.name ?? "Stopp"}`}
                              onClick={() => {
                                if (customer?.address)
                                  window.open(
                                    `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(customer.address)}&travelmode=driving&dir_action=navigate`,
                                    "_blank",
                                    "noopener,noreferrer",
                                  );
                              }}
                              className="rounded-lg bg-brand-500/15 p-2 text-brand-300"
                            >
                              <Navigation className="h-4 w-4" />
                            </button>
                          )}
                          {current && !done && (
                            <button
                              aria-label="Stopp erledigen"
                              onClick={() =>
                                void completeStop(stop.workOrderId)
                              }
                              className="rounded-lg bg-brand-500 p-2 text-white"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      {current && !done && (
                        <div className="mt-3 flex flex-wrap gap-2 border-t border-white/10 pt-3">
                          <button
                            onClick={() => void markArrived(stop.workOrderId)}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-white/8 py-2 text-[11px] font-extrabold text-slate-300"
                          >
                            <MapPin className="h-3.5 w-3.5" />
                            Vor Ort
                          </button>
                          <button
                            onClick={() => openReport(stop.workOrderId)}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-white/8 py-2 text-[11px] font-extrabold text-slate-300"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            Bericht
                          </button>
                          <button
                            onClick={() => void reportProblem(stop.workOrderId)}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-orange-400/10 py-2 text-[11px] font-extrabold text-orange-200"
                          >
                            <AlertCircle className="h-3.5 w-3.5" />
                            Problem
                          </button>
                          <button
                            onClick={() => void skipStop(stop.workOrderId)}
                            className="rounded-lg bg-white/8 px-3 py-2 text-slate-400"
                            aria-label="Stopp überspringen"
                          >
                            <SkipForward className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
        {!route && (
          <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-8 text-center">
            <RouteIcon className="mx-auto h-8 w-8 text-slate-600" />
            <p className="mt-3 text-sm font-bold text-slate-300">
              Keine veröffentlichte Tour für heute
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Die Disposition informiert dich, sobald eine Tour veröffentlicht
              wurde.
            </p>
          </div>
        )}
      </main>
      <div className="safe-bottom border-t border-white/10 px-4 py-4">
        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5" />
            AutomateX Route · Pilot
          </span>
          <span>v1.1</span>
        </div>
      </div>

      {reportStop && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/55 sm:items-center sm:justify-center">
          <div className="w-full max-w-[430px] rounded-t-3xl bg-[#101827] p-5 sm:rounded-3xl">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.14em] text-brand-300">
                  <Sparkles className="h-3.5 w-3.5" />
                  Wartungsbericht-Copilot
                </div>
                <h2 className="mt-2 text-lg font-extrabold">
                  {reportStep === "capture"
                    ? "Was hast du vorgefunden?"
                    : "Bericht prüfen und bestätigen"}
                </h2>
              </div>
              <button
                onClick={closeReport}
                className="rounded-lg p-2 text-slate-400"
                aria-label="Bericht schließen"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {reportStep === "capture" ? (
              <>
                <Textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="z. B. Filter stark verschmutzt, Anlage läuft aber…"
                  className="mt-5 min-h-28 border-white/10 bg-white/5 text-white placeholder:text-slate-500"
                />
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => mediaInputRef.current?.click()}
                    className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-3 text-xs font-extrabold text-slate-300"
                  >
                    <Camera className="h-4 w-4" />
                    Foto anhängen
                  </button>
                  <button
                    onClick={() => audioInputRef.current?.click()}
                    className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-3 text-xs font-extrabold text-slate-300"
                  >
                    <Mic className="h-4 w-4" />
                    Sprachnotiz
                  </button>
                  <button
                    onClick={() => setSignatureOpen(true)}
                    className={`col-span-2 flex items-center justify-center gap-2 rounded-xl border py-3 text-xs font-extrabold ${hasSignature ? "border-brand-400/30 bg-brand-400/10 text-brand-200" : "border-white/10 bg-white/5 text-slate-300"}`}
                  >
                    <FileCheck2 className="h-4 w-4" />
                    {hasSignature
                      ? "Kundenfreigabe erfasst"
                      : "Unterschrift erfassen"}
                  </button>
                </div>
                {attachments.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {attachments.map((attachment) => (
                      <span
                        key={attachment.id}
                        className="flex items-center gap-1 rounded-full bg-white/8 px-2 py-1 text-[10px] text-slate-300"
                      >
                        <Upload className="h-3 w-3" />
                        {attachment.name}
                      </span>
                    ))}
                  </div>
                )}
                {mediaError && (
                  <p className="mt-2 text-[10px] text-orange-300">
                    {mediaError}
                  </p>
                )}
                <Button
                  className="mt-4 w-full bg-brand-500 hover:bg-brand-600"
                  onClick={generateDraft}
                >
                  <Sparkles className="h-4 w-4" />
                  KI-Entwurf erzeugen
                </Button>
                <p className="mt-3 flex items-center justify-center gap-1 text-center text-[10px] text-slate-500">
                  <Lock className="h-3 w-3" />
                  Der Entwurf wird erst nach deiner Bestätigung gespeichert.
                </p>
              </>
            ) : (
              reportDraft && (
                <>
                  <div className="mt-5 rounded-xl border border-brand-400/20 bg-brand-400/10 p-3">
                    <p className="text-sm font-extrabold text-white">
                      {reportDraft.summary}
                    </p>
                    <ul className="mt-2 space-y-1 text-xs text-slate-300">
                      {reportDraft.findings.map((finding) => (
                        <li key={finding} className="flex gap-2">
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-300" />
                          {finding}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-3 text-[10px] font-black uppercase tracking-[.12em] text-brand-300">
                      Dringlichkeit: {reportDraft.urgency}
                    </p>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button
                      variant="ghost"
                      className="flex-1 bg-white/8 text-slate-300 hover:bg-white/15"
                      onClick={() => setReportStep("capture")}
                    >
                      <Pause className="h-4 w-4" />
                      Bearbeiten
                    </Button>
                    <Button
                      variant="ghost"
                      className="bg-white/8 text-slate-300 hover:bg-white/15"
                      onClick={() => window.print()}
                      aria-label="Bericht drucken"
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button
                    className="mt-3 w-full bg-brand-500 hover:bg-brand-600"
                    onClick={() => void confirmReport()}
                    disabled={reporting}
                  >
                    {reporting ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Bericht bestätigen und speichern
                  </Button>
                  <p className="mt-3 flex items-center justify-center gap-1 text-center text-[10px] text-slate-500">
                    <ShieldCheck className="h-3 w-3" />
                    Keine Folgeaufgabe wird ohne deine Bestätigung angelegt.
                  </p>
                </>
              )
            )}
          </div>
        </div>
      )}
      {signatureOpen && (
        <div className="fixed inset-0 z-[60] flex items-end bg-black/70 sm:items-center sm:justify-center">
          <div className="w-full max-w-[430px] rounded-t-3xl bg-white p-5 text-slate-900 sm:rounded-3xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold">Kundenfreigabe</h3>
              <button
                onClick={() => setSignatureOpen(false)}
                aria-label="Unterschrift schließen"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Bitte auf der Linie unterschreiben.
            </p>
            <canvas
              ref={signatureCanvasRef}
              className="mt-4 h-[150px] w-full touch-none rounded-xl border border-slate-200 bg-slate-50"
              onPointerDown={beginSignature}
              onPointerMove={drawSignature}
              onPointerUp={endSignature}
              onPointerCancel={endSignature}
            />
            <div className="mt-3 flex gap-2">
              <button
                className="flex-1 rounded-xl border border-slate-200 py-3 text-xs font-bold text-slate-600"
                onClick={() => setSignatureOpen(false)}
              >
                Abbrechen
              </button>
              <button
                className="rounded-xl border border-slate-200 px-3 py-3 text-xs font-bold text-slate-600"
                onClick={() => {
                  const canvas = signatureCanvasRef.current;
                  const context = canvas?.getContext("2d");
                  if (canvas && context) {
                    context.clearRect(0, 0, canvas.width, canvas.height);
                    context.fillStyle = "#f8fafc";
                    context.fillRect(0, 0, canvas.width, canvas.height);
                  }
                }}
              >
                Löschen
              </button>
              <button
                className="flex-1 rounded-xl bg-brand-500 py-3 text-xs font-extrabold text-white"
                onClick={applySignature}
              >
                Übernehmen
              </button>
            </div>
          </div>
        </div>
      )}
      <input
        ref={mediaInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          void handleMedia("photo", event.target.files?.[0]);
          event.currentTarget.value = "";
        }}
      />
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*"
        capture
        className="hidden"
        onChange={(event) => {
          void handleMedia("audio", event.target.files?.[0]);
          event.currentTarget.value = "";
        }}
      />
    </div>
  );
}
