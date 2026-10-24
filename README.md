# NetMind Student Network Lab

NetMind is a local-only teaching simulator for designing and testing computer networks. Students can build a topology, send common protocol packets, introduce a fault, and watch routes and calculated timing change without touching a real network.

## What you can learn

- Build or generate networks with up to 50 routers, switches, hubs, repeaters, hosts, servers, firewalls, and access points.
- Compare static routing, RIP, and OSPF.
- Simulate ICMP, ARP, DHCP, DNS, TCP, UDP, and HTTP packets.
- Preview link/device failures, congestion, latency, and loss before confirming them.
- Inspect propagation, transmission, processing, queueing, loss, TTL, bottleneck bandwidth, route changes, and event logs.
- Ask the labelled `SIMULATED_AI_PLANNER` to explain the selected path and suggest a safe change.

## Beginner workflow

1. Start Docker Desktop and double-click `run.bat`.
2. Sign in as `student@netmind.local` with `NetMindDemo!2026`.
3. Choose one of 20 ready-made 50-device labs, or generate your own.
4. Drag devices onto the canvas and connect their handles.
5. Select routing, packet, source, destination, failure, and target.
6. Click **Preview** to inspect the impact without changing the lab.
7. Click **Confirm & execute** to animate the simulated result and logs.
8. Click **Save network** to persist the topology in local PostgreSQL.

## Stable handoff: v0.1.0

This release is intended for local learning and demonstration only. Start with the [operations handbook](docs/setup/operations.md).

The simulator is labelled `SIMULATED`; its timings are calculated models, not packet captures from physical hardware. All services bind to the local machine.

## Verification

The release handoff was verified with:

- frontend fixture E2E tests: 2 passed;
- frontend production build: passed;
- backend tests: 125 passed.

The live controller stack must be checked on the target machine with `bash scripts/check-netmind.sh` after Docker Desktop's Linux engine is running. Do not present fixture evidence as a live controller run.

## Development

Run the local capability probe:

```text
python scripts/probe_capabilities.py
```

It selects `MININET` only when the required Linux networking capabilities are present; otherwise it selects `SIMULATED`.

## Branch conventions

- `main`: stable reviewed work.
- `dev`: integration branch for completed task work.
- `feature/<task-id>-<short-name>`: task implementation branches.
- `fix/<task-id>-<short-name>`: corrective work.

Keep secrets in local environment files or secret stores; never commit credentials.
