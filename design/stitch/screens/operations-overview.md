# NetMind AI — Operations Overview

## Stitch reference

- Project: `14139945189700577776`
- Source screen: `0ddbad2c5e104b6c9d74b3b421d5bc4e`
- Stitch generation session: `13893795250397535359`
- Generated concept: **NetMind AI — Operations Overview (Canonical)**

## Exact screen prompt

> Redesign this as the canonical "NetMind AI — Operations Overview" desktop screen, using the existing Soft Liquid Minimal dark-first system and Operational Teal (`#0D9E96`) as primary. Preserve the quiet 12-column operations shell, Inter UI and JetBrains Mono telemetry. Add: a service health summary where each service (API, simulation controller, database, auth emulator) is data-bound and renders status plus last checked time; an Incident summary whose count is explicitly bound to runtime data (for example "Active incidents: {incidentCount}")—do not invent, hard-code, or imply any incident count; a recent incidents section that renders a calm empty state ("No active incidents") when the result is empty; and a loading state treatment using neutral skeletons for all metric cards, service health rows, and incident rows. Include the loading and empty variants as clearly labeled companion panels on the screen. Keep topology/telemetry content opaque, reserve translucency for the header/filter shell, avoid gradients/glows, and do not use external cloud product branding.

## Runtime data contract

The design is not permission to display sample values as operational truth. The React implementation must render:

- `incidentCount` from the incident API response; when unavailable, show the loading treatment—not `0`.
- Service name, status, and `checkedAt` from live service-health data.
- The empty message only when service data has loaded and `incidentCount === 0`.

## Required states

| State | Incident summary | Service health | Recent incidents |
| --- | --- | --- | --- |
| Loading | Neutral skeleton | Four neutral skeleton rows | Neutral skeleton rows |
| Empty | `Active incidents: 0` from response | Live status rows | `No active incidents` |
| Populated | Response count | Live status rows | Incident rows from response |

The Stitch concept is a design-time reference; its illustrative telemetry must be replaced by runtime data before frontend implementation.
