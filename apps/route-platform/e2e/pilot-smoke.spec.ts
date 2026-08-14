import { expect, test } from "@playwright/test";

test("Startseite weist einen leeren Betriebsbestand aus", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Service-Routen klar planen." })).toBeVisible();
  await expect(page.getByText("Keine vorbefüllten Kunden, Fahrer oder Touren")).toBeVisible();
  await expect(page.getByRole("link", { name: /Zum Login/ })).toBeVisible();
});

test("Admin und Fahrer werden ohne Sitzung zum Login geleitet", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin|\/login\?next=\/admin/);
  await expect(page.getByRole("heading", { name: "Anmelden" })).toBeVisible();
  await page.goto("/driver");
  await expect(page).toHaveURL(/\/login\?next=%2Fdriver|\/login\?next=\/driver/);
});

test("frischer Serverzustand enthält keine Demo-Datensätze", async ({ request }) => {
  const session = await request.post("/api/auth/demo", { data: { role: "admin" } });
  expect(session.status()).toBe(200);
  const { sessionToken } = await session.json();
  const stateResponse = await request.get("/api/state", { headers: { Authorization: `Bearer ${sessionToken}` } });
  expect(stateResponse.status()).toBe(200);
  const { state } = await stateResponse.json();
  expect(state).toMatchObject({ drivers: [], customers: [], workOrders: [], routes: [], reports: [], inbox: [] });
});

test("Admin-Aktionsknöpfe sind mit React verbunden", async ({ page, request, context }) => {
  const session = await request.post("/api/auth/demo", { data: { role: "admin" } });
  expect(session.status()).toBe(200);
  const { sessionToken } = await session.json();
  await context.addCookies([{ name: "automatex_session", value: sessionToken, url: "http://localhost:3014" }]);

  await page.goto("/admin/planung");
  await page.getByRole("button", { name: "Parameter", exact: true }).click();
  await expect(page.getByText("Feinparameter", { exact: true })).toBeVisible();

  await page.goto("/admin/kunden");
  await page.getByRole("button", { name: "Kunde anlegen", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Neuen Kunden anlegen", exact: true })).toBeVisible();

  await page.goto("/admin/fahrer");
  await page.getByRole("button", { name: "Fahrer einladen", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Fahrer einladen", exact: true })).toBeVisible();
});

test("Planungs-API begrenzt den Zeitraum und Import bleibt idempotent", async ({ request }, testInfo) => {
  const session = await request.post("/api/auth/demo", { data: { role: "admin" } });
  const { sessionToken } = await session.json();
  const authHeaders = { Authorization: `Bearer ${sessionToken}` };
  const tooLong = await request.post("/api/plans", { headers: authHeaders, data: { from: "2026-07-17", to: "2026-11-01", driverIds: [] } });
  expect(tooLong.status()).toBe(400);
  const headers = { ...authHeaders, "Idempotency-Key": `e2e-import-${testInfo.project.name}-${Date.now()}` };
  const body = { rows: [{ Kunde: "E2E GmbH", Adresse: "Testweg 7, 45127 Essen" }], commit: false };
  const first = await request.post("/api/imports", { headers, data: body });
  const second = await request.post("/api/imports", { headers, data: body });
  expect(first.status()).toBe(201);
  expect(second.status()).toBe(200);
  expect((await first.json()).id).toBe((await second.json()).id);
});
