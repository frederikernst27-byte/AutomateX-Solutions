import { describe, expect, it } from "vitest";
import { aiPreviewToPlanningResult, classifyEmail, commandToConstraints, generateServiceReport, parsePlanningCommand } from "./ai";
import { createDemoState } from "./demo-data";
import { defaultConstraints } from "./planner";

describe("AI guardrails", () => {
  it("turns a German planning command into structured constraints", () => {
    const command = parsePlanningCommand("Plane die nächsten vier Wochen mit maximal vier Stopps pro Fahrer und maximal drei Stunden Fahrzeit");
    expect(command.maxStops).toBe(4);
    expect(command.maxTravelMinutes).toBe(180);
    expect(command.durationDays).toBe(28);
    expect(command.confidence).toBeGreaterThan(.9);
  });

  it("extracts a three-stop cap from the exact copilot instruction", () => {
    const command = parsePlanningCommand("Plane die nächsten 2 Wochen mit maximal 3 Stopps pro Fahrer und maximal 3 Stunden Fahrzeit");
    expect(command.maxStops).toBe(3);
    expect(commandToConstraints(command, { ...defaultConstraints(), hardRules: { ...defaultConstraints().hardRules, maxStops: false } }).hardRules.maxStops).toBe(true);
  });

  it("extends the chosen planning start by two weeks", () => {
    const base = { ...defaultConstraints(), from: "2026-07-21", to: "2026-07-28" };
    const next = commandToConstraints(parsePlanningCommand("Plane die nächsten zwei Wochen"), base);
    expect(next.to).toBe("2026-08-04");
  });

  it("classifies confirmations and cancellations deterministically", () => {
    expect(classifyEmail({ subject: "Termin passt", body: "Ja, einverstanden" }).intent).toBe("confirm");
    expect(classifyEmail({ subject: "Termin absagen", body: "Leider müssen wir stornieren" }).intent).toBe("cancel");
    expect(classifyEmail({ subject: "Termin", body: "Der Termin passt leider nicht, bitte absagen" }).intent).toBe("cancel");
    expect(classifyEmail({ subject: "Termin", body: "Können wir verschieben? Der Termin passt nicht." }).intent).toBe("reschedule");
    expect(classifyEmail({ subject: "Termin", body: "Ja, bitte nicht bestätigen, sondern stornieren" }).intent).toBe("cancel");
  });

  it("flags risky service notes for human review", () => {
    const report = generateServiceReport({ workOrderTitle: "Heizung warten", note: "Leck entdeckt, bitte sofort prüfen" });
    expect(report.urgency).toBe("sofort");
    expect(report.confirmed).toBe(false);
  });

  it("turns a validated JSON proposal into a planning-board route", () => {
    const state = createDemoState();
    const date = "2026-07-20";
    const result = aiPreviewToPlanningResult(state, { ...defaultConstraints(state.drivers), from: date, to: date }, {
      rationale: "Anna übernimmt einen nahe gelegenen Auftrag.",
      assignments: [{ workOrderId: "wo-1008", driverId: "drv-leonie", date, stopOrder: 1, reason: "Kurze Anfahrt vom Depot" }],
    });
    expect(result.mode).toBe("ai");
    expect(result.routes[0]?.stops[0]?.workOrderId).toBe("wo-1008");
  });
});
