import { expect, test } from "@playwright/test";
import { createLab, login, watchConsole } from "./helpers";

test("AI explain and suggest are labelled, previewed and applied only on confirmation", async ({ page, request }) => {
  test.setTimeout(90_000);
  const problems = watchConsole(page);
  const id = await createLab(request);
  try {
    await login(page);
    await page.goto(`/simulator/${id}?panel=simulate`);
    await page.getByLabel("Routing").selectOption("static");
    const center = async (node: string) => {
      const box = (await page.locator(`.react-flow__node[data-id="${node}"]`).boundingBox())!;
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    };
    const [r1, r2] = [await center("r1"), await center("r2")];
    await page.mouse.click((r1.x + r2.x) / 2, (r1.y + r2.y) / 2, { button: "right" });
    await page.getByRole("menuitem", { name: "Set link down" }).click();
    await page.getByRole("link", { name: /AI/ }).click();
    await expect(page.locator(".ai-status")).toContainText("Next answer from:");
    await page.getByRole("button", { name: /^Explain:/ }).click();
    const explanation = page.locator(".ai-answer").first();
    await expect(explanation).toContainText("Answered by:", { timeout: 30_000 });
    console.log("EXPLAIN", (await explanation.innerText()).slice(0, 400).replace(/\n/g, " | "));
    await page.getByRole("button", { name: "Suggest improvements" }).click();
    const suggestions = page.locator(".suggestion-list li");
    await expect(suggestions.first()).toBeVisible({ timeout: 30_000 });
    console.log("SUGGEST", (await page.locator(".ai-answer").nth(1).innerText()).slice(0, 300).replace(/\n/g, " | "));
    await page.getByRole("button", { name: "Close impact panel" }).click();
    const addLink = suggestions.filter({ hasText: /Add a/ }).first();
    await addLink.getByRole("button", { name: "Preview before/after" }).click();
    await expect(page.locator(".impact-card")).toContainText("PREVIEW · NOTHING CHANGED YET");
    await expect(page.locator(".react-flow__edge")).toHaveCount(7);
    if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}-suggest-preview.png` });
    await page.getByRole("button", { name: "Apply this suggestion" }).click();
    await expect(page.locator(".impact-card")).toContainText("Applied:");
    await expect(page.locator(".react-flow__edge")).toHaveCount(8);
    await expect(page.locator(".impact-table tr", { hasText: "Destination" }).locator("td").nth(1)).toContainText("reachable");
    expect(problems).toEqual([]);
  } finally {
    await request.delete(`/networks/${id}`);
  }
});
