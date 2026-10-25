import { expect, test } from "@playwright/test";
import { createLab, login, watchConsole } from "./helpers";

test("first-visit tutorial highlights controls, can be skipped and replayed", async ({ page, request }) => {
  const problems = watchConsole(page);
  await login(page, { tour: true });
  const card = page.locator(".tour-card");
  await expect(card).toContainText("TUTORIAL · 1/7");
  await expect(card).toContainText("System status");
  await page.getByRole("button", { name: "Next" }).click();
  await expect(card).toContainText("Build your own network");
  await expect(page.locator(".tour-spot")).toBeVisible();
  await page.getByRole("button", { name: "Skip tour" }).click();
  await expect(card).toHaveCount(0);
  await page.reload();
  await page.waitForTimeout(1500);
  await expect(card).toHaveCount(0); // remembered
  const id = await createLab(request);
  try {
    await page.goto(`/simulator/${id}`);
    await expect(card).toContainText("The canvas");
    for (let step = 0; step < 4; step += 1) await page.getByRole("button", { name: "Next" }).click();
    await expect(card).toContainText("Choose what to test");
    await expect(page).toHaveURL(/panel=simulate/);
    await expect(page.locator(".tour-spot")).toBeVisible();
    if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}-tour.png` });
    await page.keyboard.press("Escape");
    await expect(card).toHaveCount(0);
    await page.getByRole("button", { name: "Show the tutorial" }).click();
    await expect(card).toContainText("TUTORIAL · 1/12");
    expect(problems).toEqual([]);
  } finally {
    await request.delete(`/networks/${id}`);
  }
});
