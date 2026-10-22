# Incident Detail

## Stitch reference

- Project: `14139945189700577776`
- Screen: **NetMind AI — Incident Detail (MVP)** (`920d56132be6489c9c121766ad71f054`)

## Exact prompt

> Create the NetMind AI Incident Detail screen in the approved Soft Liquid Minimal system. Establish a clear hierarchy: incident title/severity/status at the top, action bar below, chronological timeline in the primary column, and evidence panels in a right inspector column. Evidence panels contain only data-bound source, timestamp, confidence, and raw payload/reference links. Keep action labels explicit: `Acknowledge`, `Assign`, `Request approval`, and `Open recovery plan`. Do not expose an auto-execute action. Include loading skeletons and a not-found/empty evidence state without fabricated logs.

## Evidence hierarchy

1. Incident identity and active status.
2. Timeline, newest relevant event first or clearly labeled chronological order.
3. Evidence: source, timestamp, confidence, payload/reference.
4. Suggested next step with approval requirement.

Incident Center and Detail use the same severity, status, timeline, and evidence terminology.
