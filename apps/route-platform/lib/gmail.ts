import { createHmac, timingSafeEqual } from "node:crypto";
import { classifyEmailWithAi } from "./ai";
import { getGmailConnection, knownGmailMessageIds, listGmailWorkOrderCandidates, recordGmailSyncAudit, saveGmailInboxItem, updateGmailSyncStatus } from "./gmail-store";
import { recordDemoAudit, serverDemoState } from "./server-demo";
import type { InboxItem } from "./types";

const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

export function gmailOAuthConfigured() {
  return Boolean(process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET && (process.env.GMAIL_REDIRECT_URI || process.env.NEXT_PUBLIC_APP_URL));
}

export function missingGmailConfiguration() {
  return [
    !process.env.GMAIL_CLIENT_ID && "GMAIL_CLIENT_ID",
    !process.env.GMAIL_CLIENT_SECRET && "GMAIL_CLIENT_SECRET",
    !(process.env.GMAIL_REDIRECT_URI || process.env.NEXT_PUBLIC_APP_URL) && "GMAIL_REDIRECT_URI",
    (!process.env.INTEGRATION_ENCRYPTION_KEY || process.env.INTEGRATION_ENCRYPTION_KEY.length < 32) && "INTEGRATION_ENCRYPTION_KEY",
  ].filter((value): value is string => Boolean(value));
}

function credentials() {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const redirectUri = process.env.GMAIL_REDIRECT_URI || (appUrl ? `${appUrl.replace(/\/$/, "")}/api/integrations/gmail/callback` : undefined);
  if (!clientId || !clientSecret || !redirectUri) throw new Error("GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET und NEXT_PUBLIC_APP_URL/GMAIL_REDIRECT_URI sind erforderlich");
  return { clientId, clientSecret, redirectUri };
}

function oauthStateSecret() {
  const secret = process.env.AUTH_SECRET || process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET oder INTEGRATION_ENCRYPTION_KEY muss mindestens 32 Zeichen lang sein");
  return secret;
}

function encode(value: unknown) { return Buffer.from(JSON.stringify(value), "utf8").toString("base64url"); }
function sign(value: string) { return createHmac("sha256", oauthStateSecret()).update(value).digest("base64url"); }

export function createGmailOAuthState(input: { orgId: string; userId: string }) {
  const payload = encode({ ...input, nonce: crypto.randomUUID(), exp: Date.now() + 10 * 60_000 });
  return `${payload}.${sign(payload)}`;
}

export function parseGmailOAuthState(state: string): { orgId: string; userId: string } | null {
  const [payload, supplied] = state.split(".");
  if (!payload || !supplied) return null;
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(supplied);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { orgId?: string; userId?: string; exp?: number };
    if (!parsed.orgId || !parsed.userId || !parsed.exp || parsed.exp < Date.now()) return null;
    return { orgId: parsed.orgId, userId: parsed.userId };
  } catch { return null; }
}

export function gmailAuthorizationUrl(state: string) {
  const { clientId, redirectUri } = credentials();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", `${GMAIL_SCOPE} https://www.googleapis.com/auth/userinfo.email`);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);
  return url.toString();
}

async function tokenRequest(params: URLSearchParams) {
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: params, signal: AbortSignal.timeout(20_000) });
  const payload = await response.json().catch(() => ({})) as { access_token?: string; refresh_token?: string; scope?: string; error?: string };
  if (!response.ok || !payload.access_token) throw new Error(payload.error || `Google OAuth fehlgeschlagen (${response.status})`);
  return payload;
}

export async function exchangeGmailCode(code: string) {
  const { clientId, clientSecret, redirectUri } = credentials();
  return tokenRequest(new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }));
}

async function refreshAccessToken(refreshToken: string) {
  const { clientId, clientSecret } = credentials();
  return tokenRequest(new URLSearchParams({ refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret, grant_type: "refresh_token" }));
}

async function gmailFetch<T>(accessToken: string, path: string): Promise<T> {
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`Gmail API fehlgeschlagen (${response.status})`);
  return response.json() as Promise<T>;
}

export async function getGmailProfile(accessToken: string) {
  return gmailFetch<{ emailAddress: string }>(accessToken, "profile");
}

export async function revokeGmailToken(refreshToken: string) {
  await fetch("https://oauth2.googleapis.com/revoke", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token: refreshToken }), signal: AbortSignal.timeout(20_000) });
}

interface GmailPart { mimeType?: string; body?: { data?: string }; parts?: GmailPart[] }
interface GmailMessage { id: string; threadId?: string; internalDate?: string; snippet?: string; payload?: GmailPart & { headers?: Array<{ name: string; value: string }> } }

function decodeBase64Url(value: string) { return Buffer.from(value, "base64url").toString("utf8"); }
function stripHtml(value: string) { return value.replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim(); }

export function gmailMessageBody(part?: GmailPart): string {
  if (!part) return "";
  const find = (current: GmailPart, mimeType: string): string | undefined => {
    if (current.mimeType === mimeType && current.body?.data) return current.body.data;
    for (const child of current.parts ?? []) { const found = find(child, mimeType); if (found) return found; }
    return undefined;
  };
  const plain = find(part, "text/plain");
  if (plain) return decodeBase64Url(plain).trim();
  const html = find(part, "text/html");
  if (html) return stripHtml(decodeBase64Url(html));
  return "";
}

function header(message: GmailMessage, name: string) { return message.payload?.headers?.find((item) => item.name.toLowerCase() === name.toLowerCase())?.value ?? ""; }

export async function syncGmailOrg(orgId: string) {
  const connection = await getGmailConnection(orgId);
  if (!connection || connection.status === "disconnected") throw new Error("Gmail ist für diese Organisation nicht verbunden");
  try {
    const token = await refreshAccessToken(connection.refreshToken);
    const days = Math.min(Math.max(Number(process.env.GMAIL_LOOKBACK_DAYS ?? 7), 1), 30);
    const maxResults = Math.min(Math.max(Number(process.env.GMAIL_MAX_MESSAGES_PER_SYNC ?? 25), 1), 100);
    const query = encodeURIComponent(`in:inbox newer_than:${days}d -in:spam -in:trash`);
    const list = await gmailFetch<{ messages?: Array<{ id: string }> }>(token.access_token!, `messages?maxResults=${maxResults}&q=${query}`);
    const ids = (list.messages ?? []).map((item) => item.id);
    const known = await knownGmailMessageIds(orgId, ids);
    const newIds = ids.filter((id) => !known.has(id));
    const candidates = await listGmailWorkOrderCandidates(orgId);
    const imported: InboxItem[] = [];
    for (const id of newIds) {
      const message = await gmailFetch<GmailMessage>(token.access_token!, `messages/${encodeURIComponent(id)}?format=full`);
      const sender = header(message, "From").slice(0, 320) || "Unbekannter Absender";
      const subject = header(message, "Subject").slice(0, 500) || "Ohne Betreff";
      const body = (gmailMessageBody(message.payload) || message.snippet || "").slice(0, 20_000);
      const decision = await classifyEmailWithAi({ sender, subject, body, candidates });
      const receivedAtIso = message.internalDate ? new Date(Number(message.internalDate)).toISOString() : new Date().toISOString();
      const item: InboxItem = {
        id: `gmail-${message.id}`,
        providerMessageId: message.id,
        sender,
        subject,
        excerpt: body.slice(0, 500),
        intent: decision.intent,
        confidence: decision.confidence,
        aiReason: decision.reason,
        workOrderId: decision.workOrderId ?? undefined,
        receivedAt: receivedAtIso,
        actionStatus: "pending",
      };
      await saveGmailInboxItem(orgId, { ...item, threadId: message.threadId, receivedAtIso });
      imported.push(item);
    }
    if (imported.length) {
      const existing = new Set(serverDemoState.inbox.map((item) => item.providerMessageId).filter(Boolean));
      serverDemoState.inbox = [...imported.filter((item) => !existing.has(item.providerMessageId)), ...serverDemoState.inbox];
      serverDemoState.lastUpdated = new Date().toISOString();
    }
    await updateGmailSyncStatus(orgId, { lastSyncedAt: new Date().toISOString(), lastError: null, status: "active" });
    await recordGmailSyncAudit(orgId, { email: connection.googleEmail, checked: ids.length, imported: imported.length });
    recordDemoAudit({ action: "gmail.synced", entityType: "gmail", entityId: connection.googleEmail, before: null, after: { checked: ids.length, imported: imported.length } });
    return { checked: ids.length, imported: imported.length, items: imported };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await updateGmailSyncStatus(orgId, { lastError: message, ...(message.includes("invalid_grant") ? { status: "reauthorization_required" as const } : {}) }).catch(() => undefined);
    throw error;
  }
}
