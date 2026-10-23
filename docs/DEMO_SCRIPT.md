# NetMind demo script

## Pre-demo checklist

1. The day before, run `./run.ps1 -Check`, then run `./run.ps1` once and keep the health table/output.
2. Charge the laptop; disconnect VPN if Docker, Firebase, or an optional provider is blocked by it.
3. Have an optional Gemini key ready, or deliberately use the labelled offline fallback.
4. Start with `./run.ps1 -NoBrowser`, open the frontend, and keep `logs/` available.
5. Remember the current v0.1.0 boundary: Windows is SIMULATED; the Lab selector does not inject a live controller fault, and recovery execution is not wired to the browser.

## Five-minute version

| Time | What to click | What to say | Expected result | If it does not work |
| --- | --- | --- | --- | --- |
| 0:00 | Open **Overview** and **Topology**. | “NetMind is local-only. This badge says SIMULATED, so I will not claim Mininet measurements.” | Backend health and a topology source label appear when API data is available. | Check API health and `logs\backend.err.log`. |
| 0:45 | Open **Monitoring**. | “Every metric must state its source and freshness; stale is not live.” | `MEASURED · MININET` or `SIMULATED · FALLBACK` and `FRESH`/`STALE` labels appear for returned telemetry. | Use the committed fixture evidence; do not invent live metrics. |
| 1:20 | Open **Lab**, choose **Link down**, then **Incidents**. | “The Lab selection provides deterministic ground truth, but this UI does not send a controller command. In a connected lab, the detector waits for three breaches and correlates dependent symptoms.” | The Lab says `Selected: link_down` and explicitly says no browser command was sent. A live timestamped incident appears only if the backend/controller scenario integration is run outside this UI. | State the boundary; show `docs/evidence/screenshots/03-incident-evidence-diagnosis.png` instead of claiming injection. |
| 2:05 | Open **Incident detail** for an available incident, then **Copilot**. | “Evidence and timeline are stored facts. The localiser/provider can only explain that evidence and cites audit records.” | Evidence, timeline, diagnosis, and copilot citation IDs render if data exists. Provider failure shows `OFFLINE_READ_ONLY` and no automatic action. | Show fixture screenshots and the offline label; check logs without exposing keys. |
| 3:05 | Select **Review bounded recovery proposal** / **Recovery**. | “This is a bounded plan: evidence review and typed confirmation create an approval request, not an execution.” | **Request human approval** is disabled until acknowledgement and `RESTORE LINK` are entered; notice says no controller operation was sent. | Show the approval-gate screenshot. Viewer/operator/approver role distinctions exist in backend auth, but the current browser route has no login or role-wired approval action. |
| 4:00 | Open the audit endpoint in a new tab: `http://127.0.0.1:8000/audit/verify`. | “The audit records are hash chained. Verification reports whether the stored chain is intact.” | JSON reports `valid: true` for a migrated, populated healthy database. | If empty/unavailable, say so; do not fabricate MTTD, MTTR, execution, or rollback. |
| 4:30 | Ask Copilot an evidence question with the key absent/unavailable. | “Failure is safe: cloud diagnosis becomes a labelled read-only fallback, and no network action is proposed.” | Offline banner and `OFFLINE_READ_ONLY` source. | Set `NETMIND_NVIDIA_FIXTURE_MODE=true` in ignored `.env`, restart, and repeat. |

## Two-minute short version

1. **Topology/Monitoring (0:00–0:30):** show the `SIMULATED` badge and freshness labels. Say: “NetMind labels what is simulated or stale.”
2. **Lab/Incident (0:30–1:00):** select **Link down**. Say: “This is deterministic ground truth, not a browser-issued fault.” Show an existing incident or fixture evidence.
3. **Recovery (1:00–1:30):** show the typed confirmation and disabled approval button. Say: “No one-click recovery: approval is separate from execution.”
4. **Copilot/Audit (1:30–2:00):** show citations/offline fallback and `/audit/verify`. Say: “Diagnosis is evidence-bound; the audit chain is independently verifiable.”

## Live storyboard boundary

The requested full path—browser fault injection, timestamped incident creation, deterministic localiser display, logged-in approver action, controller execution, MTTD/MTTR, rollback, and live chain verification—cannot be honestly demonstrated from this v0.1.0 browser because those controls are not connected by the present code. The API execution endpoint returns `501`, and the Lab explicitly makes no controller call. Do not represent the fixture captures as a live run.

## Viva / Q&A

1. **Why an allowlist?** It limits the controller to reviewed typed operations, never arbitrary shell commands.
2. **Why human approval?** Diagnosis is not authority to change a network; approval separates review from execution.
3. **Why hash-chained audit?** Each event includes the prior hash, so tampering breaks verification.
4. **How does localisation work?** Deterministic probe/topology evidence narrows candidate links; it is not a free-form model guess.
5. **What is real versus simulated?** The UI labels sources; this Windows lab is SIMULATED and stale samples are explicitly marked.
6. **What happens if Gemini/NVIDIA fails?** A deterministic `OFFLINE_READ_ONLY` explanation is shown, with no automatic action.
7. **Why loopback-only ports?** The MVP is local-only and the controller must not be reachable from the network.
8. **Why no shell controller command?** Typed validation protects the privileged boundary and makes audit/review possible.
9. **What is the 7-day MVP limit?** It is a demo foundation, not a production multi-user or real-network operations system.
10. **What is next?** Source-labelled analytics first, then advisory anomaly detection and citation-constrained local RAG—never autonomous control.
