import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { addDays, currentBusinessDate } from "@/lib/utils";

type TestBatchSummary = { batchId: string; drivers: number; customers: number; workOrders: number };

function workdays(start: string, count: number) {
  const dates: string[] = [];
  let cursor = start;
  while (dates.length < count) {
    const weekday = new Date(`${cursor}T12:00:00`).getDay();
    if (weekday !== 0 && weekday !== 6) dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates;
}

async function currentBatch(orgId: string): Promise<TestBatchSummary | undefined> {
  const client = createSupabaseAdmin();
  if (!client) throw new Error("Supabase-Administration ist nicht konfiguriert.");
  const [customerBatch, driverBatch, orderBatch] = await Promise.all([
    client.from("customers").select("test_batch_id").eq("org_id", orgId).not("test_batch_id", "is", null).limit(1),
    client.from("drivers").select("test_batch_id").eq("org_id", orgId).not("test_batch_id", "is", null).limit(1),
    client.from("work_orders").select("test_batch_id").eq("org_id", orgId).not("test_batch_id", "is", null).limit(1),
  ]);
  if (customerBatch.error || driverBatch.error || orderBatch.error) throw new Error("Testdatenstatus konnte nicht geladen werden.");
  const batchId = (customerBatch.data?.[0]?.test_batch_id ?? driverBatch.data?.[0]?.test_batch_id ?? orderBatch.data?.[0]?.test_batch_id) as string | undefined;
  if (!batchId) return undefined;
  const [drivers, allCustomers, workOrders] = await Promise.all([
    client.from("drivers").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("test_batch_id", batchId),
    client.from("customers").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("test_batch_id", batchId),
    client.from("work_orders").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("test_batch_id", batchId),
  ]);
  if (drivers.error || allCustomers.error || workOrders.error) throw new Error("Testdatenstatus konnte nicht geladen werden.");
  return { batchId, drivers: drivers.count ?? 0, customers: allCustomers.count ?? 0, workOrders: workOrders.count ?? 0 };
}

export async function GET(request: Request) {
  const auth = await requireAuth(request, { roles: ["admin"] });
  if (!auth.ok) return auth.response;
  if (auth.context.demo) return NextResponse.json({ batch: undefined }, { headers: { "Cache-Control": "no-store" } });
  try {
    return NextResponse.json({ batch: await currentBatch(auth.context.orgId) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Testdatenstatus konnte nicht geladen werden." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAuth(request, { roles: ["admin"] });
  if (!auth.ok) return auth.response;
  if (auth.context.demo) return NextResponse.json({ error: "Testdaten werden nur im echten Admin-Konto angelegt." }, { status: 409 });
  const client = createSupabaseAdmin();
  if (!client) return NextResponse.json({ error: "Supabase-Administration ist nicht konfiguriert." }, { status: 503 });
  try {
    const existing = await currentBatch(auth.context.orgId);
    if (existing) return NextResponse.json({ error: "Für dieses Konto existiert bereits ein Testdatenpaket.", batch: existing }, { status: 409 });
    const batchId = crypto.randomUUID();
    const firstDay = workdays(currentBusinessDate(), 1)[0];
    const dates = workdays(firstDay, 4);
    const driverRows = [
      ["Testfahrer Anna", "TA", "#16a6c9", ["Wartung", "Reparatur"]],
      ["Testfahrer Ben", "TB", "#7c3aed", ["Wartung", "Reparatur"]],
      ["Testfahrerin Clara", "TC", "#f97316", ["Wartung", "Reparatur"]],
      ["Testfahrer David", "TD", "#0f766e", ["Wartung", "Reparatur"]],
    ].map(([name, initials, color, skills]) => ({ org_id: auth.context.orgId, test_batch_id: batchId, is_test: true, name, initials, color, skills, depot: "Bahnhofstraße 1, 46537 Dinslaken", depot_lat: 51.562, depot_lng: 6.734, shift_start: "08:00", shift_end: "17:00", max_stops: 5, max_travel_minutes: 240, active: true }));
    const { error: driverError } = await client.from("drivers").insert(driverRows);
    if (driverError) throw new Error("Testfahrer konnten nicht angelegt werden. Bitte zuerst die Migration 0009 anwenden.");
    const customers = [
      ["Testkunde Ahrens", "Friedrich-Ebert-Straße 12, 46535 Dinslaken", 51.559, 6.728],
      ["Testkunde Bergmann", "Hünxer Straße 45, 46537 Dinslaken", 51.573, 6.744],
      ["Testkunde Cramer", "Ober-Lohberg-Allee 8, 46537 Dinslaken", 51.583, 6.759],
      ["Testkunde Dorn", "Weseler Straße 61, 46537 Dinslaken", 51.554, 6.703],
      ["Testkunde Esser", "Sterkrader Straße 20, 46539 Dinslaken", 51.548, 6.745],
      ["Testkunde Fuchs", "Bismarckstraße 33, 46535 Dinslaken", 51.568, 6.718],
      ["Testkunde Gerlach", "Hagenstraße 15, 46535 Dinslaken", 51.565, 6.737],
      ["Testkunde Hansen", "Roonstraße 27, 46535 Dinslaken", 51.552, 6.722],
      ["Testkunde Iserlohn", "Kampstraße 9, 46537 Dinslaken", 51.578, 6.726],
      ["Testkunde Jansen", "Bruchstraße 41, 46535 Dinslaken", 51.571, 6.708],
      ["Testkunde Koch", "Augustastraße 17, 46537 Dinslaken", 51.558, 6.751],
      ["Testkunde Lenz", "Lohbergstraße 58, 46537 Dinslaken", 51.588, 6.741],
    ];
    const { data: createdCustomers, error: customerError } = await client.from("customers").insert(customers.map(([name, address, lat, lng], index) => ({ org_id: auth.context.orgId, test_batch_id: batchId, name, address, lat, lng, contact: "Testkontakt", email: `test${index + 1}@example.invalid`, phone: "02064 000000", site: "Teststandort", asset: "Testanlage", speciality: "Wartung", interval_months: 12, next_due: dates[index % dates.length], sla: "Standard", notes: "Automatisch erzeugte Testdaten" }))).select("id");
    if (customerError || !createdCustomers?.length) throw new Error("Testkunden konnten nicht angelegt werden.");
    const windows = [["08:30", "11:30"], ["09:00", "12:00"], ["10:00", "13:00"], ["13:00", "16:30"]] as const;
    const { error: orderError } = await client.from("work_orders").insert(Array.from({ length: 16 }, (_, index) => ({ org_id: auth.context.orgId, test_batch_id: batchId, customer_id: createdCustomers[index % createdCustomers.length].id, title: index % 4 === 3 ? "Test-Reparatur Anlage" : "Test-Wartung Anlage", kind: index % 4 === 3 ? "Reparatur" : "Wartung", status: "backlog", time_from: windows[index % windows.length][0], time_to: windows[index % windows.length][1], duration_minutes: index % 3 === 0 ? 60 : 45, priority: index % 5 === 0 ? 3 : 2, speciality: index % 4 === 3 ? "Reparatur" : "Wartung", deadline_date: dates[Math.min(dates.length - 1, Math.floor(index / 4))], notes: "Automatisch erzeugter, vollständig planbarer Testauftrag" })));
    if (orderError) throw new Error("Testaufträge konnten nicht angelegt werden.");
    const batch = { batchId, drivers: 4, customers: 12, workOrders: 16 };
    await client.from("audit_events").insert({ org_id: auth.context.orgId, actor_id: auth.context.userId, action: "test_data.created", entity_type: "test_batch", entity_id: batchId, after_state: batch, reason: "Planbares Test-Szenario durch Administration erstellt" });
    return NextResponse.json({ batch }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Testdaten konnten nicht angelegt werden." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAuth(request, { roles: ["admin"] });
  if (!auth.ok) return auth.response;
  if (auth.context.demo) return NextResponse.json({ error: "Testdaten werden nur im echten Admin-Konto verwaltet." }, { status: 409 });
  const client = createSupabaseAdmin();
  if (!client) return NextResponse.json({ error: "Supabase-Administration ist nicht konfiguriert." }, { status: 503 });
  try {
    const batch = await currentBatch(auth.context.orgId);
    if (!batch) return NextResponse.json({ error: "Keine Testdaten vorhanden." }, { status: 404 });
    const { data: testOrders, error: testOrderError } = await client.from("work_orders").select("id").eq("org_id", auth.context.orgId).eq("test_batch_id", batch.batchId);
    if (testOrderError) throw new Error("Testdaten konnten nicht geprüft werden.");
    const testOrderIds = new Set((testOrders ?? []).map((row) => row.id as string));
    const { data: testDrivers, error: driverError } = await client.from("drivers").select("id").eq("org_id", auth.context.orgId).eq("test_batch_id", batch.batchId);
    if (driverError) throw new Error("Testdaten konnten nicht geprüft werden.");
    const driverIds = (testDrivers ?? []).map((row) => row.id as string);
    if (driverIds.length) {
      const { data: routes, error: routeError } = await client.from("routes").select("id,route_stops(work_order_id)").eq("org_id", auth.context.orgId).in("driver_id", driverIds);
      if (routeError) throw new Error("Testdaten konnten nicht geprüft werden.");
      const hasOperationalStop = (routes ?? []).some((route) => Array.isArray(route.route_stops) && route.route_stops.some((stop: { work_order_id?: string }) => stop.work_order_id && !testOrderIds.has(stop.work_order_id)));
      if (hasOperationalStop) return NextResponse.json({ error: "Testfahrer enthalten inzwischen echte Aufträge. Entferne oder verschiebe diese Touren zuerst; echte Daten werden nicht gelöscht." }, { status: 409 });
    }
    const { error: ordersError } = await client.from("work_orders").delete().eq("org_id", auth.context.orgId).eq("test_batch_id", batch.batchId);
    if (ordersError) throw new Error("Testaufträge konnten nicht entfernt werden.");
    const { error: customersError } = await client.from("customers").delete().eq("org_id", auth.context.orgId).eq("test_batch_id", batch.batchId);
    if (customersError) throw new Error("Testkunden konnten nicht entfernt werden.");
    const { error: driversError } = await client.from("drivers").delete().eq("org_id", auth.context.orgId).eq("test_batch_id", batch.batchId);
    if (driversError) throw new Error("Testfahrer konnten nicht entfernt werden.");
    await client.from("audit_events").insert({ org_id: auth.context.orgId, actor_id: auth.context.userId, action: "test_data.deleted", entity_type: "test_batch", entity_id: batch.batchId, before_state: batch, reason: "Ausschließlich markierte Testdaten durch Administration entfernt" });
    return NextResponse.json({ removed: batch }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Testdaten konnten nicht entfernt werden." }, { status: 500 });
  }
}
