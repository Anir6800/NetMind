import { expect, test } from "@playwright/test";
import { createLab, login, watchConsole } from "./helpers";

test("0.25x slow motion plays a ping hop by hop", async ({ page, request }) => {
  const problems = watchConsole(page);
  const id = await createLab(request);
  try {
    await login(page);
    await page.goto(`/simulator/${id}?panel=simulate`);
    await page.getByLabel("Routing").selectOption("ospf");
    await page.getByLabel("Packets", { exact: true }).fill("1");
    await page.getByRole("button", { name: "Send & play in slow motion" }).click();
    await expect(page.getByLabel("Speed")).toHaveValue("0.25");
    const seen: string[] = [];
    const clocks: string[] = [];
    for (let sample = 0; sample < 60; sample += 1) {
      const links = await page.locator(".react-flow__edge:has(.sim-packet)").evaluateAll((items) => items.map((item) => item.getAttribute("data-id")));
      for (const link of links) if (link && seen.at(-1) !== link) seen.push(link);
      clocks.push(await page.locator(".virtual-clock").innerText());
      if (links.includes("l3") && !clocks.includes("shot") && process.env.SHOT) {
        await page.screenshot({ path: `${process.env.SHOT}-slowmo.png` });
        clocks.push("shot");
      }
      await page.waitForTimeout(100);
    }
    // Request leaves h1 over l1, then l2, then l3 in order.
    expect(seen.slice(0, 3)).toEqual(["l1", "l2", "l3"]);
    expect(new Set(clocks).size).toBeGreaterThan(20);
    await page.getByRole("button", { name: "Pause" }).click();
    await page.getByRole("button", { name: /Step/ }).click();
    await expect(page.locator(".current-event")).toBeVisible();
    expect(problems).toEqual([]);
  } finally {
    await request.delete(`/networks/${id}`);
  }
});
