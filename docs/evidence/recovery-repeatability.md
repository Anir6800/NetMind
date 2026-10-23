# Fault and recovery repeatability record

Date: 2026-10-23. All results below are labelled by their actual source. This workspace did not run a Mininet lab or a live controller/API/database stack, so it has **no MEASURED recovery runs** and no claim below should be read as physical-network performance.

## Two successful audited recovery runs

Both runs executed `backend/tests/test_incident_recovery.py::test_seeded_incident_lifecycle_resolves_end_to_end`. The test creates an in-memory SQLite incident, injects a link-down evidence fixture, validates a bounded `restore_link` plan, issues and consumes human approval, executes, verifies three healthy probes, and asserts this audit sequence:

`detection → diagnosis → recovery_proposed → approval → recovery_execution_started → recovery_execution_confirmed → recovery_verified`

| Run | Source | Runner start (UTC) | Runner end (UTC) | Outcome | Audit result |
| --- | --- | --- | --- | --- | --- |
| A | `SIMULATED · in-memory fixture` | `2026-10-23T04:10:28.812034+00:00` | `2026-10-23T04:10:30.394661+00:00` | passed | `resolved`; seven-event sequence asserted |
| B | `SIMULATED · in-memory fixture` | `2026-10-23T04:10:30.450317+00:00` | `2026-10-23T04:10:31.923900+00:00` | passed | `resolved`; seven-event sequence asserted |

The fixture audit timestamps are deterministic rather than measured wall-clock network telemetry: detection at `T+0 ms`, diagnosis at `T+100 ms`, proposal at `T+200 ms`, approval at `T+1 s`, execution at `T+2 s`, and verification at the third healthy probe (`T+5 s`).

## 20-fault simulated injection/reset run

At local Unix wall time `1792728611.492896` through `1792728611.493188`, the deterministic `ScenarioInjector` started and stopped 20 fault records against the stored demo topology. Each record was reset before the next one.

| Fault type | Injected and reset | Source |
| --- | ---: | --- |
| `link_down` | 4 | `SIMULATED` |
| `high_latency` | 4 | `SIMULATED` |
| `packet_loss` | 4 | `SIMULATED` |
| `congestion` | 4 | `SIMULATED` |
| `node_down` | 4 | `SIMULATED` |
| **Total** | **20** | `SIMULATED` |

## Scorecard

The injector is not wired to the backend detector, telemetry store, localisation API, approval API, or recovery executor. Therefore the 20 injected records cannot truthfully supply end-to-end detection or recovery figures. `N/A` means not observed, not zero.

| Metric | Observed figure | Source / scope |
| --- | --- | --- |
| Detection rate | `N/A` | No detector observations were recorded for the 20 injector records. |
| False positives | `N/A` | No detector observations were recorded for the 20 injector records. |
| MTTD median / p95 | `N/A` | No detection timestamps were recorded for the 20 injector records. |
| MTTR median / p95 | `N/A` | No recovery executions were recorded for the 20 injector records. |
| Localisation top-1 accuracy | `N/A` | No localisation results were recorded for the 20 injector records. |
| Action success rate | `2 / 2 = 100%` | `SIMULATED · in-memory recovery fixture` only; runs A and B above. |
| Rollbacks | `0 / 2` | `SIMULATED · in-memory recovery fixture` only; both verified successfully. |
| Fixture MTTD median / p95 | `100 ms / 100 ms` | `SIMULATED · deterministic fixture`, two identical runs. |
| Fixture MTTR median / p95 | `5,000 ms / 5,000 ms` | `SIMULATED · deterministic fixture`, two identical runs. |

## What is still required for measured evidence

Run the isolated lab from [fresh-start.md](fresh-start.md), inject each fault through the token-authenticated controller, retain the incident/audit records, and link controller telemetry into the backend store. Only then replace the `N/A` fields with `MEASURED` values and claim two measured audit-backed recoveries.
