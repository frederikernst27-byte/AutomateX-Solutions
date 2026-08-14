"use client";

import { useEffect, useState } from "react";
import { Archive, Check, ChevronRight, Link2, Mail, RefreshCw, Sparkles, Unplug, X } from "lucide-react";
import { AdminContent, TopBar } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDemoStore } from "@/lib/demo-store";
import type { InboxItem } from "@/lib/types";

interface GmailStatus {
  configured: boolean;
  connected: boolean;
  email?: string | null;
  status?: string;
  lastSyncedAt?: string | null;
  lastError?: string | null;
  aiConfigured?: boolean;
  items?: InboxItem[];
  missingConfiguration?: string[];
}

export default function InboxPage() {
  const { state, hydrate, updateInbox, updateWorkOrder, notify } = useDemoStore();
  const [selectedId, setSelectedId] = useState<string>();
  const [gmail, setGmail] = useState<GmailStatus>();
  const [syncing, setSyncing] = useState(false);
  const selected = state.inbox.find((item) => item.id === selectedId);

  const loadStatus = async () => {
    const response = await fetch("/api/integrations/gmail", { credentials: "same-origin", cache: "no-store" });
    if (!response.ok) return;
    const status = await response.json() as GmailStatus;
    setGmail(status);
    if (status.items) {
      const localOnly = state.inbox.filter((item) => !item.providerMessageId);
      hydrate({ inbox: [...status.items, ...localOnly] });
      setSelectedId((current) => current ?? status.items?.[0]?.id);
    }
  };

  useEffect(() => { void loadStatus(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const sync = async () => {
    setSyncing(true);
    try {
      const response = await fetch("/api/integrations/gmail", { method: "POST", credentials: "same-origin" });
      const body = await response.json().catch(() => ({})) as { imported?: number; error?: string };
      if (!response.ok) throw new Error(body.error || "Gmail-Synchronisierung fehlgeschlagen");
      await loadStatus();
      notify("Gmail synchronisiert", `${body.imported ?? 0} neue Nachricht${body.imported === 1 ? "" : "en"} durch die KI bewertet.`, "success");
    } catch (error) { notify("Synchronisierung fehlgeschlagen", error instanceof Error ? error.message : "Bitte Verbindung prüfen.", "warning"); }
    finally { setSyncing(false); }
  };

  const apply = async (action: "apply" | "ignore") => {
    if (!selected) return;
    const actionStatus = action === "apply" ? "applied" : "ignored";
    if (selected.providerMessageId) {
      const response = await fetch("/api/integrations/gmail", { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ providerMessageId: selected.providerMessageId, actionStatus }) });
      if (!response.ok) { notify("Status nicht gespeichert", "Die Gmail-Entscheidung konnte nicht gespeichert werden.", "warning"); return; }
    }
    updateInbox(selected.id, { actionStatus });
    if (action === "apply" && selected.workOrderId) {
      const nextStatus = selected.intent === "cancel" ? "cancelled" : selected.intent === "confirm" ? "confirmed" : "offered";
      updateWorkOrder(selected.workOrderId, { status: nextStatus });
      try {
        const response = await fetch("/api/work-orders", { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ id: selected.workOrderId, status: nextStatus }) });
        // 409 is the expected demo-adapter response; only a real failure matters.
        if (!response.ok && response.status !== 409) throw new Error();
      } catch {
        notify("Status nicht gespeichert", "Der Auftragsstatus konnte nicht dauerhaft aktualisiert werden.", "warning");
        return;
      }
    }
    notify(action === "apply" ? "KI-Vorschlag übernommen" : "Nachricht archiviert", action === "apply" ? "Die Änderung wurde gespeichert und protokolliert." : "Die Nachricht bleibt im Archiv.", action === "apply" ? "success" : "info");
  };

  return <><TopBar eyebrow="KI & Kommunikation" title="KI-Inbox" description="Gmail-Nachrichten werden von der konfigurierten echten KI bewertet und als prüfbare Aktionen vorgeschlagen." actions={gmail?.connected ? <Button variant="outline" onClick={() => void sync()} disabled={syncing || !gmail.aiConfigured}><RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />{syncing ? "Synchronisiere…" : "Jetzt synchronisieren"}</Button> : <Button onClick={() => { window.location.href = "/api/integrations/gmail/connect"; }} disabled={gmail?.configured === false} title={gmail?.configured === false ? "Google OAuth muss zuerst konfiguriert werden." : undefined}><Link2 className="h-4 w-4" />{gmail?.configured === false ? "Gmail konfigurieren" : "Gmail verbinden"}</Button>} /><AdminContent>
    <Card className={`mb-5 ${gmail?.connected ? "border-brand-100 bg-brand-50/40" : gmail?.configured === false ? "border-amber-200 bg-amber-50/40" : "border-line"}`}><CardContent className="flex flex-wrap items-center gap-4 p-4"><span className={`grid h-10 w-10 place-items-center rounded-xl ${gmail?.connected ? "bg-brand-100 text-brand-700" : gmail?.configured === false ? "bg-amber-100 text-amber-700" : "bg-soft text-muted"}`}><Mail className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="text-sm font-extrabold">{gmail?.connected ? `Gmail verbunden: ${gmail.email}` : gmail?.configured === false ? "Gmail muss noch eingerichtet werden" : "Gmail nicht verbunden"}</p><p className="mt-1 text-xs text-muted">{gmail?.connected ? `Letzte Synchronisierung: ${gmail.lastSyncedAt ? formatTimestamp(gmail.lastSyncedAt) : "noch ausstehend"} · Automatisch alle ${process.env.NEXT_PUBLIC_GMAIL_SYNC_LABEL ?? "5 Minuten"}` : gmail?.configured === false ? "Hinterlege die unten genannten Werte in .env.local und starte die App neu." : "OAuth-Zugang und verschlüsselte Tokenablage erforderlich."}</p>{gmail?.configured === false && <p className="mt-2 rounded-lg bg-white/80 px-3 py-2 font-mono text-[11px] font-bold text-amber-900">Fehlt: {(gmail.missingConfiguration ?? []).join(" · ") || "Google OAuth-Konfiguration"}</p>}{gmail?.lastError && <p className="mt-1 text-xs font-bold text-rose-700">{gmail.lastError}</p>}{gmail?.connected && !gmail.aiConfigured && <p className="mt-1 text-xs font-bold text-orange-700">AI_API_KEY und AI_MODEL fehlen. E-Mails werden nicht ohne echte KI klassifiziert.</p>}</div>{gmail?.connected && <Button variant="ghost" size="sm" onClick={async () => { await fetch("/api/integrations/gmail", { method: "DELETE", credentials: "same-origin" }); await loadStatus(); }}><Unplug className="h-4 w-4" />Trennen</Button>}</CardContent></Card>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]"><Card><CardHeader className="flex-row items-center justify-between"><div><div className="flex items-center gap-2"><CardTitle>Erkannte Nachrichten</CardTitle><Badge>{state.inbox.filter((item) => item.actionStatus === "pending").length} offen</Badge></div><p className="mt-1 text-sm text-muted">Keine Nachricht verändert ohne deine Bestätigung einen Auftrag.</p></div><Sparkles className="h-4 w-4 text-brand-700" /></CardHeader><CardContent className="space-y-2">{state.inbox.map((item) => <button key={item.id} onClick={() => setSelectedId(item.id)} className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left ${selectedId === item.id ? "border-brand-200 bg-brand-50/50" : "border-line"}`}><Mail className="mt-1 h-4 w-4 shrink-0 text-brand-700" /><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="truncate text-xs font-extrabold">{item.subject}</span><Badge variant={item.intent === "confirm" ? "default" : item.intent === "reschedule" || item.intent === "cancel" ? "warning" : "muted"}>{intentLabel(item.intent)}</Badge></span><span className="mt-1 block truncate text-[11px] text-muted">{item.sender} · {formatTimestamp(item.receivedAt)}</span><span className="mt-2 block line-clamp-2 text-xs leading-5 text-muted">{item.excerpt}</span></span><span className="flex shrink-0 items-center text-[10px] font-black text-brand-700">{Math.round(item.confidence * 100)}%<ChevronRight className="h-3.5 w-3.5" /></span></button>)}{state.inbox.length === 0 && <p className="py-12 text-center text-sm text-muted">Noch keine E-Mails durch die KI bewertet.</p>}</CardContent></Card>
      {selected ? <Card><CardHeader><div className="flex items-center justify-between"><Badge>KI-Vorschlag · {Math.round(selected.confidence * 100)}%</Badge><button onClick={() => setSelectedId(undefined)}><X className="h-4 w-4 text-muted" /></button></div><CardTitle className="mt-4">{selected.subject}</CardTitle><p className="mt-1 text-xs text-muted">Von {selected.sender} · {formatTimestamp(selected.receivedAt)}</p></CardHeader><CardContent><div className="rounded-xl bg-soft p-4 text-sm leading-7">{selected.excerpt}</div><div className="mt-5 rounded-xl border border-brand-100 bg-brand-50 p-4"><p className="text-xs font-extrabold text-brand-900">Vorgeschlagene Aktion</p><p className="mt-1 text-sm font-bold text-brand-800">{actionDescription(selected.intent)}</p>{selected.aiReason && <p className="mt-2 text-[11px] leading-5 text-brand-800/70">KI-Begründung: {selected.aiReason}</p>}{!selected.workOrderId && <p className="mt-2 text-[11px] font-bold text-orange-700">Keinem Auftrag sicher zugeordnet – manuelle Prüfung erforderlich.</p>}</div><div className="mt-5 flex gap-2"><Button className="flex-1" onClick={() => void apply("apply")} disabled={selected.actionStatus !== "pending" || !selected.workOrderId || selected.intent === "unknown"}><Check className="h-4 w-4" />Übernehmen</Button><Button variant="outline" onClick={() => void apply("ignore")} disabled={selected.actionStatus !== "pending"}><Archive className="h-4 w-4" />Archivieren</Button></div></CardContent></Card> : <Card><CardContent className="p-10 text-center text-muted">Nachricht auswählen</CardContent></Card>}
    </div>
  </AdminContent></>;
}

function formatTimestamp(value: string) { const date = new Date(value); return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" }).format(date) : value; }
function intentLabel(intent: string) { return intent === "confirm" ? "Bestätigung" : intent === "cancel" ? "Absage" : intent === "reschedule" ? "Verschiebung" : "Prüfung"; }
function actionDescription(intent: string) { return intent === "confirm" ? "Termin als bestätigt markieren." : intent === "cancel" ? "Auftrag absagen und die Tour neu prüfen." : intent === "reschedule" ? "Auftrag zur Terminverschiebung markieren." : "Nachricht manuell prüfen; keine automatische Aktion."; }
