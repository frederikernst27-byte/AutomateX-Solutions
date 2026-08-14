"use client";

import { useEffect, useState } from "react";
import { History, RefreshCw, Search } from "lucide-react";
import { AdminContent, TopBar } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { AuditEvent } from "@/lib/types";

export default function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const load = async () => { setLoading(true); try { const response = await fetch("/api/audit?limit=250", { credentials: "same-origin", cache: "no-store" }); const payload = response.ok ? await response.json() as { events?: AuditEvent[] } : undefined; setEvents(payload?.events ?? []); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, []);
  const filtered = events.filter((event) => `${event.action} ${event.entityType ?? ""} ${event.entityId ?? ""}`.toLowerCase().includes(query.toLowerCase()));
  return <><TopBar eyebrow="Nachvollziehbarkeit" title="Vorgangsprotokoll" description="Alle Änderungen an Planung, Aufträgen, Fahrern und Standorten." actions={<Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className="h-4 w-4" />Aktualisieren</Button>} /><AdminContent><Card><CardContent className="p-4"><div className="mb-4 relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Aktion, Vorgang oder ID suchen" className="pl-9" /></div>{filtered.length ? <div className="divide-y divide-line">{filtered.map((event) => <div key={event.id} className="flex gap-3 py-4"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700"><History className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="text-sm font-extrabold">{event.action}</p><p className="mt-0.5 text-xs text-muted">{event.entityType ?? "Vorgang"}{event.entityId ? ` · ${event.entityId}` : ""}</p></div><time className="shrink-0 text-right text-[11px] font-bold text-muted">{new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" }).format(new Date(event.createdAt))}</time></div>)}</div> : <div className="py-12 text-center text-sm text-muted">{loading ? "Lade Vorgänge…" : "Noch keine protokollierten Vorgänge."}</div>}</CardContent></Card></AdminContent></>;
}
