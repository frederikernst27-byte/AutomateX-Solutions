/**
 * Fail-closed runtime gate for the process-local pilot adapter.
 *
 * The current API implementation intentionally uses synthetic, in-memory data.
 * A production build may only expose that adapter when an operator explicitly
 * acknowledges the limitations and configures a non-default signing secret.
 * This prevents a normal deployment from being mistaken for the persistent,
 * tenant-safe Supabase backend described by the product architecture.
 */

export const PILOT_DEMO_ACKNOWLEDGEMENT = "SYNTHETIC_DEMO_ONLY";

type RuntimeEnvironment = Record<string, string | undefined>;

export type PilotRuntimeStatus =
  | "local-demo"
  | "acknowledged-pilot-demo"
  | "demo-disabled"
  | "blocked-production";

export interface PilotRuntime {
  status: PilotRuntimeStatus;
  demoBackendAllowed: boolean;
  production: boolean;
  syntheticData: true;
  persistent: false;
  productionReady: false;
  reason?: string;
}

function configuredSecret(environment: RuntimeEnvironment) {
  return environment.DEMO_AUTH_SECRET || environment.AUTH_SECRET || "";
}

function hasStrongSigningSecret(environment: RuntimeEnvironment) {
  const secret = configuredSecret(environment);
  return secret.length >= 32
    && secret !== "automatex-local-demo-secret-change-me"
    && !secret.toLowerCase().includes("replace-with");
}

export function getPilotRuntime(environment: RuntimeEnvironment = process.env): PilotRuntime {
  const production = environment.NODE_ENV === "production";
  const demoRequested = production
    ? environment.NEXT_PUBLIC_DEMO_MODE === "true"
    : environment.NEXT_PUBLIC_DEMO_MODE !== "false";

  if (!demoRequested) {
    return {
      status: "demo-disabled",
      demoBackendAllowed: false,
      production,
      syntheticData: true,
      persistent: false,
      productionReady: false,
      reason: "Der In-Memory-Demoadapter ist deaktiviert.",
    };
  }

  if (!production) {
    return {
      status: "local-demo",
      demoBackendAllowed: true,
      production,
      syntheticData: true,
      persistent: false,
      productionReady: false,
    };
  }

  const acknowledged = environment.PILOT_DEMO_BACKEND_ENABLED === "true"
    && environment.PILOT_DEMO_ACKNOWLEDGEMENT === PILOT_DEMO_ACKNOWLEDGEMENT;
  const strongSecret = hasStrongSigningSecret(environment);

  if (acknowledged && strongSecret) {
    return {
      status: "acknowledged-pilot-demo",
      demoBackendAllowed: true,
      production,
      syntheticData: true,
      persistent: false,
      productionReady: false,
      reason: "Kontrollierter Präsentationsmodus mit flüchtigen, synthetischen Daten.",
    };
  }

  return {
    status: "blocked-production",
    demoBackendAllowed: false,
    production,
    syntheticData: true,
    persistent: false,
    productionReady: false,
    reason: !acknowledged
      ? "Produktionszugriff auf den Demoadapter wurde nicht ausdrücklich bestätigt."
      : "Für den Produktions-Demomodus ist ein Signing-Secret mit mindestens 32 Zeichen erforderlich.",
  };
}

export function isPilotApplicationApi(pathname: string) {
  return pathname.startsWith("/api/") && pathname !== "/api/health" && !pathname.startsWith("/api/auth/");
}
