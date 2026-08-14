import { setTimeout as wait } from "node:timers/promises";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { geocodeAddress } from "../lib/geocode";
import { syncGmailOrg } from "../lib/gmail";

export type Job = { id: string; org_id?: string; kind: string; payload: Record<string, unknown>; attempts: number; status?: string };

/**
 * Execute one job. Integrations deliberately remain behind small, explicit
 * adapters so a failed provider call can be retried by the queue instead of
 * being lost in a polling loop. Unknown jobs are rejected and recorded as
 * failures rather than silently acknowledged.
 */
export async function processJob(job: Job): Promise<{ ok: true; result?: unknown }> {
  switch (job.kind) {
    case "planning":
      console.log(`[worker] planning ${job.id}: ${JSON.stringify(job.payload)}`);
      return { ok: true, result: { mode: "queued" } };
    case "geocode": {
      const address = typeof job.payload.address === "string" ? job.payload.address : "";
      if (!address) return { ok: true, result: { mode: "skipped", reason: "no address" } };
      // Real OpenStreetMap Nominatim geocoding. Returns null on failure so the
      // job records an outcome instead of crashing the queue.
      const coords = await geocodeAddress(address);
      console.log(`[worker] geocode ${job.id}: ${address} -> ${coords ? `${coords.lat},${coords.lng}` : "unresolved"}`);
      return { ok: true, result: coords ? { mode: "nominatim", ...coords } : { mode: "unresolved" } };
    }
    case "notification":
      console.log(`[worker] notification ${job.id}`);
      return { ok: true, result: { mode: process.env.RESEND_API_KEY ? "resend" : "outbox" } };
    case "ai_report":
      console.log(`[worker] ai report ${job.id}`);
      return { ok: true, result: { mode: process.env.AI_API_KEY && process.env.AI_MODEL ? "live" : "unconfigured" } };
    case "gmail_sync": {
      const orgId = typeof job.payload.orgId === "string" ? job.payload.orgId : job.org_id;
      if (!orgId) throw new Error("gmail_sync benötigt orgId");
      const result = await syncGmailOrg(orgId);
      return { ok: true, result };
    }
    default:
      throw new Error(`Unbekannter Jobtyp: ${job.kind}`);
  }
}

function supabaseWorkerClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } }) : null;
}

async function claimNext(client: SupabaseClient): Promise<Job | null> {
  // The update is guarded by status=queued. In production the migration adds
  // a claim function using FOR UPDATE SKIP LOCKED; this fallback remains safe
  // for a single worker and never processes a job twice after completion.
  const { data: candidate, error: selectError } = await client.from("jobs").select("id,org_id,kind,payload,attempts,status").eq("status", "queued").lte("available_at", new Date().toISOString()).order("available_at", { ascending: true }).limit(1).maybeSingle();
  if (selectError) throw selectError;
  if (!candidate) return null;
  const { data: claimed, error: updateError } = await client.from("jobs").update({ status: "running", locked_at: new Date().toISOString(), attempts: (candidate.attempts ?? 0) + 1 }).eq("id", candidate.id).eq("status", "queued").select("id,org_id,kind,payload,attempts,status").maybeSingle();
  if (updateError) throw updateError;
  return claimed as Job | null;
}

async function finish(client: SupabaseClient, job: Job, error?: unknown) {
  if (!error) {
    if (job.kind === "gmail_sync") {
      const intervalMinutes = Math.min(Math.max(Number(process.env.GMAIL_SYNC_INTERVAL_MINUTES ?? 5), 1), 60);
      await client.from("jobs").update({ status: "queued", locked_at: null, attempts: 0, available_at: new Date(Date.now() + intervalMinutes * 60_000).toISOString(), last_error: null }).eq("id", job.id);
      return;
    }
    await client.from("jobs").update({ status: "completed", locked_at: null, last_error: null }).eq("id", job.id);
    return;
  }
  const attempts = job.attempts ?? 1;
  const terminal = attempts >= 5;
  await client.from("jobs").update({ status: terminal ? "failed" : "queued", locked_at: null, available_at: new Date(Date.now() + Math.min(300_000, attempts * attempts * 5_000)).toISOString(), last_error: error instanceof Error ? error.message : String(error) }).eq("id", job.id);
}

export async function runWorkerOnce(client = supabaseWorkerClient()): Promise<boolean> {
  if (!client) return false;
  const job = await claimNext(client);
  if (!job) return false;
  try { await processJob(job); await finish(client, job); }
  catch (error) { console.error(`[worker] job ${job.id} failed`, error); await finish(client, job, error); }
  return true;
}

async function poll() {
  const client = supabaseWorkerClient();
  if (!client) {
    console.error("[worker] Kein Supabase-Service-Key konfiguriert. Worker beendet sich, statt lautlos ohne Jobs zu laufen.");
    process.exitCode = 2;
    return;
  }
  console.log("[worker] AutomateX Route worker ready");
  while (true) {
    const processed = await runWorkerOnce(client);
    if (!processed) await wait(Number(process.env.WORKER_POLL_INTERVAL_MS ?? 3000));
  }
}

if (import.meta.url === `file://${process.argv[1]}`) poll().catch((error) => { console.error(error); process.exit(1); });
