import { NextResponse } from "next/server";
import { serverDemoState } from "@/lib/server-demo";
import { requireAuth } from "@/lib/auth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestedDriverId = url.searchParams.get("driverId") || undefined;
  const auth = await requireAuth(request, { roles: ["admin", "driver"], driverId: requestedDriverId });
  if (!auth.ok) return auth.response;
  const driverId = auth.context.role === "driver" ? auth.context.driverId : requestedDriverId;
  if (!driverId) return NextResponse.json({ error: "driverId erforderlich" }, { status: 400 });
  const date = url.searchParams.get("date") ?? new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T12:00:00Z`))) return NextResponse.json({ error: "Ungültiges Datum" }, { status: 400 });
  const driver = serverDemoState.drivers.find((item) => item.id === driverId);
  if (!driver) return NextResponse.json({ error: "Fahrer nicht gefunden" }, { status: 404 });
  const routes = serverDemoState.routes.filter((route) => route.driverId === driver.id && route.date === date && route.status !== "draft");
  const orderIds = new Set(routes.flatMap((route) => route.stops.map((stop) => stop.workOrderId)));
  const workOrders = serverDemoState.workOrders.filter((order) => orderIds.has(order.id));
  const customerIds = new Set(workOrders.map((order) => order.customerId));
  const customers = serverDemoState.customers.filter((customer) => customerIds.has(customer.id));
  return NextResponse.json({ driver, routes, workOrders, customers }, { headers: { "Cache-Control": "no-store" } });
}
