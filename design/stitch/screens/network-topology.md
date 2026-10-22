# Network Topology

## Stitch reference

- Project: `14139945189700577776`
- Screen: **NetMind AI — Network Topology Matrix** (`6334a51786294daa9ef529c674049e9c`)

## Exact prompt

> Create the NetMind AI Network Topology screen in the approved Soft Liquid Minimal system. Use a dark, opaque topology canvas with a teal-first shell. Nodes represent runtime network entities and must expose: label, node type, health state, and selected state. Links represent measured connections and must expose: direction, throughput, latency, loss, and link state. Provide an explicit legend for healthy (emerald), routing (blue), degraded (amber), critical/offline (crimson), plus selected node/link. Show an inspector drawer for the selected node with live fields, last updated time, connected links, and actions that are disabled until a real implementation is wired. Show a link failure state as a crimson dashed/broken link with an accessible textual description; never encode state by color alone. Include canvas loading skeleton and an empty canvas state saying no topology data is available. Do not invent topology metrics.

## Canvas semantics and legend

| Element | Meaning | Non-color cue |
| --- | --- | --- |
| Node | Runtime network entity | Label, icon/type, and state text |
| Solid link | Measured active connection | Direction arrow and metric label |
| Dashed broken link | Failed connection | `Link failed` label in inspector and legend |
| Inspector | Selected node/link details | Heading identifies selected entity |
| Legend | State key | State name and icon accompany every color |

The canvas and inspector are data-bound. Loading shows skeleton nodes/links; empty state appears only after a successful empty response.
