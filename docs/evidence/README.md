# Demo evidence pack

Store evidence from one real deterministic run here. Do not commit tokens, database dumps containing credentials, or fabricated screenshots. Use neutral filenames such as `01-health.txt`, `02-incident.json`, and `03-recovery.png`.

| Item | Capture from | Claim it supports |
| --- | --- | --- |
| Local health | `bash scripts/check-netmind.sh` output | Local dependencies were reachable at demo start. |
| Injected fault | Controller/scenario output with scenario and source | The fault was deliberately injected, not inferred afterward. |
| Incident evidence | `GET /incidents/:id` response or incident-detail screenshot | Title, severity, evidence, and timeline are API-backed. |
| Diagnosis | Incident detail or Copilot response | The displayed summary/probable cause is evidence-bound; preserve source/offline label. |
| Telemetry | Monitoring screenshot or API response | Source, timestamp/sample age, value, and `STALE` state are visible. |
| Approval request | Recovery Center screenshot | Review acknowledgement and typed confirmation precede the request; no browser-side execution occurred. |
| Execution audit | Audit/timeline export | Approved execution used the displayed plan hash/idempotency key and state transition. |
| Verification/rollback | Audit/timeline export plus probes | Actual verification result, consecutive samples, MTTD/MTTR when recorded, and rollback on failure. |

## Capture rules

1. Record timestamps in the tool’s native format and retain the raw API JSON where practical.
2. Label simulated data as `SIMULATED`; do not call it Mininet-measured. Preserve `MEASURED` only when the source reports it.
3. Keep stale samples visibly marked. A stale sample cannot be used as proof of current connectivity.
4. Preserve failed or rolled-back outcomes. Do not replace them with a “successful” recovery narrative.
5. Redact bearer tokens, controller tokens, API keys, cookies, and connection strings before storing any artifact.
