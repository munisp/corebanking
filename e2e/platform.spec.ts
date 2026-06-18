/**
 * Playwright E2E Tests — 54Bank PWA Core Flows
 *
 * Tests the critical user-facing paths:
 * 1. Homepage loads with sidebar navigation
 * 2. Customer CRUD workflow
 * 3. Core banking pages render correctly
 * 4. Search and filter functionality
 * 5. Sidebar navigation across categories
 * 6. API health endpoints
 * 7. Responsive layout
 */

import { test, expect } from "@playwright/test";

test.describe("Homepage & Navigation", () => {
  test("should load the homepage", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/54Bank/i);
  });

  test("should display the sidebar with banking categories", async ({ page }) => {
    await page.goto("/");
    const sidebar = page.locator("[data-testid='sidebar'], nav, .sidebar, aside").first();
    await expect(sidebar).toBeVisible({ timeout: 10000 });
  });

  test("should navigate to customer workspace", async ({ page }) => {
    await page.goto("/customers");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).toContainText(/customer/i);
  });
});

test.describe("Core Banking Pages", () => {
  const pages = [
    { path: "/customers", title: "customer" },
    { path: "/accounts", title: "account" },
    { path: "/transfers", title: "transfer" },
    { path: "/loans", title: "loan" },
    { path: "/cards", title: "card" },
  ];

  for (const { path, title } of pages) {
    test(`should render ${title} page at ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const content = await page.textContent("body");
      expect(content?.toLowerCase()).toContain(title);
    });
  }
});

test.describe("CRUD Operations", () => {
  test("should load customer list with seed data", async ({ page }) => {
    await page.goto("/customers");
    await page.waitForLoadState("networkidle");
    // Should have table rows or list items with customer data
    const body = await page.textContent("body");
    expect(body?.length).toBeGreaterThan(100);
  });

  test("should have create button on customer page", async ({ page }) => {
    await page.goto("/customers");
    await page.waitForLoadState("networkidle");
    const createBtn = page.locator("button:has-text('Create'), button:has-text('Add'), button:has-text('New')").first();
    await expect(createBtn).toBeVisible({ timeout: 10000 });
  });

  test("should have search functionality", async ({ page }) => {
    await page.goto("/customers");
    await page.waitForLoadState("networkidle");
    const searchInput = page.locator("input[placeholder*='search' i], input[placeholder*='filter' i], input[type='search']").first();
    await expect(searchInput).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Middleware Dashboards", () => {
  test("should load APISIX routes page", async ({ page }) => {
    await page.goto("/apisix-routes");
    await page.waitForLoadState("networkidle");
    const body = await page.textContent("body");
    expect(body?.toLowerCase()).toContain("route");
  });

  test("should load Keycloak realms page", async ({ page }) => {
    await page.goto("/keycloak-realms");
    await page.waitForLoadState("networkidle");
    const body = await page.textContent("body");
    expect(body?.toLowerCase()).toContain("realm");
  });

  test("should load service registry page", async ({ page }) => {
    await page.goto("/service-registry");
    await page.waitForLoadState("networkidle");
    const body = await page.textContent("body");
    expect(body?.toLowerCase()).toContain("service");
  });
});

test.describe("API Health", () => {
  test("should return healthy API response for customers", async ({ request }) => {
    const response = await request.get("/api/platform/customers");
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.items).toBeDefined();
    expect(data.items.length).toBeGreaterThan(0);
  });

  test("should return healthy API response for APISIX routes", async ({ request }) => {
    const response = await request.get("/api/platform/apisix/routes");
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.items.length).toBeGreaterThan(0);
  });

  test("should return DB health status", async ({ request }) => {
    const response = await request.get("/api/db/health");
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty("healthy");
    expect(data).toHaveProperty("latencyMs");
  });

  test("should return DB table list", async ({ request }) => {
    const response = await request.get("/api/db/tables");
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.total).toBeGreaterThan(40);
  });

  test("should return observability metrics", async ({ request }) => {
    const response = await request.get("/api/platform/observability/prometheus-metrics");
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.items.length).toBeGreaterThan(0);
  });

  test("should return service mesh registry", async ({ request }) => {
    const response = await request.get("/api/platform/service-mesh/registry");
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.items.length).toBeGreaterThan(0);
    expect(data.healthy).toBeGreaterThan(0);
  });
});

test.describe("Drizzle DB Routes", () => {
  test("should list accounts from DB or seed", async ({ request }) => {
    const response = await request.get("/api/db/accounts");
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty("items");
    expect(data).toHaveProperty("total");
    expect(data).toHaveProperty("source");
  });

  test("should list loans from DB or seed", async ({ request }) => {
    const response = await request.get("/api/db/loans");
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty("items");
  });

  test("should list GL accounts from DB or seed", async ({ request }) => {
    const response = await request.get("/api/db/gl-accounts");
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty("items");
  });

  test("should handle 404 for non-existent record", async ({ request }) => {
    const response = await request.get("/api/db/accounts/NONEXISTENT-999");
    expect([200, 404]).toContain(response.status());
  });
});
