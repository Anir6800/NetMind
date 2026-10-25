# NetMind Student Network Lab

NetMind is a local teaching lab for computer networks, in the spirit of Cisco Packet Tracer. Students build or generate a network of up to 50 devices, send packets, break links and devices, and watch in slow motion what happens at every device, layer, routing table and timer.

> **Everything NetMind shows is SIMULATED.** Delays, paths, routing tables, convergence and packet events are calculated by an educational model running in your browser on Windows. They are not measurements from real equipment and not a vendor-accurate emulation. See [docs/sim_model.md](docs/sim_model.md) for every formula, timer and assumption, and for what is not modelled.

## Quick start (students)

1. Start **Docker Desktop** and wait for "Engine running".
2. Double-click **`run.bat`** (or run `.\run.ps1` in PowerShell). The first run installs dependencies; later runs take about a minute. It opens <http://127.0.0.1:5173>. Stop everything with **`stop.bat`**.
3. Sign in with the demo student account **`student@netmind.local` / `NetMindDemo!2026`**, or create your own account (local only).
4. On **Networks**, either:
   - pick one of the prepared labs,
   - click **Create blank network — build it myself**, or
   - **Generate**: describe the network in plain English (AI) or fill in the **Detailed form** (no AI).
5. Use the floating pill at the bottom to switch drawers: **Canvas · Simulate · Tables · Logs · AI**.

## What you can do

| Task | How |
|---|---|
| Build | Canvas drawer → click or drag a device onto the canvas (router, switch, hub, repeater, PC, server, firewall, access point). Drag from a device's right-hand handle to another device to connect, or select a device and use **Connect to**. Rename and edit IP addresses in the inspector. |
| Right-click | **Device**: power down / restore, rename, edit interfaces, delete, set as source / destination, show its tables. **Link**: down / restore, edit bandwidth / delay / length / loss / jitter / queue / load / OSPF cost, delete. **Empty canvas**: add a device there. Keyboard: select with Tab + Enter, then **Shift+F10**. |
| See impact | Every down/restore instantly shows a **before vs after** card: path, hops, TTL at the destination, one-way delay, RTT, loss, bottleneck throughput, which devices lost or regained reachability, and the affected OSI layers. Red = worse, green = better. |
| Preview a fault | Simulate drawer → **Fault preview** → Preview impact (nothing changes) → **Apply** only if you want it. |
| Watch packets | Simulate drawer → **Send & play in slow motion**. Speeds 0.1× – 10× (1× = 10 ms of network time per real second), pause, step to the next event, scrub the virtual clock. Pick a packet to see its **layer view** (encapsulation, what each device opens) and per-hop `t_proc + t_queue + t_tx + t_prop`. |
| Routing | Tables drawer: live routing table per router (rows coloured added / changed / removed after a change), learned ARP and MAC tables, **traceroute**, and the **convergence timeline** with a one-click **Static vs RIP vs OSPF** comparison. |
| Logs | Logs drawer: every simulation event, filterable by device, packet, layer and protocol, exportable as CSV or JSON. |
| AI | AI drawer: **Explain** the last change (uses only the simulator's own numbers) and **Suggest** fixes (each one opens a before/after preview; nothing changes until you click Apply). The panel always says who answered: `NVIDIA … (LIVE AI)` or `Local rule-based planner (not AI)`. |
| Save | **Save** stores the network in local PostgreSQL. **Undo / Redo** with Ctrl+Z / Ctrl+Y. **Find device** focuses it on the canvas. |

## How it works (for the viva)

**One calculator.** All numbers come from `frontend/src/sim/engine.ts`. Preview, the live right-click change, the slow-motion player and the unit tests call the same functions, and a test proves Preview and live results are identical.

**Timing per hop** (all in [docs/sim_model.md](docs/sim_model.md)):

- transmission `t_tx = bits / bandwidth` — 1500 B on 10 Mbps = 1.2 ms
- propagation `t_prop = length / 2×10⁸ m/s` (2 km = 0.01 ms) or the configured link delay
- processing `t_proc` by device type: router 0.5 > firewall 0.4 > switch 0.05 > repeater 0.01 > hub 0.005 ms
- queueing: M/M/1/K estimate from link load in the calculator; an explicit FIFO with tail drop in the packet simulator
- hop delay = `t_proc + t_queue + t_tx + t_prop`; RTT = forward + return path

**Devices by layer.** Hubs and repeaters work at L1 (repeat bits; no store-and-forward). Switches and access points work at L2 (learn MAC addresses, flood unknown frames). Routers and firewalls work at L3 (longest-prefix match, TTL − 1, new L2 header, ICMP Time Exceeded at TTL 0; firewalls also apply allow/deny rules). Hosts and servers encapsulate and de-encapsulate L7 → L1.

**Routing.** Static routes never change on their own, so traffic is blackholed after a failure. RIP uses hop count (16 = unreachable) with 30 s updates, triggered updates, invalid 180 s, flush 240 s and split horizon with poison reverse (switch it off to see count-to-infinity). OSPF uses cost = 1000 Mbps / bandwidth, hello 10 s, dead 40 s, LSA flooding and SPF after 200 ms. A cable cut next to a router is noticed immediately (carrier loss); a break behind a switch is only noticed by the dead/invalid timer.

**AI, honestly labelled.** The configured provider is NVIDIA's OpenAI-compatible API (key only in the server-side `.env`, never sent to the browser or logged). The model only returns JSON data — a device-count spec, an explanation, or allowlisted suggestions — which the server validates (≤ 50 devices, unique names and IPs, connected graph, numbers grounded in the simulation) before anything is saved or drawn. Model output is never executed. With no key, a failing provider or an open circuit breaker, a labelled local rule-based planner answers instead.

## Verification

Run these from the repository root:

```text
cd backend  && python -m pytest -q && python -m ruff check app tests
cd frontend && npm test && npm run build
cd frontend && npx playwright test     # needs the stack from run.ps1
```

The latest observed results are recorded per work package in [ai-memory.md](ai-memory.md).

## Icons and licences

UI and device icons come from Google's **Material Symbols** (rounded style, via the `@material-symbols/svg-400` and `svg-300` npm packages, Apache License 2.0). They are self-hosted: `npm run icons` (`frontend/scripts/build-icons.mjs`) copies only the icons the app uses into `frontend/src/components/icons/material.generated.ts`, so nothing loads from a CDN and the app works offline. The switch, hub, repeater and firewall symbols are original drawings (Material has no clear match); they are not copied from any vendor icon set.

## Development notes

- Ports: PostgreSQL 5432, API 8000, frontend 5173 (falls back to 5174), Firebase Auth emulator 9099, controller 8765. `run.ps1 -Check` checks them without starting anything.
- `run.ps1` sets `NETMIND_NVIDIA_FIXTURE_MODE=false` when `NVIDIA_API_KEY` is present in `.env`; `GET /ai/status` shows whether AI is LIVE.
- Keep secrets in `.env` (git-ignored); never commit credentials.
- Branches: `master` stable; `feature/<task>` and `fix/<task>` for work in progress.
