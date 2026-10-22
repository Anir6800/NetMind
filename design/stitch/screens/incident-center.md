# Incident Center

## Stitch reference

- Project: `14139945189700577776`
- Screen: **NetMind AI — Incident Center (MVP)** (`2331775b3e5d434da360d0445a46915c`)

## Exact prompt

> Create the NetMind AI Incident Center as a compact, data-bound work queue in the approved Soft Liquid Minimal system. Include filter controls, incident list/table, severity/status badges, title, affected service, opened time, assignee, and current timeline phase. Preserve hierarchy: severity and status first, summary second, metadata third. All row counts and incidents come from the API; use skeleton rows during loading and a calm `No incidents match these filters` empty state after a loaded empty result. Selecting a row navigates to its Incident Detail. Do not render fabricated operational incidents.

## Action consistency

Actions are contextual and non-destructive by default: `Open detail`, `Assign`, and `Acknowledge` require a selected real incident and role authorization. Severity is always shown with text, icon, and color.
