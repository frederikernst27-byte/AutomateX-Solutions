"use client";
import { useEffect, useState, useCallback } from "react";
import Script from "next/script";
import { createClient } from "@/lib/supabase/client";

interface Integration { id: string; email_address: string; last_synced_at: string | null; }
interface TokenResponse { access_token?: string; error?: string; }

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: TokenResponse) => void;
          }) => { requestAccessToken: (options?: { prompt?: string }) => void };
          revoke: (token: string) => void;
        };
      };
    };
  }
}

const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const CLIENT_ID_KEY = "automatex_gmail_client_id";
const ACCESS_TOKEN_KEY = "automatex_gmail_access_token";
const EMAIL_KEY = "automatex_gmail_email";

export default function SettingsPage() {
  const [integration, setIntegration] = useState<Integration | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [clientId, setClientId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [gmailEmail, setGmailEmail] = useState("");
  const [scriptReady, setScriptReady] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const sb = createClient();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setConnected(params.get("connected") === "1");
    setUrlError(params.get("error"));
    const storedToken = localStorage.getItem(ACCESS_TOKEN_KEY) ?? "";
    const storedEmail = localStorage.getItem(EMAIL_KEY) ?? "";
    setClientId(localStorage.getItem(CLIENT_ID_KEY) ?? "");
    setAccessToken(storedToken);
    setGmailEmail(storedEmail);
    setConnected(Boolean(storedToken));
  }, []);

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

  async function syncNow(token = accessToken) {
    if (!token) {
      setSyncResult("✗ Bitte zuerst Gmail verbinden.");
      return;
    }
    setSyncing(true); setSyncResult(null);
    const res = await fetch("/api/gmail/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: token })
    });
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
    if (!confirm("Gmail wirklich trennen?")) return;
    if (accessToken && window.google) window.google.accounts.oauth2.revoke(accessToken);
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(EMAIL_KEY);
    setAccessToken("");
    setGmailEmail("");
    setConnected(false);
    setSyncResult(null);
    if (integration) await sb.from("gmail_integrations").delete().eq("id", integration.id);
    setIntegration(null);
  }

  async function loadGmailProfile(token: string) {
    const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return "";
    const profile = await res.json() as { emailAddress?: string };
    return profile.emailAddress ?? "";
  }

  function connectGmail() {
    const id = clientId.trim();
    if (!id) {
      setSyncResult("✗ Bitte zuerst deine Google OAuth Client ID eintragen.");
      return;
    }
    if (!window.google || !scriptReady) {
      setSyncResult("✗ Google Login ist noch nicht geladen. Bitte kurz warten.");
      return;
    }
    localStorage.setItem(CLIENT_ID_KEY, id);
    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: id,
      scope: GMAIL_SCOPE,
      callback: async response => {
        if (response.error || !response.access_token) {
          setSyncResult(`✗ Gmail Login fehlgeschlagen: ${response.error ?? "kein Token"}`);
          return;
        }
        localStorage.setItem(ACCESS_TOKEN_KEY, response.access_token);
        setAccessToken(response.access_token);
        setConnected(true);
        const email = await loadGmailProfile(response.access_token);
        if (email) {
          localStorage.setItem(EMAIL_KEY, email);
          setGmailEmail(email);
        }
        setSyncResult("✓ Gmail verbunden. Du kannst jetzt synchronisieren.");
      }
    });
    tokenClient.requestAccessToken({ prompt: "consent" });
  }

  return (
    <>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={() => setScriptReady(true)} />

      <div className="page-header">
        <div className="section-kicker">Einstellungen</div>
        <h1>Integrationen</h1>
        <p>Verknüpfe externe Dienste mit deinem Betrieb</p>
      </div>

      {connected && <div className="success-msg">✓ Gmail erfolgreich verbunden.</div>}
      {urlError && <div className="error-msg">Fehler: {urlError}</div>}

      <div className="card">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ fontSize: 32 }}>📧</div>
            <div>
              <strong style={{ fontSize: 16 }}>Gmail-Integration</strong>
              <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>
                {loading ? "Lädt…" : connected
                  ? <>Verbunden{gmailEmail ? <> mit <b>{gmailEmail}</b></> : ""}{integration?.last_synced_at && ` · zuletzt synct. ${new Date(integration.last_synced_at).toLocaleString("de-DE")}`}</>
                  : integration
                  ? <>Verbunden mit <b>{integration.email_address}</b>{integration.last_synced_at && ` · zuletzt synct. ${new Date(integration.last_synced_at).toLocaleString("de-DE")}`}</>
                  : "Lass die KI eingehende Emails analysieren und Termine vorschlagen"
                }
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {!connected ? (
              <button className="btn green" type="button" onClick={connectGmail} disabled={!scriptReady}>🔗 Gmail verbinden</button>
            ) : (
              <>
                <button className="btn green sm" onClick={() => syncNow()} disabled={syncing}>
                  {syncing ? "⏳ Synchronisiert…" : "🔄 Jetzt synchronisieren"}
                </button>
                <button className="btn ghost sm" onClick={disconnect}>Trennen</button>
              </>
            )}
          </div>
        </div>

        {!connected && (
          <div style={{ marginTop: 18, display: "grid", gap: 8, maxWidth: 620 }}>
            <label style={{ fontSize: 13, fontWeight: 800, color: "var(--ink)" }} htmlFor="gmail-client-id">
              Google OAuth Client ID
            </label>
            <input
              id="gmail-client-id"
              value={clientId}
              onChange={event => setClientId(event.target.value)}
              placeholder="1234567890-abc.apps.googleusercontent.com"
              style={{ width: "100%", padding: "10px 14px", border: "1.5px solid var(--line)", borderRadius: 10, background: "var(--soft)" }}
            />
            <div style={{ fontSize: 12, color: "var(--muted)" }}>
              In Google Cloud muss diese Website als autorisierte JavaScript-Quelle eingetragen sein, z. B. http://127.0.0.1:3001 oder deine Deployment-Domain.
            </div>
          </div>
        )}

        {syncResult && <div style={{ marginTop: 14, fontSize: 13, color: syncResult.startsWith("✓") ? "var(--green-dark)" : "var(--rose)" }}>{syncResult}</div>}

        {(connected || integration) && (
          <div style={{ marginTop: 16, padding: 12, background: "var(--soft)", borderRadius: 10, fontSize: 12, color: "var(--muted)" }}>
            💡 Klicke „Synchronisieren" oder gehe zur <a href="/dashboard/inbox" style={{ color: "var(--green-dark)", fontWeight: 700 }}>Inbox</a> um KI-vorgeschlagene Termine zu prüfen.
          </div>
        )}
      </div>
    </>
  );
}
