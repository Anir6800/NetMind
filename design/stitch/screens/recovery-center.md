# Recovery Center

## Stitch reference

- Project: `14139945189700577776`
- Screen: **NetMind AI — Recovery Center (MVP)** (`bd43cbf48d774e348f8d12526d3147c2`)

## Exact prompt

> Create the NetMind AI Recovery Center in the approved Soft Liquid Minimal system. List recovery plans with target incident, proposed actions, evidence references, known risks, rollback steps, owner, and explicit approval state. A plan cannot be executed from this screen until the approval state is `Approved`; before that, expose `Request approval` only. Render execution progress only from real runtime data. Provide loading, no-recovery-plan, and failed-rollback states without invented logs.

## Approval contract

| State | Allowed primary action |
| --- | --- |
| Draft | Request approval |
| Pending approval | View approver/status |
| Approved | Execute approved plan |
| Executing/complete/failed | View progress and rollback evidence |

No unapproved plan displays an executable control.
