# NetMind simulation model

Everything NetMind shows — delays, paths, routing tables, convergence, packet events — is **SIMULATED**: calculated by an educational model in the browser, not measured on real equipment and not a vendor-accurate emulation. It runs on Windows with no privileges.

All calculations live in `frontend/src/sim/`. The canvas, the Preview button, the live right-click controls, the slow-motion player and the unit tests (`npm test` in `frontend/`) call the same functions, so there is one calculator.

| File | Responsibility |
|---|---|
| `engine.ts` | Timing formulas, L3 adjacency, routing tables, longest-prefix match, forwarding, faults, before/after impact |
| `des.ts` | Discrete-event packet simulator with a virtual clock |
| `convergence.ts` | RIP / OSPF convergence timelines after a change, traceroute |
| `protocols.ts` | ICMP / ARP / DHCP / DNS / TCP / UDP / HTTP ladder scenarios |
| `analysis.ts` | Articulation points, bridges, betweenness, dependants |

## 1. Per-hop timing

For a packet of `B` bytes crossing a link of bandwidth `C` Mbps:

| Term | Formula | Notes |
|---|---|---|
| Transmission | `t_tx = B × 8 / (C × 10⁶)` s | 1500 B over 10 Mbps = 1.2 ms |
| Propagation | `t_prop = length / 2×10⁸ m/s` | if `length_m` is set (2 km = 0.01 ms), otherwise the link's configured `delay_ms` |
| Processing | `t_proc` per device type | router 0.5, firewall 0.4, access point 0.08, switch 0.05, repeater 0.01, hub 0.005, host/server 0.1 ms |
| Queueing | see §2 | |
| **Hop delay** | `t_proc + t_queue + t_tx + t_prop` | |

* One-way delay = Σ hop delays + processing at the destination.
* RTT = one-way delay forward + one-way delay of the reply on the return path (which may differ).
* Hubs and repeaters relay bits as they arrive (cut-through), so they add `t_proc` and `t_prop` but no second `t_tx`. Switches, routers and hosts are store-and-forward.
* Jitter: the analytical calculator reports the configured jitter as a ± range; the packet simulator draws a seeded uniform value in `[0, jitter]` per hop.
* Loss along a path = `1 − Π (1 − loss_link)(1 − P_drop,link)`.
* Throughput = the smallest `C × (1 − ρ)` on the path (the bottleneck link is reported).

## 2. Queueing (both models are used, and this is how)

* **Analytical (Preview, live before/after)** — an M/M/1/K estimate per link driven by its configured background utilisation `ρ` (`utilisation_pct`, 0–99 %) and queue capacity `K` (`queue_packets`, default 64):
  * mean wait `W_q = ρ / (1 − ρ) × t_tx`
  * tail-drop probability `P_K = (1 − ρ) ρ^K / (1 − ρ^(K+1))`
  * The "Congestion" fault sets `ρ = 95 %`.
* **Packet simulator** — an explicit FIFO per link direction. A packet waits until the link finishes the previous frame; if `K` packets are already waiting it is tail-dropped ("queue full"). Background load adds the M/M/1 mean wait above and a seeded `P_K` drop draw.

## 3. Devices and layers

| Device | Highest layer | Behaviour modelled |
|---|---|---|
| Hub | L1 | Repeats bits out of every other port; one shared collision domain (collisions are *not* simulated) |
| Repeater | L1 | Regenerates the signal |
| Switch / access point | L2 | Learns source MAC per ingress port, forwards on a MAC-table hit, floods unknown unicast and broadcasts. The AP bridges wireless and wired as an L2 device (radio effects not modelled) |
| Router | L3 | Longest-prefix match, TTL − 1, new L2 header, ICMP Time Exceeded when TTL reaches 0 |
| Firewall | L3 | Router behaviour plus first-match allow/deny rules per protocol |
| Host / server | L7 | Encapsulation L7→L1 at the source, de-encapsulation L1→L7 at the destination |

**L3 adjacency.** Two L3 devices are neighbours when a path of only L1/L2 devices joins them. Routing therefore counts routers, not switches (RIP hop count is router hops). When there are several L2 paths, the one with fewest links is used — spanning tree itself is not modelled.

**Addressing.** Every interface's subnet is a prefix. Routes are per prefix; the nearest device that owns the prefix is the route's destination. A connected route (`C`) delivers on the local segment after ARP; if the destination is not on that segment the packet is dropped ("ARP unanswered").

## 4. Routing tables (converged state)

| Protocol | Metric | Behaviour after a failure |
|---|---|---|
| Static (`S`) | hop count | Computed once from the design (all links up). Never changes on its own: packets are **blackholed** at the router whose next hop is gone |
| RIP (`R`) | router hops, max 15 (16 = unreachable) | Re-converges (see `convergence.ts` and §6) |
| OSPF (`O`) | sum of interface costs, `cost = 1000 Mbps / bandwidth` (min 1, overridable per link) | Re-converges (see §6) |

## 4a. Convergence after a change (`convergence.ts`)

Each router keeps its own view and the result is replayed on a timeline; when it settles the tables equal §4 on the new topology (unit-tested).

**Detection**
* Carrier loss (the failed link is directly attached, or the neighbour on that cable powered off): detected at t = 0.
* Failure behind a switch (the router's own interface stays up): only a timer notices — OSPF dead interval 40 s (hello 10 s, so 30–40 s after the failure) or RIP invalid timer 180 s (150–180 s). The neighbour on the broken side may still detect immediately.
* An interface that loses every link withdraws its connected route.

**RIP (educational timers, all seeded):** periodic full update every 30 s per router (random phase), triggered updates 1–5 s after a change, Bellman-Ford (`metric = advertised + 1`, 16 = unreachable), a route from the current next hop is always accepted (even if worse), invalid 180 s, flush 240 s (unreachable routes are removed 60 s after reaching 16). Split horizon with poison reverse can be switched off; without it (and without triggered updates) a ring shows count-to-infinity. Hold-down timers are not modelled.

**OSPF (educational):** neighbour detection as above; new adjacency after the next hello (0–10 s) with database exchange; the detecting router originates a new Router-LSA (neighbours with interface cost, connected prefixes) which is flooded hop by hop (link delay + 1 ms processing), each router installs newer LSAs and refloods; SPF runs 200 ms after the first new LSA, using only links listed by both ends (two-way check). Areas, DR/BDR and LSA types other than Router-LSA are not modelled.

**Static:** routes never change by themselves; traffic over a failed next hop is blackholed until the student restores the link or edits the design.

**Outputs:** detection time, convergence time (last table change, excluding flushes), per-router change count, the student flow's outage (table states replayed through the same forwarding function) and packets lost at 100 packets/s. "Compare Static vs RIP vs OSPF" runs all three on the same change.

**Traceroute:** probes with TTL 1, 2, 3… using the same forwarding function; each router where TTL reaches 0 replies ICMP Time Exceeded, the destination replies Port Unreachable; RTT = analytical delay to the replier and back.

## 5. Packet simulator (discrete events)

* Each packet's path is exactly `forward()` from the engine; the simulator adds time.
* Event queue ordered by virtual time; seeded PRNG (mulberry32) for loss, jitter and background drops, so the same seed gives the same run.
* Cold ARP by default: the first frame from each L3 hop is preceded by an ARP broadcast who-has / unicast is-at exchange, which also teaches switches both MAC addresses. "ARP caches already warm" skips ARP so the first data frame shows unknown-unicast flooding.
* ICMP, TCP, HTTP, DNS and DHCP requests get a reply; UDP is one-way. TTL expiry generates an ICMP Time Exceeded packet back to the sender.
* Playback: `1× = 10 ms of simulated time per real second`; speeds 0.1×–10×, pause, step to next event.
* Events can be filtered by device, packet, layer and protocol and exported as CSV or JSON.

## 5a. Protocol scenarios (`protocols.ts`)

Each scenario is a ladder of messages; every message's delivery and delay come from the engine (`forward` + `pathMetrics` for its size) at the moment it is sent, so a fault injected mid-scenario shows its real consequence. Each ladder lists its own simplifications; in short: ICMP 2 s timeout; ARP 3 tries 1 s apart, cache 300 s; DHCP Discover retransmitted at 4 s / 8 s, lease 86400 s; DNS retry after 2 s twice, answer TTL 300 s then a local cache hit; TCP slow start (cwnd doubles per RTT), Tahoe-style reset, fixed RTO 1 s doubling, up to 3 retransmissions, no fast retransmit/SACK/receive window/Nagle; UDP no ACK; HTTP/1.1 single GET over TCP.

## 5b. Critical-device analysis (`analysis.ts`)

On the physical graph of up devices and up links (parallel links count separately): articulation points and bridges by Tarjan's low-link algorithm; "if X fails, N devices lose reachability" = devices that leave the largest connected group when X fails (a tie is reported as an equal split); betweenness by Brandes' algorithm counting shortest paths between end devices (hosts/servers) only, raw pair sums. Dependency view: upstream = shortest path to the busiest router/firewall (the core), downstream = devices lost if it fails, and the student's flows through it with the OSI layers that device handles.

## 5c. Prepared labs

`backend/app/services/templates.py` defines 25 prepared labs (campus, office, data centre, ISP, home, mesh, WAN, legacy hub LAN, a generated-complexity ladder, 6–50 devices), all built by the same deterministic builder and validated (schema, connected, unique IPs, ≤ 50 devices). `data/templates/*.json` are exported by `scripts/export_templates.py`; tests check the files match a fresh build and that sample host pairs are routable under static, RIP and OSPF.

## 6. Not modelled

* Full vendor behaviour (Cisco/Juniper defaults, CLI, timers beyond those listed), spanning tree, VLANs, NAT, IPv6.
* Physical-layer effects: collisions/CSMA-CD, signal attenuation, radio interference, duplex mismatch.
* Complete TCP (only the parts listed in the protocol scenarios: handshake, slow start/window, retransmission on loss, teardown).
* Real packet capture or traffic generation: nothing leaves the browser.
