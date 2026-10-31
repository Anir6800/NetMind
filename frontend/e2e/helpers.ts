import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { lab } from "../src/sim/testkit";

// These specs need the local API on port 8000: run.ps1 first.

export async function login(page: Page, { tour = false } = {}) {
  // The first-visit tutorial would cover the UI under test; it has its own spec.
  if (!tour) await page.addInitScript(() => ["dashboard", "studio"].forEach((name) => localStorage.setItem(`netmind-tour-${name}-done`, "1")));
  await page.goto("/");
}

export async function createLab(request: APIRequestContext): Promise<number> {
  const created = await request.post("/networks", { data: { name: `e2e-lab-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, topology: lab() } });
  expect(created.ok()).toBeTruthy();
  return (await created.json()).id;
}

export function watchConsole(page: Page) {
  const problems: string[] = [];
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) problems.push(message.text());
  });
  return problems;
}
