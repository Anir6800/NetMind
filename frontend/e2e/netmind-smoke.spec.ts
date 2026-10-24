import { expect, test } from "@playwright/test";

test("student simulator entry explains its supported lab", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("heading", { name: "Build it. Break it. Watch the network adapt." })).toBeVisible();
  await expect(page.getByText("Static · RIP · OSPF")).toBeVisible();
  await expect(page.getByText("ICMP · ARP · DHCP · DNS · TCP · UDP · HTTP")).toBeVisible();
  await expect(page.getByText("Calculated timing · slow-motion replay · SIMULATED")).toBeVisible();
  await expect(page.getByRole("button", { name: "Enter simulator" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();
});
