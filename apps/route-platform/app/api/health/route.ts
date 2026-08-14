import { NextResponse } from "next/server";
import { getPilotRuntime } from "@/lib/pilot-runtime";

export async function GET() {
  const production = process.env.NODE_ENV === "production";
  const runtime = getPilotRuntime();
  const checks = {
    auth: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    dataBackend: process.env.SUPABASE_DATA_BACKEND_READY === "true",
    webhook: Boolean(process.env.EMAIL_WEBHOOK_SECRET),
    google: Boolean(process.env.GOOGLE_MAPS_API_KEY),
    worker: Boolean(process.env.WORKER_URL || (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)),
    email: Boolean(process.env.RESEND_API_KEY),
    storage: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    vroom: Boolean(process.env.VROOM_URL),
  };
  // Development intentionally exposes the deterministic demo adapter. A
  // production deployment must prove that identity and persistence are wired
  // before it is advertised as healthy.
  const required = [
    !checks.auth && "Supabase Auth",
    !checks.dataBackend && "Supabase Daten-Backend",
    !checks.webhook && "E-Mail-Webhook-Signatur",
    !checks.worker && "Worker",
    !checks.vroom && "VROOM Optimierungsdienst",
  ].filter((value): value is string => Boolean(value));
  const productionStackReady = required.length === 0;
  // The current repository adapter is synthetic. A deliberately acknowledged
  // presentation deployment may be healthy as a demo, never production-ready.
  const ready = runtime.demoBackendAllowed && (!production || runtime.status === "acknowledged-pilot-demo");
  return NextResponse.json({
    ok: ready,
    service: "automatex-route-platform",
    mode: checks.vroom ? "vroom-ready" : "vroom-not-configured",
    runtime,
    checks,
    productionStackReady,
    missingForProduction: required,
    timestamp: new Date().toISOString(),
  }, { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
