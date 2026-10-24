import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { lab } from "../src/sim/testkit";

// These specs need the local stack (API on 8000 + Firebase Auth emulator on 9099): run.ps1 first.

export async function login(page: Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Enter simulator" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
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
