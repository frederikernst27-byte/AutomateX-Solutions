"use client";
import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Integration { id: string; email_address: string; last_synced_at: string | null; }

export default function SettingsPage() {
  const params = useSearchParams();
  const [integration, setIntegration] = useState<Integration | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const sb = createClient();

  const load = useCallback(async () => {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    const { data: member } = await sb.from("org_members").select("org_id").eq("user_id", user.id).single();
    if (!member) return;
    const { data } = await sb.from("gmail_integrations").select("id, email_address, last_synced_at").eq("org_id", member.org_id).maybeSingle();
    setIntegration(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function syncNow() {
    setSyncing(true); setSyncResult(null);
    const res = await fetch("/api/gmail/sync", { method: "POST" });
    const data = await res.json();
    setSyncing(false);
    if (data.ok) {
      setSyncResult(`✓ ${data.queued} relevante Email(s) in der Inbox, ${data.skipped} bereits bekannt`);
      load();
    } else {
      setSyncResult(`✗ Fehler: ${data.error}${data.details ? " – " + data.details : ""}`);
    }
  }

  async function disconnect() {
    if (!integration || !confirm("Gmail wirklich trennen?")) return;
    await sb.from("gmail_integrations").delete().eq("id", integration.id);
    setIntegration(null);
  }

  const connected = params.get("connected") === "1";
  const error = params.get("error");

  return (
    <>
      <div className="page-header">
        <div className="section-kicker">Einstellungen</div>
        <h1>Integrationen</h1>
        <p>Verknüpfe externe Dienste mit deinem Betrieb</p>
      </div>

      {connected && <div className="success-msg">✓ Gmail erfolgreich verbunden.</div>}
      {error && <div className="error-msg">Fehler: {error}</div>}

      <div className="card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ fontSize: 32 }}>📧</div>
            <div>
              <strong style={{ fontSize: 16 }}>Gmail-Integration</strong>
              <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>
                {loading ? "Lädt…" : integration
                  ? <>Verbunden mit <b>{integration.email_address}</b>{integration.last_synced_at && ` · zuletzt synct. ${new Date(integration.last_synced_at).toLocaleString("de-DE")}`}</>
                  : "Lass die KI eingehende Emails analysieren und Termine vorschlagen"
                }
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            {!integration ? (
              <a className="btn green" href="/api/gmail/auth">🔗 Gmail verbinden</a>
            ) : (
              <>
                <button className="btn green sm" onClick={syncNow} disabled={syncing}>
                  {syncing ? "⏳ Synchronisiert…" : "🔄 Jetzt synchronisieren"}
                </button>
                <button className="btn ghost sm" onClick={disconnect}>Trennen</button>
              </>
            )}
          </div>
        </div>

        {syncResult && <div style={{ marginTop: 14, fontSize: 13, color: syncResult.startsWith("✓") ? "var(--green-dark)" : "var(--rose)" }}>{syncResult}</div>}

        {integration && (
          <div style={{ marginTop: 16, padding: 12, background: "var(--soft)", borderRadius: 10, fontSize: 12, color: "var(--muted)" }}>
            💡 Klicke „Synchronisieren" oder gehe zur <a href="/dashboard/inbox" style={{ color: "var(--green-dark)", fontWeight: 700 }}>Inbox</a> um KI-vorgeschlagene Termine zu prüfen.
          </div>
        )}
      </div>
    </>
  );
}
