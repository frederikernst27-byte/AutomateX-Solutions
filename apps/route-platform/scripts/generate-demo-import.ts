import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const cities = [
  ["Essen", "45127"], ["Düsseldorf", "40210"], ["Dortmund", "44135"], ["Köln", "50667"],
  ["Bochum", "44787"], ["Duisburg", "47051"], ["Wuppertal", "42103"], ["Bonn", "53111"],
  ["Münster", "48143"], ["Gelsenkirchen", "45879"], ["Oberhausen", "46045"], ["Bielefeld", "33602"],
] as const;
const streets = ["Industriestraße", "Am Technologiepark", "Werkstraße", "Gewerbering", "Nordstraße", "An der Zeche", "Rheinpromenade", "Westfalenweg"];
const specialities = ["Klima", "Heizung", "Lüftung", "Elektro", "Wartung"];
const assets = ["Klimagerät", "Wärmepumpe", "Lüftungsanlage", "Schaltschrank", "Brandschutzklappe"];

function quote(value: string | number) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export const demoImportHeader = ["Kunde", "Adresse", "E-Mail", "Telefon", "Fachgebiet", "Nächste Wartung", "Anlage", "SLA", "Zeitfenster"];

export function generateDemoRows(count = 3000) {
  return Array.from({ length: count }, (_, index) => {
    const [city, zip] = cities[index % cities.length];
    const due = new Date(Date.UTC(2026, 6, 1 + (index % 120))).toISOString().slice(0, 10);
    return [
      `Demo Betrieb ${String(index + 1).padStart(4, "0")} GmbH`,
      // Use a globally unique house number for the fixture. The previous
      // street/number modulo pattern produced thousands of duplicate addresses
      // and made the duplicate-check demo misleading.
      `${streets[index % streets.length]} ${index + 1}, ${zip} ${city}`,
      `wartung${index + 1}@demo.invalid`,
      `+49 201 ${String(100000 + index).padStart(6, "0")}`,
      specialities[index % specialities.length],
      due,
      `${assets[index % assets.length]} AX-${1000 + index}`,
      index % 8 === 0 ? "Premium" : "Standard",
      index % 3 === 0 ? "08:00-12:00" : index % 3 === 1 ? "10:00-15:00" : "13:00-17:00",
    ];
  });
}

const outputDirectory = path.join(process.cwd(), "demo-output");
const outputFile = path.join(outputDirectory, "automatex-3000-nrw-adressen.csv");

async function main() {
  await mkdir(outputDirectory, { recursive: true });
  const rows = generateDemoRows();
  await writeFile(outputFile, [demoImportHeader, ...rows].map((row) => row.map(quote).join(",")).join("\n"), "utf8");
  console.log(`Erstellt: ${outputFile} (${rows.length} synthetische Datensätze)`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
