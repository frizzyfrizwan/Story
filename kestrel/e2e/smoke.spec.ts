import { test, expect } from "@playwright/test";

const PAGES = ["/", "/search", "/explore", "/hotels", "/live", "/finds", "/concierge", "/transfers", "/programs", "/pricing", "/login"];

for (const path of PAGES) {
  test(`renders ${path}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await page.goto(path);
    expect(res?.status(), `${path} status`).toBeLessThan(400);
    await expect(page.locator("main")).toBeVisible();
    await expect(page.getByRole("heading").first()).toBeVisible();
    expect(errors, `console errors on ${path}`).toEqual([]);
  });
}

test("health endpoint reports ok", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBeTruthy();
  const json = await res.json();
  expect(json.ok).toBe(true);
});

test("award search API returns results with a source tag", async ({ request }) => {
  const res = await request.get("/api/awards/search?origin=JFK&destination=LHR&date=2027-05-14&cabin=business");
  expect(res.ok()).toBeTruthy();
  const json = await res.json();
  expect(json.ok).toBe(true);
  expect(["live", "cached", "simulated"]).toContain(json.data.source);
  expect(Array.isArray(json.data.results)).toBe(true);
});

test("airport search API finds Tokyo", async ({ request }) => {
  const res = await request.get("/api/airports?q=tokyo");
  const json = await res.json();
  expect(json.ok).toBe(true);
  expect(json.data.length).toBeGreaterThan(0);
});
