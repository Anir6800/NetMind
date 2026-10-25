import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("status dot: green when all up, red when the backend is unreachable", async ({ page }) => {
  await login(page);
  const dot = page.locator(".system-dot");
  await expect(dot).toHaveClass(/system-dot--(green|blue)/);
  console.log("DOT", await dot.getAttribute("aria-label"));
  await page.route("**/health", (route) => route.abort());
  await page.reload();
  await expect(dot).toHaveClass(/system-dot--red/, { timeout: 15_000 });
  await page.unroute("**/health");
  await page.route("**/health", (route) => route.fulfill({ json: { status: "ok", database: "down", ai: "LIVE" } }));
  await page.reload();
  await expect(dot).toHaveClass(/system-dot--yellow/);
});
