import { expect, test } from "@playwright/test";
import { createLab, login, watchConsole } from "./helpers";

test("TCP ladder shows retransmission and failure under static, recovery under OSPF", async ({ page, request }) => {
  const problems = watchConsole(page);
  const id = await createLab(request);
  try {
    await login(page);
    await page.goto(`/simulator/${id}?panel=simulate`);
    await page.getByLabel("Routing").selectOption("static");
    await page.getByLabel("Fault", { exact: true }).selectOption("link-down");
    await page.getByLabel("Target").selectOption("l3");
    await page.getByLabel("Scenario", { exact: true }).selectOption("tcp");
    await page.getByLabel("Inject the fault selected above mid-scenario").check();
    await page.getByRole("button", { name: "Show sequence diagram" }).click();
    const card = page.locator(".ladder-card");
    await expect(card.locator("text.ladder-label").first()).toHaveText("SYN");
    await expect(card.locator(".ladder-lost").first()).toBeVisible();
    await expect(card.locator("h2")).toHaveClass(/delta-worse/);
    if (process.env.SHOT) await card.screenshot({ path: `${process.env.SHOT}-tcp-static.png` });
    await page.getByLabel("Routing").selectOption("ospf");
    await page.getByRole("button", { name: "Show sequence diagram" }).click();
    await expect(card.locator("h2")).toHaveClass(/delta-better/);
    await expect(card.locator("text.ladder-label").last()).toContainText("ACK");
    expect(problems).toEqual([]);
  } finally {
    await request.delete(`/networks/${id}`);
  }
});
