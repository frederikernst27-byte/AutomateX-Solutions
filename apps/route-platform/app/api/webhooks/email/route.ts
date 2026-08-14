import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { classifyEmail } from "@/lib/ai";
import { serverDemoState } from "@/lib/server-demo";

const payloadSchema = z.object({
  from: z.string().trim().max(320).optional(),
  subject: z.string().trim().max(500).default("Neue Nachricht"),
  text: z.string().max(20_000).default(""),
  workOrderId: z.string().trim().max(120).optional(),
});

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function signatureMatches(signature: string, raw: string, secret: string, timestamp?: string) {
  const signedPayload = timestamp ? `${timestamp}.${raw}` : raw;
  // Resend uses Svix-style signatures (`v1,<base64>`). Accept a plain
  // sha256 hex/base64 signature too, which makes local provider adapters easy
  // to test without weakening production verification.
  const secrets = [secret];
  if (secret.startsWith("whsec_")) {
    try { secrets.push(Buffer.from(secret.slice(6), "base64").toString("utf8")); } catch { /* use raw secret */ }
  }
  return secrets.some((candidate) => {
    const hmac = createHmac("sha256", candidate).update(signedPayload).digest();
    const expectedBase64 = hmac.toString("base64");
    const expectedHex = hmac.toString("hex");
    return signature.split(" ").some((part) => {
      const value = part.includes(",") ? part.split(",").pop() || "" : part.replace(/^sha256=/, "");
      return safeEqual(value, expectedBase64) || safeEqual(value, expectedHex);
    });
  });
}

function verifyWebhook(request: Request, raw: string) {
  const secret = process.env.EMAIL_WEBHOOK_SECRET;
  if (!secret) {
    // Unsigned mail is opt-in even in development. This prevents a copied
    // local demo URL from becoming a spoofable inbox endpoint.
    return process.env.NODE_ENV !== "production" && process.env.ALLOW_UNSIGNED_DEMO_WEBHOOK === "true";
  }
  const signature = request.headers.get("svix-signature") || request.headers.get("x-email-signature") || request.headers.get("x-webhook-signature");
  if (!signature) return false;
  const timestamp = request.headers.get("svix-timestamp") || request.headers.get("x-webhook-timestamp") || undefined;
  if (timestamp) {
    const seconds = Number(timestamp);
    if (!Number.isFinite(seconds) || Math.abs(Date.now() / 1000 - seconds) > 5 * 60) return false;
  }
  return signatureMatches(signature, raw, secret, timestamp);
}

export async function POST(request: Request) {
  const raw = await request.text();
  if (raw.length > 1_000_000) return NextResponse.json({ error: "Webhook-Payload ist zu groß" }, { status: 413 });
  if (!verifyWebhook(request, raw)) {
    return NextResponse.json({ error: "Ungültige Webhook-Signatur", code: "WEBHOOK_SIGNATURE_INVALID" }, { status: 401 });
  }
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Webhook-Payload ist kein gültiges JSON" }, { status: 400 });
  }
  const parsed = payloadSchema.safeParse(parsedJson);
  if (!parsed.success) return NextResponse.json({ error: "Ungültiger E-Mail-Payload", details: parsed.error.flatten() }, { status: 400 });
  const body = parsed.data;
  const classification = classifyEmail({ subject: body.subject, body: body.text });
  serverDemoState.inbox.unshift({
    id: `mail-${Date.now()}`,
    sender: body.from ?? "unknown",
    subject: body.subject,
    excerpt: body.text.slice(0, 280),
    ...classification,
    workOrderId: body.workOrderId,
    receivedAt: "gerade eben",
    actionStatus: "pending",
  });
  return NextResponse.json({ accepted: true, classification }, { headers: { "Cache-Control": "no-store" } });
}
