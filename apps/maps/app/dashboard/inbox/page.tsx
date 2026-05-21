"use client";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { geocode } from "@/lib/routing";

interface QueueItem {
  id: string; sender: string; subject: string; body_excerpt: string;
  ai_intent: string; ai_confidence: number;
  ai_extracted: {
    customer_name: string | null; address: string | null;
    date: string | null; time_from: string | null; time_to: string | null;
    priority: number; notes: string | null; reasoning: string;
  };
  status: string; received_at: string;
}

const INTENT_LABELS: Record<string, { label: string; color: string }> = {
  new_appointment: { label: "Neuer Termin", color: "var(--green)" },
  cancellation: { label: "Absage", color: "var(--rose)" },
  reschedule: { label: "Verschiebung", color: "var(--blue)" },
  urgent_request: { label: "Dringend", color: "#ef6c00" },
  other: { label: "Sonstiges", color: "var(--muted)" }
};

export default function InboxPage() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const sb = createClient();

  const load = useCallback(async () => {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    const { data: member } = await sb.from("org_members").select("org_id").eq("user_id", user.id).single();
    if (!member) return;
    setOrgId(member.org_id);
    const { data } = await sb.from("email_queue").select("*")
      .eq("org_id", member.org_id).eq("status", "pending")
      .order("received_at", { ascending: false });
    setItems((data ?? []) as QueueItem[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function approve(item: QueueItem) {
    if (!orgId) return;
    const e = item.ai_extracted;
    if (!e.customer_name || !e.address) {
      alert("KI hat keinen Kundennamen oder Adresse extrahiert. Bitte manuell anlegen.");
      return;
    }
    setProcessing(item.id);
    const coords = await geocode(e.address);
    const { data: stop, error } = await sb.from("stops").insert({
      org_id: orgId,
      name: e.customer_name, address: e.address,
      lat: coords?.lat ?? null, lng: coords?.lng ?? null,
      time_from: e.time_from, time_to: e.time_to,
      notes: e.notes, priority: e.priority,
      scheduled_date: e.date ?? new Date().toISOString().split("T")[0],
      status: "pending"
    }).select().single();
    if (error) { alert("Fehler: " + error.message); setProcessing(null); return; }
    await sb.from("email_queue").update({ status: "created", created_stop_id: stop.id }).eq("id", item.id);
    setItems(items.filter(x => x.id !== item.id));
    setProcessing(null);
  }

  async function ignore(item: QueueItem) {
    await sb.from("email_queue").update({ status: "ignored" }).eq("id", item.id);
    setItems(items.filter(x => x.id !== item.id));
  }

  return (
    <>
      <div className="page-header" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div className="section-kicker">KI-Inbox</div>
          <h1>Email-Vorschläge prüfen</h1>
          <p>Die KI hat folgende Emails als relevant erkannt. Annehmen → wird zu Stop.</p>
        </div>
        <button className="btn ghost" onClick={load}>🔄 Neu laden</button>
      </div>

      {loading ? (
        <div style={{ color: "var(--muted)", padding: 40, textAlign: "center" }}>Lädt…</div>
      ) : items.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 48, color: "var(--muted)" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
          <strong>Keine offenen Email-Vorschläge</strong>
          <p style={{ margin: "8px 0 0" }}>
            Synchronisiere Gmail unter <a href="/dashboard/settings" style={{ color: "var(--green-dark)", fontWeight: 700 }}>Einstellungen</a>.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {items.map(item => {
            const intent = INTENT_LABELS[item.ai_intent] ?? INTENT_LABELS.other;
            const e = item.ai_extracted;
            return (
              <div key={item.id} className="card">
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
                  <span style={{ background: intent.color, color: "white", padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 800 }}>
                    {intent.label}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>
                    KI-Konfidenz: {Math.round(item.ai_confidence * 100)}%
                  </span>
                  <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: "auto" }}>
                    {new Date(item.received_at).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 13, color: "var(--muted)" }}>{item.sender}</div>
                  <div style={{ fontWeight: 800, fontSize: 15, margin: "2px 0 6px" }}>{item.subject}</div>
                  <div style={{ fontSize: 13, color: "var(--text)", background: "var(--soft)", padding: 10, borderRadius: 10, fontStyle: "italic" }}>
                    „{item.body_excerpt.slice(0, 250)}{item.body_excerpt.length > 250 ? "…" : ""}"
                  </div>
                </div>

                <div style={{ background: "rgba(22,182,127,.06)", border: "1px solid rgba(22,182,127,.2)", borderRadius: 12, padding: 14, marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "var(--green-dark)", marginBottom: 8, letterSpacing: ".08em", textTransform: "uppercase" }}>
                    KI-Extraktion
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px,1fr))", gap: 10, fontSize: 13 }}>
                    <div><b>Kunde:</b> {e.customer_name ?? "—"}</div>
                    <div><b>Adresse:</b> {e.address ?? "—"}</div>
                    <div><b>Datum:</b> {e.date ?? "heute"}</div>
                    <div><b>Zeit:</b> {e.time_from ?? "—"}{e.time_to ? `–${e.time_to}` : ""}</div>
                  </div>
                  {e.notes && <div style={{ fontSize: 13, marginTop: 8 }}><b>Notiz:</b> {e.notes}</div>}
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 10, fontStyle: "italic" }}>
                    💭 {e.reasoning}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn green" onClick={() => approve(item)} disabled={processing === item.id}>
                    {processing === item.id ? "⏳ Lege an…" : "✓ Als Stop übernehmen"}
                  </button>
                  <button className="btn ghost" onClick={() => ignore(item)}>Ignorieren</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
