// Lightweight Gmail API client – uses fetch, no googleapis dependency
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

export function getAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/gmail/callback`,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: "https://www.googleapis.com/auth/gmail.readonly email",
    state
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeCode(code: string) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/gmail/callback`,
      grant_type: "authorization_code"
    })
  });
  if (!res.ok) throw new Error(`token exchange failed: ${await res.text()}`);
  return res.json() as Promise<{ access_token: string; refresh_token: string; expires_in: number; id_token?: string }>;
}

export async function refreshAccessToken(refreshToken: string) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token"
    })
  });
  if (!res.ok) throw new Error(`refresh failed: ${await res.text()}`);
  return res.json() as Promise<{ access_token: string; expires_in: number }>;
}

export async function fetchEmail(messageId: string, accessToken: string) {
  const res = await fetch(`${GMAIL_API}/messages/${messageId}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) throw new Error(`fetch email ${messageId} failed`);
  return res.json();
}

export async function listRecentMessages(accessToken: string, query = "newer_than:7d") {
  const res = await fetch(`${GMAIL_API}/messages?q=${encodeURIComponent(query)}&maxResults=20`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) throw new Error("list messages failed");
  return res.json() as Promise<{ messages?: Array<{ id: string; threadId: string }> }>;
}

export async function getUserProfile(accessToken: string) {
  const res = await fetch(`${GMAIL_API}/profile`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) throw new Error("profile failed");
  return res.json() as Promise<{ emailAddress: string }>;
}

export function extractEmailContent(message: { payload?: { headers?: Array<{ name: string; value: string }>; parts?: unknown[]; body?: { data?: string }; mimeType?: string } }) {
  const headers = message.payload?.headers ?? [];
  const subject = headers.find(h => h.name.toLowerCase() === "subject")?.value ?? "";
  const from = headers.find(h => h.name.toLowerCase() === "from")?.value ?? "";
  const date = headers.find(h => h.name.toLowerCase() === "date")?.value ?? "";

  function decodeBody(data: string) {
    try { return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"); }
    catch { return ""; }
  }
  function walk(part: { mimeType?: string; body?: { data?: string }; parts?: unknown[] }): string {
    if (part.mimeType === "text/plain" && part.body?.data) return decodeBody(part.body.data);
    if (part.parts) {
      for (const p of part.parts as Array<{ mimeType?: string; body?: { data?: string }; parts?: unknown[] }>) {
        const text = walk(p);
        if (text) return text;
      }
    }
    if (part.body?.data) return decodeBody(part.body.data);
    return "";
  }
  const body = message.payload ? walk(message.payload) : "";
  return { subject, from, date, body };
}
