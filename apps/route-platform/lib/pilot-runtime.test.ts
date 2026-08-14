import { describe, expect, it } from "vitest";
import { getPilotRuntime, PILOT_DEMO_ACKNOWLEDGEMENT } from "./pilot-runtime";

describe("pilot runtime preflight", () => {
  it("allows the synthetic adapter during local development", () => {
    expect(getPilotRuntime({ NODE_ENV: "development", NEXT_PUBLIC_DEMO_MODE: "true" })).toMatchObject({
      status: "local-demo",
      demoBackendAllowed: true,
      productionReady: false,
    });
  });

  it("blocks an ordinary production deployment", () => {
    expect(getPilotRuntime({ NODE_ENV: "production", NEXT_PUBLIC_DEMO_MODE: "true" })).toMatchObject({
      status: "blocked-production",
      demoBackendAllowed: false,
    });
  });

  it("still blocks an acknowledged deployment with a weak secret", () => {
    expect(getPilotRuntime({
      NODE_ENV: "production",
      NEXT_PUBLIC_DEMO_MODE: "true",
      PILOT_DEMO_BACKEND_ENABLED: "true",
      PILOT_DEMO_ACKNOWLEDGEMENT,
      DEMO_AUTH_SECRET: "too-short",
    }).demoBackendAllowed).toBe(false);
  });

  it("allows only an explicitly acknowledged presentation deployment with a strong secret", () => {
    expect(getPilotRuntime({
      NODE_ENV: "production",
      NEXT_PUBLIC_DEMO_MODE: "true",
      PILOT_DEMO_BACKEND_ENABLED: "true",
      PILOT_DEMO_ACKNOWLEDGEMENT,
      DEMO_AUTH_SECRET: "a-strong-demo-secret-with-more-than-32-characters",
    })).toMatchObject({
      status: "acknowledged-pilot-demo",
      demoBackendAllowed: true,
      persistent: false,
      productionReady: false,
    });
  });
});
