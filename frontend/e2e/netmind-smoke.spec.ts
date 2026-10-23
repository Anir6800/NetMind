import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const incident = { id: 1, network_id: 1, title: "Fixture link down", severity: "critical", state: "open", evidence: { link_id: "router-a-router-b", loss_pct: 100 }, timeline: [{ event_type: "detection", payload: { source: "SIMULATED" } }], diagnosis: { summary: "Fixture diagnosis: link is down.", probable_cause: "router-a-router-b is down." } };
const recoveredIncident = { ...incident, id: 11, title: "Fixture recovery verified", state: "resolved", timeline: [{ event_type: "recovery_execution_confirmed", payload: { source: "SIMULATED", action: "restore_link" } }, { event_type: "recovery_verified", payload: { mttd_ms: 500, mttr_ms: 3000, consecutive_samples: 3 } }] };
const rolledBackIncident = { ...incident, id: 12, title: "Fixture recovery rolled back", state: "open", timeline: [{ event_type: "recovery_execution_started", payload: { source: "SIMULATED", action: "restore_link" } }, { event_type: "recovery_execution_rolled_back", payload: { reason: "verification_failed" } }] };
const topology = { source: "SIMULATED", last_updated: "2026-10-23T10:00:00Z", topology: { version: "fixture-v1", nodes: [{ id: "host-a", type: "host", interfaces: [{ id: "eth0", address: "10.0.0.1/24" }] }, { id: "router-a", type: "router", interfaces: [{ id: "eth0", address: "10.0.0.2/24" }] }, { id: "host-b", type: "host", interfaces: [{ id: "eth0", address: "10.0.0.3/24" }] }], links: [{ id: "router-a-router-b", a: { node_id: "host-a" }, b: { node_id: "router-a" }, state: "down" }, { id: "router-b-host-b", a: { node_id: "router-a" }, b: { node_id: "host-b" }, state: "up" }] } };
let activeIncident = incident;

async function capture(page: Page, filename: string) {
  if (process.env.CAPTURE_UI_EVIDENCE !== "1") return;
  const screenshots = resolve(process.cwd(), "../docs/evidence/screenshots");
  await mkdir(screenshots, { recursive: true });
  await page.screenshot({ path: resolve(screenshots, filename), fullPage: true });
}

test.beforeEach(async ({ page }) => {
  activeIncident = incident;
  await page.route("**/events/poll?*", (route) => route.fulfill({ json: [] }));
  await page.route("**/events?*", (route) => route.abort());
  await page.route("**/incidents", (route) => route.request().resourceType() === "fetch" ? route.fulfill({ json: [activeIncident] }) : route.continue());
  await page.route("**/incidents/*", (route) => route.request().resourceType() === "fetch" ? route.fulfill({ json: activeIncident }) : route.continue());
  await page.route("**/networks/1/topology", (route) => route.fulfill({ json: topology }));
  await page.route("**/copilot/questions", (route) => route.fulfill({ json: { answer: "Cloud diagnosis is unavailable. Manual runbook: No automatic action is proposed.", citation_ids: ["audit:1"], source: "OFFLINE_READ_ONLY", cloud_api_called: false, offline: true } }));
  await page.route("**/telemetry/latest", (route) => route.fulfill({ json: { metrics: [{ name: "Round-trip time", value: 8, unit: "ms", source: "MEASURED", sampled_at: new Date().toISOString(), ttl_seconds: 15, state: "FRESH" }, { name: "Packet loss", value: 10, unit: "%", source: "SIMULATED", sampled_at: new Date(Date.now() - 16_000).toISOString(), ttl_seconds: 15, state: "STALE" }] } }));
});

test("fixture flow keeps recovery reviewed and mode-labelled", async ({ page }) => {
  await page.goto("/lab");
  await expect(page.getByText("SIMULATED · LOCAL CONTROLLER")).toBeVisible();
  await page.getByRole("button", { name: "Link down" }).click();
  await expect(page.getByText("Selected: link_down.")).toBeVisible();
  await capture(page, "01-lab-simulated.png");

  await page.goto("/topology");
  await expect(page.getByTestId("topology-source")).toContainText("SIMULATED");
  await capture(page, "02-topology-simulated.png");

  await page.goto("/incidents");
  await expect(page.getByText("LIVE API · INCIDENTS")).toBeVisible();
  await page.getByRole("link", { name: /Fixture link down/ }).click();
  await expect(page.getByText("Fixture diagnosis: link is down.")).toBeVisible();
  await capture(page, "03-incident-evidence-diagnosis.png");
  await page.getByRole("link", { name: "Review bounded recovery proposal" }).click();

  await expect(page.getByText("SAFE WORKFLOW · NO AUTO-EXECUTION")).toBeVisible();
  const request = page.getByRole("button", { name: "Request human approval" });
  await expect(request).toBeDisabled();
  await page.getByLabel(/I reviewed the evidence/).check();
  await page.getByLabel(/Type RESTORE LINK/).fill("RESTORE LINK");
  await expect(request).toBeEnabled();
  await request.click();
  await expect(page.getByText("Awaiting an authorized approver. No controller operation has been sent.")).toBeVisible();
  await capture(page, "04-approval-gate.png");

  await page.goto("/copilot");
  await page.getByLabel("Question").fill("Summarize the fixture evidence.");
  await page.getByRole("button", { name: "Ask copilot" }).click();
  await expect(page.getByText("Cloud diagnosis unavailable — read-only outage mode. No automatic action is proposed.")).toBeVisible();
  await expect(page.getByText("OFFLINE_READ_ONLY")).toBeVisible();
  await capture(page, "05-offline-failure-mode.png");

  await page.goto("/monitoring");
  await expect(page.getByTestId("metric-Round-trip time")).toContainText("MEASURED · MININET");
  await expect(page.getByTestId("metric-Round-trip time")).toContainText("FRESH");
  await expect(page.getByTestId("metric-Packet loss")).toContainText("SIMULATED · FALLBACK");
  await expect(page.getByTestId("metric-Packet loss")).toContainText("STALE — older than 15s TTL");
  await capture(page, "06-monitoring-stale-label.png");
});

test("fixture evidence labels verified recovery and rollback", async ({ page }) => {
  activeIncident = recoveredIncident;
  await page.goto("/incidents/11");
  await expect(page.getByText("Fixture recovery verified")).toBeVisible();
  await expect(page.getByText("recovery_verified")).toBeVisible();
  await capture(page, "07-recovery-verified.png");

  activeIncident = rolledBackIncident;
  await page.goto("/incidents/12");
  await expect(page.getByText("Fixture recovery rolled back")).toBeVisible();
  await expect(page.getByText("recovery_execution_rolled_back")).toBeVisible();
  await capture(page, "08-recovery-rolled-back.png");
});
