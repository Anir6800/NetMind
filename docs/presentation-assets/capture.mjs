// Re-creates the numbered screenshots for docs/presentation.md.
// Needs the stack from run.ps1 (API 8000, Vite 5173, Firebase Auth 9099): node docs/presentation-assets/capture.mjs
import { chromium } from "../../frontend/node_modules/@playwright/test/index.mjs";
import { lab } from "../../frontend/src/sim/testkit.ts";
import { fileURLToPath } from "node:url";
import path from "node:path";

const OUT = path.dirname(fileURLToPath(import.meta.url));
const BASE = "http://127.0.0.1:5173";
const shot = (target, name) => target.screenshot({ path: path.join(OUT, name) });
const measured = {};
const created = [];

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript(() => ["dashboard", "studio"].forEach((n) => localStorage.setItem(`netmind-tour-${n}-done`, "1")));
const page = await context.newPage();
const post = async (url, data) => {
  const response = await context.request.post(BASE + url, { data });
  if (!response.ok()) throw new Error(`${url} ${response.status()}`);
  return response.json();
};
const makeLab = async (name) => {
  const { id } = await post("/networks", { name, topology: lab() });
  created.push(id);
  return id;
};
const idFromUrl = () => Number(page.url().split("/").pop().split("?")[0]);
const center = async (id) => {
  const box = await page.locator(`.react-flow__node[data-id="${id}"]`).boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};
const linkPoint = async (a, b) => {
  const [p, q] = [await center(a), await center(b)];
  return { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
};

try {
  // 01 login
  await page.goto(`${BASE}/login`);
  await shot(page, "01-login.png");
  await page.getByRole("button", { name: "Enter simulator" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));

  // 02 template picker
  await page.locator(".template-grid .template-card").first().waitFor();
  measured.templateCards = await page.locator(".template-grid .template-card").count();
  measured.lessonCards = await page.locator(".lesson-grid .template-card").count();
  await page.locator(".template-grid").scrollIntoViewIfNeeded();
  await shot(page, "02-template-picker.png");

  // 03 blank canvas
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByLabel("Network name").fill("Presentation blank");
  await page.getByRole("button", { name: /Create blank network/ }).click();
  await page.waitForURL(/\/simulator\/\d+/);
  created.push(idFromUrl());
  await page.locator(".react-flow").waitFor();
  await page.waitForTimeout(600);
  await shot(page, "03-blank-canvas.png");

  // 04 50-device topology (canvas) with critical-device badges
  const big = await post("/networks/generate", { name: `Presentation 50 ${Date.now()}`, category: "campus", device_count: 50, protocol: "ospf", form: { protocol: "ospf", style: "hierarchical", routers: 6, firewalls: 2, switches: 8, access_points: 3, hubs: 1, repeaters: 1, servers: 4, hosts: 25, redundancy: true } });
  created.push(big.network.id);
  measured.bigDevices = big.topology.nodes.length;
  measured.bigLinks = big.topology.links.length;
  await page.goto(`${BASE}/simulator/${big.network.id}?panel=canvas`);
  await page.locator(".react-flow__node").first().waitFor();
  await page.waitForTimeout(1200);
  await shot(page, "04-topology-50-devices.png");

  // Lab on the canvas for the fault walk-through
  const id = await makeLab(`Presentation lab ${Date.now()}`);
  await page.goto(`${BASE}/simulator/${id}?panel=simulate`);
  await page.locator(".react-flow__node").first().waitFor();
  await page.getByLabel("Routing").selectOption("ospf");
  await page.waitForTimeout(800);

  // 05 right-click menu on a link
  const mid = await linkPoint("r1", "r2");
  await page.mouse.click(mid.x, mid.y, { button: "right" });
  await page.getByRole("menuitem", { name: "Set link down" }).waitFor();
  await shot(page, "05-right-click-menu.png");

  // 06 link-down before/after
  const t0 = Date.now();
  await page.getByRole("menuitem", { name: "Set link down" }).click();
  await page.locator(".impact-card").filter({ hasText: "LIVE CHANGE APPLIED" }).waitFor();
  measured.liveChangeMs = Date.now() - t0;
  await page.waitForTimeout(500);
  await shot(page, "06-link-down-before-after.png");

  // 08 routing table diff, 09 convergence timeline
  await page.getByRole("link", { name: /Tables/ }).click();
  await page.getByLabel("Table device").selectOption("r1");
  await page.locator("tr.row-changed").first().waitFor();
  await page.waitForTimeout(400);
  await shot(page, "08-routing-table-diff.png");
  await page.getByRole("button", { name: "Compare Static vs RIP vs OSPF" }).click();
  await page.locator(".convergence table tbody tr").nth(2).waitFor();
  await page.locator(".convergence").scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await shot(page, "09-convergence-timeline.png");
  measured.convergenceRows = await page.locator(".convergence table tbody tr").allInnerTexts();

  // restore the link, then 07 slow-motion with layer view
  await page.getByRole("link", { name: /Canvas/ }).click();
  const mid2 = await linkPoint("r1", "r2");
  await page.mouse.click(mid2.x, mid2.y, { button: "right" });
  await page.getByRole("menuitem", { name: "Restore link" }).click();
  await page.getByRole("link", { name: /Simulate/ }).click();
  await page.getByLabel("Packets", { exact: true }).fill("1");
  await page.getByRole("button", { name: "Send & play in slow motion" }).click();
  for (let i = 0; i < 80; i += 1) {
    const links = await page.locator(".react-flow__edge:has(.sim-packet)").evaluateAll((items) => items.map((e) => e.getAttribute("data-id")));
    if (links.includes("l3")) break;
    await page.waitForTimeout(100);
  }
  await page.getByRole("button", { name: "Pause" }).click();
  await page.locator(".packet-list button").first().click();
  await page.locator(".packet-inspector").scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await shot(page, "07-slow-motion-layer-view.png");
  measured.hopRows = await page.locator(".packet-inspector table tbody tr").allInnerTexts();

  // 10 event log
  await page.getByRole("link", { name: /Logs/ }).click();
  await page.waitForTimeout(500);
  await shot(page, "10-event-log.png");

  // 14 TCP ladder (static + fault)
  await page.getByRole("link", { name: /Simulate/ }).click();
  await page.getByLabel("Routing").selectOption("static");
  await page.getByLabel("Fault", { exact: true }).selectOption("link-down");
  await page.getByLabel("Target").selectOption("l3");
  await page.getByLabel("Scenario", { exact: true }).selectOption("tcp");
  await page.getByLabel("Inject the fault selected above mid-scenario").check();
  await page.getByRole("button", { name: "Show sequence diagram" }).click();
  await page.locator(".ladder-card").waitFor();
  await page.waitForTimeout(400);
  await shot(page.locator(".ladder-card"), "14-tcp-ladder-failure.png");
  measured.ladderTitle = await page.locator(".ladder-card h2").innerText();

  // 12 AI explain (static routing, link down)
  await page.getByRole("link", { name: /Canvas/ }).click();
  const mid3 = await linkPoint("r1", "r2");
  await page.mouse.click(mid3.x, mid3.y, { button: "right" });
  await page.getByRole("menuitem", { name: "Set link down" }).click();
  await page.getByRole("link", { name: /AI/ }).click();
  const t1 = Date.now();
  await page.getByRole("button", { name: /^Explain:/ }).click();
  await page.locator(".ai-answer").first().filter({ hasText: "Answered by:" }).waitFor({ timeout: 45000 });
  measured.explainMs = Date.now() - t1;
  measured.explainAnsweredBy = (await page.locator(".ai-answer").first().innerText()).split("\n")[0];
  await page.waitForTimeout(400);
  await shot(page, "12-ai-explain.png");

  // 13 critical-device badges: office template + dependency view
  await page.goto(`${BASE}/`);
  await page.locator(".template-grid .template-card").filter({ hasText: "Small office" }).click();
  await page.waitForURL(/\/simulator\/\d+/);
  created.push(idFromUrl());
  await page.getByRole("link", { name: /Canvas/ }).click();
  const first = page.locator(".critical-list li").first();
  await first.waitFor();
  measured.officeTop = await first.innerText();
  await first.getByRole("button").click();
  await page.locator(".dependency-view").waitFor();
  await page.waitForTimeout(600);
  await shot(page, "13-critical-device-badges.png");

  // 11 AI generate (dashboard prompt, then the validated result)
  await page.goto(`${BASE}/`);
  await page.getByLabel("Network name").fill(`Presentation AI ${Date.now()}`);
  await page.getByLabel("Plain-English request").fill("A small hospital network with 14 devices, RIP routing and one firewall");
  await shot(page, "11a-ai-generate-request.png");
  const t2 = Date.now();
  await page.locator("button.primary-button").click();
  await page.waitForURL(/\/simulator\/\d+/, { timeout: 60000 });
  measured.generateMs = Date.now() - t2;
  created.push(idFromUrl());
  await page.locator(".planner-badge").waitFor();
  await page.waitForTimeout(1200);
  measured.plannerBadge = await page.locator(".planner-badge").innerText();
  measured.generatedDevices = await page.locator(".react-flow__node").count();
  await shot(page, "11b-ai-generate-result.png");
  console.log(JSON.stringify(measured, null, 1));
} finally {
  for (const id of created) await context.request.delete(`${BASE}/networks/${id}`).catch(() => {});
  await browser.close();
}
