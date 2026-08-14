import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { InboxItem } from "./types";

export interface GmailConnection {
  orgId: string;
  googleEmail: string;
  refreshToken: string;
  scopes: string[];
  status: "active" | "reauthorization_required" | "disconnected";
  lastSyncedAt?: string;
  lastError?: string;
}

export interface GmailWorkOrderCandidate { id: string; customer: string; customerEmail: string; title: string; scheduledDate?: string; status: string }

function adminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
}

function encryptionKey() {
  const secret = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!secret || secret.length < 32) throw new Error("INTEGRATION_ENCRYPTION_KEY muss mindestens 32 Zeichen lang sein");
  return createHash("sha256").update(secret).digest();
}

export function encryptIntegrationSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptIntegrationSecret(value: string) {
  const [version, encodedIv, encodedTag, encodedPayload] = value.split(".");
  if (version !== "v1" || !encodedIv || !encodedTag || !encodedPayload) throw new Error("Gespeichertes Integrationstoken ist ungültig");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(encodedIv, "base64url"));
  decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encodedPayload, "base64url")), decipher.final()]).toString("utf8");
}

export function gmailPersistenceConfigured() {
  return !!(adminClient() && process.env.INTEGRATION_ENCRYPTION_KEY && process.env.INTEGRATION_ENCRYPTION_KEY.length >= 32);
}

export async function saveGmailConnection(input: GmailConnection & { connectedBy: string }) {
  const client = adminClient();
  if (!client) throw new Error("Supabase Service-Backend ist nicht konfiguriert");
  const { error } = await client.from("gmail_connections").upsert({
    org_id: input.orgId,
    google_email: input.googleEmail,
    refresh_token_ciphertext: encryptIntegrationSecret(input.refreshToken),
    scopes: input.scopes,
    status: "active",
    last_error: null,
    connected_by: input.connectedBy,
  }, { onConflict: "org_id" });
  if (error) throw error;
}

export async function getGmailConnection(orgId: string): Promise<GmailConnection | null> {
  const client = adminClient();
  if (!client) return null;
  const { data, error } = await client.from("gmail_connections").select("org_id,google_email,refresh_token_ciphertext,scopes,status,last_synced_at,last_error").eq("org_id", orgId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    orgId: data.org_id,
    googleEmail: data.google_email,
    refreshToken: decryptIntegrationSecret(data.refresh_token_ciphertext),
    scopes: data.scopes ?? [],
    status: data.status,
    lastSyncedAt: data.last_synced_at ?? undefined,
    lastError: data.last_error ?? undefined,
  };
}

export async function updateGmailSyncStatus(orgId: string, input: { lastSyncedAt?: string; lastError?: string | null; status?: GmailConnection["status"] }) {
  const client = adminClient();
  if (!client) throw new Error("Supabase Service-Backend ist nicht konfiguriert");
  const { error } = await client.from("gmail_connections").update({
    ...(input.lastSyncedAt ? { last_synced_at: input.lastSyncedAt } : {}),
    ...(input.lastError !== undefined ? { last_error: input.lastError } : {}),
    ...(input.status ? { status: input.status } : {}),
  }).eq("org_id", orgId);
  if (error) throw error;
}

export async function disconnectGmail(orgId: string) {
  const client = adminClient();
  if (!client) throw new Error("Supabase Service-Backend ist nicht konfiguriert");
  const { error } = await client.from("gmail_connections").delete().eq("org_id", orgId);
  if (error) throw error;
  const { error: jobError } = await client.from("jobs").update({ status: "completed", locked_at: null, last_error: "Gmail-Verbindung getrennt" }).eq("org_id", orgId).eq("kind", "gmail_sync").in("status", ["queued", "running"]);
  if (jobError) throw jobError;
}

export async function knownGmailMessageIds(orgId: string, ids: string[]) {
  if (!ids.length) return new Set<string>();
  const client = adminClient();
  if (!client) throw new Error("Supabase Service-Backend ist nicht konfiguriert");
  const { data, error } = await client.from("gmail_inbox_messages").select("google_message_id").eq("org_id", orgId).in("google_message_id", ids);
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.google_message_id as string));
}

export async function listGmailWorkOrderCandidates(orgId: string): Promise<GmailWorkOrderCandidate[]> {
  const client = adminClient();
  if (!client) throw new Error("Supabase Service-Backend ist nicht konfiguriert");
  const { data: orders, error: orderError } = await client.from("work_orders").select("id,customer_id,title,scheduled_date,status").eq("org_id", orgId).not("status", "in", "(completed,cancelled)").limit(500);
  if (orderError) throw orderError;
  const customerIds = Array.from(new Set((orders ?? []).map((order) => order.customer_id as string)));
  const { data: customers, error: customerError } = customerIds.length ? await client.from("customers").select("id,name,email").eq("org_id", orgId).in("id", customerIds) : { data: [], error: null };
  if (customerError) throw customerError;
  const customerById = new Map((customers ?? []).map((customer) => [customer.id as string, customer]));
  return (orders ?? []).map((order) => {
    const customer = customerById.get(order.customer_id as string);
    return { id: order.id, customer: customer?.name ?? "", customerEmail: customer?.email ?? "", title: order.title, scheduledDate: order.scheduled_date ?? undefined, status: order.status };
  });
}

export async function saveGmailInboxItem(orgId: string, input: InboxItem & { threadId?: string; receivedAtIso: string }) {
  const client = adminClient();
  if (!client) throw new Error("Supabase Service-Backend ist nicht konfiguriert");
  const { error } = await client.from("gmail_inbox_messages").upsert({
    org_id: orgId,
    google_message_id: input.providerMessageId,
    google_thread_id: input.threadId,
    sender: input.sender,
    subject: input.subject,
    excerpt: input.excerpt,
    received_at: input.receivedAtIso,
    intent: input.intent,
    confidence: input.confidence,
    ai_reason: input.aiReason,
    work_order_id: input.workOrderId ?? null,
    action_status: input.actionStatus,
  }, { onConflict: "org_id,google_message_id", ignoreDuplicates: true });
  if (error) throw error;
}

export async function listGmailInboxItems(orgId: string, limit = 100): Promise<InboxItem[]> {
  const client = adminClient();
  if (!client) return [];
  const { data, error } = await client.from("gmail_inbox_messages").select("id,google_message_id,sender,subject,excerpt,received_at,intent,confidence,ai_reason,work_order_id,action_status").eq("org_id", orgId).order("received_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    providerMessageId: row.google_message_id,
    sender: row.sender,
    subject: row.subject,
    excerpt: row.excerpt,
    intent: row.intent,
    confidence: Number(row.confidence),
    aiReason: row.ai_reason ?? undefined,
    workOrderId: row.work_order_id ?? undefined,
    receivedAt: row.received_at,
    actionStatus: row.action_status,
  }));
}

export async function updateGmailInboxAction(orgId: string, providerMessageId: string, actionStatus: InboxItem["actionStatus"]) {
  const client = adminClient();
  if (!client) throw new Error("Supabase Service-Backend ist nicht konfiguriert");
  const { error } = await client.from("gmail_inbox_messages").update({ action_status: actionStatus }).eq("org_id", orgId).eq("google_message_id", providerMessageId);
  if (error) throw error;
}

export async function applyGmailInboxDecision(orgId: string, providerMessageId: string, actorId: string) {
  const client = adminClient();
  if (!client) throw new Error("Supabase Service-Backend ist nicht konfiguriert");
  const { data: message, error: messageError } = await client.from("gmail_inbox_messages").select("work_order_id,intent,action_status").eq("org_id", orgId).eq("google_message_id", providerMessageId).maybeSingle();
  if (messageError) throw messageError;
  if (!message || !message.work_order_id || message.intent === "unknown") throw new Error("Die Nachricht ist keinem Auftrag sicher zugeordnet");
  if (message.action_status !== "pending") throw new Error("Die Nachricht wurde bereits bearbeitet");
  const nextStatus = message.intent === "cancel" ? "cancelled" : message.intent === "confirm" ? "confirmed" : "offered";
  const { error: orderError } = await client.from("work_orders").update({ status: nextStatus }).eq("org_id", orgId).eq("id", message.work_order_id);
  if (orderError) throw orderError;
  await updateGmailInboxAction(orgId, providerMessageId, "applied");
  await client.from("audit_events").insert({ org_id: orgId, actor_id: actorId, action: `gmail.${message.intent}.applied`, entity_type: "work_order", entity_id: message.work_order_id, before_state: { source: "gmail", providerMessageId }, after_state: { status: nextStatus }, reason: "Vom Admin bestätigter KI-Inbox-Vorschlag" });
  return { workOrderId: message.work_order_id as string, status: nextStatus as string };
}

export async function recordGmailSyncAudit(orgId: string, input: { email: string; checked: number; imported: number }) {
  const client = adminClient();
  if (!client) return;
  await client.from("audit_events").insert({ org_id: orgId, action: "gmail.synced", entity_type: "gmail_connection", entity_id: input.email, before_state: null, after_state: { checked: input.checked, imported: input.imported }, reason: "Automatische KI-Inbox-Synchronisierung" });
}

export async function enqueueGmailSync(orgId: string, availableAt = new Date().toISOString()) {
  const client = adminClient();
  if (!client) throw new Error("Supabase Service-Backend ist nicht konfiguriert");
  const { data: existing, error: selectError } = await client.from("jobs").select("id").eq("org_id", orgId).eq("kind", "gmail_sync").in("status", ["queued", "running"]).limit(1).maybeSingle();
  if (selectError) throw selectError;
  if (existing) {
    const { error } = await client.from("jobs").update({ available_at: availableAt }).eq("id", existing.id).eq("status", "queued");
    if (error) throw error;
    return;
  }
  const { error } = await client.from("jobs").insert({ org_id: orgId, kind: "gmail_sync", payload: { orgId }, status: "queued", available_at: availableAt });
  if (error) throw error;
}
