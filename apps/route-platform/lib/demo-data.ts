import type { Customer, DemoState, Driver, InboxItem, Route, ServiceReport, WorkOrder } from "./types";

const customerLocations = [
  [51.4556, 7.0116], [51.496, 6.852], [51.4405, 6.985], [51.5295, 6.944], [51.389, 7.03],
  [51.568, 6.789], [51.421, 6.77], [51.456, 6.892], [51.507, 7.09], [51.35, 6.96]
];

export const demoDrivers: Driver[] = [
  { id: "drv-anna", name: "Anna Weber", initials: "AW", color: "#18b982", email: "anna.weber@demo.de", phone: "+49 172 555 0142", skills: ["Klima", "Lüftung", "Wartung"], active: true, depot: "Essen-Kettwig", location: { lat: 51.383, lng: 6.94 }, shiftStart: "07:30", shiftEnd: "16:30", maxStops: 4, maxTravelMinutes: 180, daysOff: [], status: "on_route", lastSeen: "vor 2 Min.", },
  { id: "drv-murat", name: "Murat Kaya", initials: "MK", color: "#5795ff", email: "murat.kaya@demo.de", phone: "+49 172 555 0181", skills: ["Elektro", "Solar / PV", "Smart Home"], active: true, depot: "Duisburg-Süd", location: { lat: 51.407, lng: 6.78 }, shiftStart: "08:00", shiftEnd: "17:00", maxStops: 4, maxTravelMinutes: 210, daysOff: [], status: "available", lastSeen: "vor 5 Min.", },
  { id: "drv-leonie", name: "Leonie Schmitz", initials: "LS", color: "#f79009", email: "leonie.schmitz@demo.de", phone: "+49 172 555 0193", skills: ["Heizung", "Sanitär", "Gasgeräte"], active: true, depot: "Oberhausen", location: { lat: 51.47, lng: 6.85 }, shiftStart: "07:00", shiftEnd: "15:30", maxStops: 3, maxTravelMinutes: 160, daysOff: [], status: "available", lastSeen: "vor 9 Min.", },
  { id: "drv-jan", name: "Jan Peters", initials: "JP", color: "#9b8afb", email: "jan.peters@demo.de", phone: "+49 172 555 0177", skills: ["Heizung", "Klima", "Notdienst"], active: true, depot: "Mülheim", location: { lat: 51.43, lng: 6.88 }, shiftStart: "08:00", shiftEnd: "17:00", maxStops: 4, maxTravelMinutes: 190, daysOff: [], status: "off", lastSeen: "gestern", },
];

export const demoCustomers: Customer[] = ([
  { id: "cus-meyer", name: "Meyer Haustechnik GmbH", contact: "Sven Meyer", email: "service@meyer-haustechnik.de", phone: "+49 201 482 120", site: "Werkstatt Essen", address: "Hanauer Landstraße 126, 45127 Essen", location: { lat: 51.4556, lng: 7.0116 }, asset: "Wärmepumpe W-240", speciality: "Heizung", intervalMonths: 12, lastService: "2025-07-19", nextDue: "2026-07-19", sla: "SLA 24h", portalSlug: "meyer", notes: "Zugang über den Empfang, Tor 3." },
  { id: "cus-praxis", name: "Praxis Dr. Schneider", contact: "Dr. Eva Schneider", email: "kontakt@praxis-schneider.de", phone: "+49 208 520 80", site: "Hauptpraxis", address: "Bockenheimer Landstraße 51, 46045 Oberhausen", location: { lat: 51.496, lng: 6.852 }, asset: "Klimagerät Daikin", speciality: "Klima", intervalMonths: 6, lastService: "2026-01-15", nextDue: "2026-07-15", sla: "Standard", portalSlug: "schneider" },
  { id: "cus-kita", name: "Kita Sonnenhof", contact: "Nina Baum", email: "leitung@kita-sonnenhof.de", phone: "+49 201 322 19", site: "Kita Sonnenhof", address: "Eckenheimer Landstraße 303, 45327 Essen", location: { lat: 51.4405, lng: 6.985 }, asset: "Lüftungsanlage L-18", speciality: "Lüftung", intervalMonths: 12, lastService: "2025-07-22", nextDue: "2026-07-22", sla: "SLA 48h", portalSlug: "sonnenhof" },
  { id: "cus-mainblick", name: "Restaurant Mainblick", contact: "Tobias Reimann", email: "technik@mainblick-essen.de", phone: "+49 201 701 22", site: "Küche", address: "Schaumainkai 17, 45127 Essen", location: { lat: 51.5295, lng: 6.944 }, asset: "Abluftanlage Gastro", speciality: "Lüftung", intervalMonths: 6, lastService: "2026-01-25", nextDue: "2026-07-25", sla: "Standard", portalSlug: "mainblick", notes: "Anfahrt über Lieferanteneingang." },
  { id: "cus-keller", name: "Frau Keller", contact: "Claudia Keller", email: "keller@email.de", phone: "+49 201 444 119", site: "Privatobjekt", address: "Textorstraße 74, 45145 Essen", location: { lat: 51.389, lng: 7.03 }, asset: "Gastherme Vitodens", speciality: "Heizung", intervalMonths: 12, lastService: "2025-08-01", nextDue: "2026-07-18", sla: "SLA 24h", portalSlug: "keller", notes: "Klingel Keller/Schulz." },
  { id: "cus-baumann", name: "Baumann Büropark", contact: "Nadine Baumann", email: "facility@baumann-buero.de", phone: "+49 203 220 40", site: "Haus A", address: "Mercatorstraße 12, 47051 Duisburg", location: { lat: 51.421, lng: 6.77 }, asset: "PV-Anlage 40 kWp", speciality: "Solar / PV", intervalMonths: 12, lastService: "2025-07-30", nextDue: "2026-07-30", sla: "Standard", portalSlug: "baumann" },
  { id: "cus-hafen", name: "Hafenlogistik West", contact: "Yusuf Aydin", email: "service@hafenlogistik-west.de", phone: "+49 208 909 77", site: "Halle 4", address: "Am Blumenkamp 8, 46049 Oberhausen", location: { lat: 51.568, lng: 6.789 }, asset: "Schaltschrank S-44", speciality: "Elektro", intervalMonths: 12, lastService: "2025-08-04", nextDue: "2026-08-04", sla: "SLA 48h", portalSlug: "hafen" },
  { id: "cus-hofmann", name: "Hofmann Immobilien", contact: "Lisa Hofmann", email: "verwaltung@hofmann-immo.de", phone: "+49 201 391 80", site: "Wohnpark Süd", address: "Rüttenscheider Straße 110, 45130 Essen", location: { lat: 51.456, lng: 6.892 }, asset: "Heizungsanlage H-21", speciality: "Heizung", intervalMonths: 12, lastService: "2025-09-02", nextDue: "2026-09-02", sla: "Standard", portalSlug: "hofmann" },
  { id: "cus-ruhr", name: "RuhrTech Campus", contact: "Markus Bender", email: "facility@ruhrtech-campus.de", phone: "+49 201 221 91", site: "Gebäude C", address: "Universitätsstraße 2, 45141 Essen", location: { lat: 51.507, lng: 7.09 }, asset: "Lüftungsanlage V-12", speciality: "Klima", intervalMonths: 6, lastService: "2026-02-01", nextDue: "2026-08-01", sla: "SLA 48h", portalSlug: "ruhrtech" },
  { id: "cus-schulte", name: "Schulte Wohnbau", contact: "Martin Schulte", email: "technik@schulte-wohnbau.de", phone: "+49 201 442 18", site: "Quartier Nord", address: "Huyssenallee 88, 45128 Essen", location: { lat: 51.35, lng: 6.96 }, asset: "Sanitärstrang N-8", speciality: "Sanitär", intervalMonths: 12, lastService: "2025-08-12", nextDue: "2026-08-12", sla: "Standard", portalSlug: "schulte" },
].map((customer, index) => ({ ...customer, location: { lat: customerLocations[index]?.[0] ?? customer.location.lat, lng: customerLocations[index]?.[1] ?? customer.location.lng } })) as Customer[]);

export const demoWorkOrders: WorkOrder[] = [
  { id: "wo-1001", customerId: "cus-meyer", title: "Jahreswartung Wärmepumpe", kind: "Wartung", status: "completed", scheduledDate: "2026-07-17", timeFrom: "08:30", timeTo: "09:15", durationMinutes: 45, priority: 3, speciality: "Heizung", locked: true, assignedDriverId: "drv-leonie", notes: "Heizkreis 2 prüfen", portalToken: "meyer-demo", portalTokenExpiresAt: "2099-12-31T23:59:59.000Z", createdAt: "2026-06-20" },
  { id: "wo-1002", customerId: "cus-praxis", title: "Klimagerät prüfen", kind: "Wartung", status: "en_route", scheduledDate: "2026-07-17", timeFrom: "09:45", timeTo: "10:30", durationMinutes: 45, priority: 2, speciality: "Klima", locked: true, assignedDriverId: "drv-anna", notes: "Vor Sprechstunde melden", portalToken: "schneider-demo", portalTokenExpiresAt: "2099-12-31T23:59:59.000Z", createdAt: "2026-06-20" },
  { id: "wo-1003", customerId: "cus-kita", title: "Lüftungsanlage warten", kind: "Wartung", status: "planned", scheduledDate: "2026-07-17", timeFrom: "11:15", timeTo: "12:00", durationMinutes: 45, priority: 2, speciality: "Lüftung", locked: false, assignedDriverId: "drv-anna", notes: "Filterwechsel mitbringen", portalToken: "sonnenhof-demo", portalTokenExpiresAt: "2099-12-31T23:59:59.000Z", createdAt: "2026-06-22" },
  { id: "wo-1004", customerId: "cus-mainblick", title: "Abluftanlage prüfen", kind: "Inspektion", status: "planned", scheduledDate: "2026-07-17", timeFrom: "13:30", timeTo: "14:15", durationMinutes: 45, priority: 1, speciality: "Lüftung", locked: false, assignedDriverId: "drv-anna", notes: "Lieferanteneingang nutzen", portalToken: "mainblick-demo", portalTokenExpiresAt: "2099-12-31T23:59:59.000Z", createdAt: "2026-06-22" },
  { id: "wo-1005", customerId: "cus-keller", title: "Gastherme – Jahresservice", kind: "Wartung", status: "offered", scheduledDate: "2026-07-18", timeFrom: "09:00", timeTo: "10:00", durationMinutes: 60, priority: 3, speciality: "Heizung", locked: false, notes: "Klingel Keller/Schulz", portalToken: "keller-demo", portalTokenExpiresAt: "2099-12-31T23:59:59.000Z", createdAt: "2026-06-25" },
  { id: "wo-1006", customerId: "cus-baumann", title: "PV-Anlage Sichtprüfung", kind: "Inspektion", status: "backlog", timeFrom: "09:00", timeTo: "16:00", durationMinutes: 60, priority: 2, speciality: "Solar / PV", locked: false, notes: "Dachzugang vorher anmelden", portalToken: "baumann-demo", createdAt: "2026-07-01" },
  { id: "wo-1007", customerId: "cus-hafen", title: "Schaltschrank Thermografie", kind: "Inspektion", status: "backlog", timeFrom: "08:00", timeTo: "15:00", durationMinutes: 90, priority: 3, speciality: "Elektro", locked: false, notes: "Sicherheitsunterweisung vor Ort", portalToken: "hafen-demo", createdAt: "2026-07-02" },
  { id: "wo-1008", customerId: "cus-hofmann", title: "Heizungsanlage warten", kind: "Wartung", status: "backlog", timeFrom: "10:00", timeTo: "14:00", durationMinutes: 60, priority: 1, speciality: "Heizung", locked: false, notes: "Hausmeister ist informiert", portalToken: "hofmann-demo", createdAt: "2026-07-03" },
  { id: "wo-1009", customerId: "cus-ruhr", title: "Lüftungszentrale prüfen", kind: "Wartung", status: "confirmed", scheduledDate: "2026-07-20", timeFrom: "09:00", timeTo: "10:00", durationMinutes: 60, priority: 2, speciality: "Klima", locked: true, assignedDriverId: "drv-anna", notes: "Technikraum C-12", portalToken: "ruhrtech-demo", createdAt: "2026-07-04" },
  { id: "wo-1010", customerId: "cus-schulte", title: "Sanitärstrang – Sichtkontrolle", kind: "Wartung", status: "backlog", timeFrom: "08:00", timeTo: "16:00", durationMinutes: 45, priority: 1, speciality: "Sanitär", locked: false, notes: "Schlüssel beim Hausmeister", portalToken: "schulte-demo", createdAt: "2026-07-04" },
];

export const demoRoutes: Route[] = [
  { id: "route-anna-today", date: "2026-07-17", driverId: "drv-anna", status: "started", currentStopId: "wo-1002", lastLocation: demoDrivers[0].location, distanceKm: 41.8, travelMinutes: 72, serviceMinutes: 135, stops: [
    { workOrderId: "wo-1002", order: 1, eta: "09:45", distanceFromPreviousKm: 9.4, driveMinutesFromPrevious: 18, explanation: "Klima-Skill + bestätigtes Zeitfenster" },
    { workOrderId: "wo-1003", order: 2, eta: "11:18", distanceFromPreviousKm: 11.2, driveMinutesFromPrevious: 22, explanation: "Gebietsbündelung Essen-Nord" },
    { workOrderId: "wo-1004", order: 3, eta: "13:36", distanceFromPreviousKm: 8.7, driveMinutesFromPrevious: 17, explanation: "Abluft-Skill + geringster Umweg" },
  ] },
  { id: "route-leonie-today", date: "2026-07-17", driverId: "drv-leonie", status: "published", distanceKm: 28.2, travelMinutes: 56, serviceMinutes: 45, stops: [
    { workOrderId: "wo-1001", order: 1, eta: "08:30", distanceFromPreviousKm: 7.2, driveMinutesFromPrevious: 14, explanation: "Heizung-Skill + SLA 24h" },
  ] },
  { id: "route-murat-today", date: "2026-07-17", driverId: "drv-murat", status: "published", distanceKm: 0, travelMinutes: 0, serviceMinutes: 0, stops: [] },
];

const demoInbox: InboxItem[] = [
  { id: "mail-1", sender: "keller@email.de", subject: "Termin am Freitag passt", excerpt: "Vielen Dank, der Termin am Freitag um 09:00 Uhr passt für uns.", intent: "confirm", confidence: 0.97, workOrderId: "wo-1005", receivedAt: "vor 12 Min.", actionStatus: "pending" },
  { id: "mail-2", sender: "kontakt@praxis-schneider.de", subject: "Wartung bitte verschieben", excerpt: "Können wir die Wartung auf 09:45 Uhr vorziehen? Die Adresse bleibt gleich.", intent: "reschedule", confidence: 0.88, workOrderId: "wo-1002", receivedAt: "vor 36 Min.", actionStatus: "pending" },
  { id: "mail-3", sender: "service@meyer-haustechnik.de", subject: "Heizung im Büro ausgefallen", excerpt: "Bitte so schnell wie möglich vorbeikommen – Heizung komplett ausgefallen.", intent: "unknown", confidence: 0.72, workOrderId: "wo-1001", receivedAt: "gestern", actionStatus: "pending" },
];

export const demoReports: ServiceReport[] = [
  { id: "report-1", workOrderId: "wo-1001", summary: "Jahreswartung abgeschlossen. Wärmepumpe läuft im Normalbetrieb.", findings: ["Filter gereinigt", "Heizkreis 2 nachjustiert"], urgency: "normal", confirmed: true, createdAt: "2026-07-17T09:20:00Z" }
];

export function createDemoState(): DemoState {
  return {
    drivers: demoDrivers,
    customers: demoCustomers,
    workOrders: demoWorkOrders,
    routes: demoRoutes,
    reports: demoReports,
    planningRuns: [],
    inbox: demoInbox,
    notifications: [],
    settings: {
      defaultMaxStops: 4,
      defaultMaxTravelMinutes: 180,
      defaultMaxRouteMinutes: 480,
      autoConfirm: false,
      gpsEnabled: true,
      locationRetentionDays: 30,
    },
    lastUpdated: new Date().toISOString(),
  };
}
