import { expect, test } from "@playwright/test";
import { createLab, login } from "./helpers";

test("ladder notes stay inside the card; find device zooms on match", async ({ page, request }) => {
  const id = await createLab(request);
  try {
    await login(page);
    await page.goto(`/simulator/${id}?panel=simulate`);
    await page.getByLabel("Scenario", { exact: true }).selectOption("tcp");
    await page.getByRole("button", { name: "Show sequence diagram" }).click();
    const card = page.locator(".ladder-card");
    await card.getByText("What is simplified").click();
    const cardBox = (await card.boundingBox())!;
    const listBox = (await card.locator("details ul").boundingBox())!;
    expect(listBox.y + listBox.height).toBeLessThanOrEqual(cardBox.y + cardBox.height + 1);
    if (process.env.SHOT) await card.screenshot({ path: `${process.env.SHOT}-ladder.png` });
    const before = await page.locator(".react-flow__viewport").getAttribute("style");
    await page.getByLabel("Find and focus a device").fill("r3");
    await expect(page.locator('.react-flow__node[data-id="r3"]')).toHaveClass(/selected/);
    await expect.poll(() => page.locator(".react-flow__viewport").getAttribute("style")).not.toBe(before);
  } finally {
    await request.delete(`/networks/${id}`);
  }
});
