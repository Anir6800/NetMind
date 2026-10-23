import { expect, test } from "@playwright/test";

const incident = { id: 1, network_id: 1, title: "Fixture link down", severity: "critical", state: "open", evidence: { link_id: "router-a-router-b", loss_pct: 100 }, timeline: [{ event_type: "detection", payload: { source: "SIMULATED" } }], diagnosis: { summary: "Fixture diagnosis: link is down.", probable_cause: "router-a-router-b is down." } };

test.beforeEach(async ({ page }) => {
  await page.route("**/events/poll?*", (route) => route.fulfill({ json: [] }));
  await page.route("**/events?*", (route) => route.abort());
  await page.route("**/incidents", (route) => route.request().resourceType() === "fetch" ? route.fulfill({ json: [incident] }) : route.continue());
  await page.route("**/incidents/1", (route) => route.request().resourceType() === "fetch" ? route.fulfill({ json: incident }) : route.continue());
  await page.route("**/copilot/questions", (route) => route.fulfill({ json: { answer: "Cloud diagnosis is unavailable. Manual runbook: No automatic action is proposed.", citation_ids: ["audit:1"], source: "OFFLINE_READ_ONLY", cloud_api_called: false, offline: true } }));
});

test("fixture flow keeps recovery reviewed and mode-labelled", async ({ page }) => {
  await page.goto("/lab");
  await expect(page.getByText("SIMULATED · LOCAL CONTROLLER")).toBeVisible();
  await page.getByRole("button", { name: "Link down" }).click();
  await expect(page.getByText("Selected: link_down.")).toBeVisible();

  await page.goto("/incidents");
  await expect(page.getByText("LIVE API · INCIDENTS")).toBeVisible();
  await page.getByRole("link", { name: /Fixture link down/ }).click();
  await expect(page.getByText("Fixture diagnosis: link is down.")).toBeVisible();
  await page.getByRole("link", { name: "Review bounded recovery proposal" }).click();

  await expect(page.getByText("SAFE WORKFLOW · NO AUTO-EXECUTION")).toBeVisible();
  const request = page.getByRole("button", { name: "Request human approval" });
  await expect(request).toBeDisabled();
  await page.getByLabel(/I reviewed the evidence/).check();
  await page.getByLabel(/Type RESTORE LINK/).fill("RESTORE LINK");
  await expect(request).toBeEnabled();
  await request.click();
  await expect(page.getByText("Awaiting an authorized approver. No controller operation has been sent.")).toBeVisible();

  await page.goto("/copilot");
  await page.getByLabel("Question").fill("Summarize the fixture evidence.");
  await page.getByRole("button", { name: "Ask copilot" }).click();
  await expect(page.getByText("Cloud diagnosis unavailable — read-only outage mode. No automatic action is proposed.")).toBeVisible();
  await expect(page.getByText("OFFLINE_READ_ONLY")).toBeVisible();
});
