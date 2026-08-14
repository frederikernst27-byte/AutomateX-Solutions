import { describe, expect, it } from "vitest";
import { previewRows, rowsToCustomers } from "./importer";
import { generateDemoRows } from "../scripts/generate-demo-import";

describe("Import-Copilot", () => {
  it("maps German headers and blocks incomplete rows", () => {
    const preview = previewRows([{ Kunde: "Muster GmbH", Adresse: "Hauptstraße 1, Essen", Fachgebiet: "Klima", "Nächste Wartung": "2026-08-01" }, { Kunde: "", Adresse: "" }]);
    expect(preview.mapping.name).toBe("Kunde");
    expect(preview.mapping.address).toBe("Adresse");
    expect(preview.errors.length).toBe(2);
    expect(rowsToCustomers(preview)).toHaveLength(1);
  });

  it("marks duplicate addresses against existing customers", () => {
    const preview = previewRows([{ Kunde: "Muster GmbH", Adresse: "Hauptstraße 1, Essen" }], ["Hauptstraße 1, Essen"]);
    expect(preview.duplicates).toEqual([2]);
  });

  it("ships a 3,000-row fixture with unique addresses", () => {
    const rows = generateDemoRows();
    const addresses = rows.map((row) => String(row[1]));
    expect(rows).toHaveLength(3000);
    expect(new Set(addresses).size).toBe(3000);
    const preview = previewRows(rows.map((row) => ({ Kunde: row[0], Adresse: row[1] })));
    expect(preview.duplicates).toEqual([]);
  });
});
