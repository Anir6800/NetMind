# AI Copilot

## Stitch reference

- Project: `14139945189700577776`
- Screen: **NetMind AI — AI Copilot (MVP)** (`da007e6dd696448bb18e6b484339e89b`)

## Exact prompt

> Create the NetMind AI Copilot screen in the approved Soft Liquid Minimal system. Present a concise recommendation, then evidence references, confidence, affected scope, risks, rollback plan, and approval state. Evidence references must link back to observed incidents, telemetry, topology entities, or policy—not invented facts. A recommendation may be drafted but never executes automatically. The only operational transition is `Request approval`; after approval, show a separate approved action state. Include loading and no-recommendation states.

## Safety rule

There is no `Execute`, `Run now`, or auto-execute control for an unapproved proposal. Risks and rollback are first-class fields beside the recommendation.
