import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { login, watchConsole } from "./helpers";

test("lesson loads the office template and completes step by step", async ({ page, request }) => {
  const problems = watchConsole(page);
  await login(page);
  await page.locator(".lesson-grid .template-card", { hasText: "Find the single point of failure" }).click();
  await page.waitForURL(/lesson=find-the-spof/);
  const id = Number(new URL(page.url()).pathname.split("/").at(-1));
  try {
    const topology = (await (await request.get(`/networks/${id}/topology`)).json()).topology;
    const office = JSON.parse(await readFile(new URL("../../data/templates/office.json", import.meta.url), "utf8"));
    expect(topology.nodes.map((node: { id: string }) => node.id)).toEqual(office.nodes.map((node: { id: string }) => node.id));
    const card = page.locator(".lesson-card");
    await expect(card).toContainText("0/4");
    await page.getByRole("link", { name: /Canvas/ }).click();
    await page.locator(".critical-list li").first().getByRole("button").click();
    await expect(card).toContainText("1/4");
    await page.locator(".inspector-actions").getByRole("button", { name: "Power down" }).click();
    await expect(card).toContainText("2/4");
    await page.locator(".inspector-actions").getByRole("button", { name: "Restore" }).click();
    await expect(card).toContainText("3/4");
    await page.getByRole("link", { name: /Tables/ }).click();
    await expect(card).toContainText("Lesson complete");
    expect(problems).toEqual([]);
  } finally {
    await request.delete(`/networks/${id}`);
  }
});

test("export a network to JSON and import it back", async ({ page, request }) => {
  const { createLab } = await import("./helpers");
  const id = await createLab(request);
  let imported = 0;
  try {
    await login(page);
    await page.goto(`/simulator/${id}`);
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export", exact: true }).click();
    const file = await (await download).path();
    await page.getByRole("link", { name: /Networks/ }).click();
    await page.locator('input[type="file"]').setInputFiles(file!);
    await page.waitForURL((url) => /\/simulator\/\d+/.test(url.pathname) && !url.pathname.endsWith(`/${id}`));
    imported = Number(new URL(page.url()).pathname.split("/").at(-1));
    const original = (await (await request.get(`/networks/${id}/topology`)).json()).topology;
    const copy = (await (await request.get(`/networks/${imported}/topology`)).json()).topology;
    expect(copy).toEqual(original);
  } finally {
    await request.delete(`/networks/${id}`);
    if (imported) await request.delete(`/networks/${imported}`);
  }
});
