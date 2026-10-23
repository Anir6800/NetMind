# NetMind operations demo — three minutes

## Before the audience arrives

Start the local stack and run `bash scripts/check-netmind.sh`. Prepare one deterministic `link_down` scenario with its resulting incident already visible through the incident API. Capture the run in `docs/evidence/` using the checklist there. The Simulation Lab selector is a presenter aid; it does not send a controller command from the browser.

Do not invent a latency, loss percentage, timestamp, MTTD, MTTR, plan hash, or successful recovery. Read the values shown by the current run. If a required screen or evidence item is unavailable, say so and stop at that boundary.

The committed screenshot pack in `docs/evidence/screenshots/` is fixture-backed UI evidence. It is explicitly labelled `SIMULATED`, `OFFLINE_READ_ONLY`, or `STALE` as appropriate and is not a substitute for a live controller-run audit export.

## 0:00–0:30 — Ground truth and detection

1. Open **Simulation Lab** and select **Link down**. Say: “This is a deterministic simulated fault. The browser is not privileged to operate the controller.”
2. Open **Incident center**. Point out the `LIVE API` label and its streaming/polling state. Open the prepared incident.
3. On **Incident detail**, show the raw evidence and timeline. Say: “These are stored incident facts: source, affected link, and event history. We do not turn missing values into a claim.”

## 0:30–1:20 — Diagnosis bounded by evidence

1. Read the displayed diagnosis summary and probable cause exactly as shown. Say: “The diagnosis is a hypothesis constrained to incident evidence, not a controller instruction.”
2. If monitoring data is available, show the metric cards. Identify the visible `MEASURED · MININET` or `SIMULATED · FALLBACK` source, sample age, and any `STALE` warning.
3. If the cloud provider is unavailable, show the outage banner instead. Say: “The system has switched to deterministic read-only mode. It proposes no automatic action.”

## 1:20–2:15 — Human approval, not one-click recovery

1. Follow **Review bounded recovery proposal** to the Recovery Center.
2. Read the exact action, evidence, expected effect, rollback, risk, expiry, and displayed plan-hash prefix. Say: “The plan is bounded; changing it changes its hash.”
3. First show that **Request human approval** is disabled. Then check the review acknowledgement and type `RESTORE LINK`.
4. Submit the request and show “Awaiting an authorized approver. No controller operation has been sent.” Say: “This screen records a request. An authenticated authorized human approval, bound to the plan hash and one-time nonce, is still required before execution.”

## 2:15–3:00 — Recovery proof and safety outcome

1. For an approved, executed lab run, show the audit/timeline entries for execution and verification. State the actual recovery state: `resolved`, `rolled_back`, or `failed`.
2. If verification succeeded, read the recorded MTTD/MTTR and the consecutive probe count exactly from the evidence. Explain that recovery requires loss under the baseline threshold and RTT within 120% of baseline for consecutive samples.
3. If verification failed, show the rollback entry and say: “The action was bounded, verification failed, and the controller rolled it back. The incident remains open.”
4. Close: “NetMind detects and explains evidence, but does not autonomously change the network. A human approves a bounded plan, and verification—not optimism—decides the outcome.”

## Presenter recovery lines

- **No incident appears:** “The deterministic scenario did not reach the incident API. I will not claim detection; I’ll check the controller and event evidence.”
- **Metric is stale:** “This is historical telemetry, not live telemetry. The warning is intentional.”
- **Cloud diagnosis unavailable:** “The safe fallback is read-only; no automated recovery proposal is produced.”
- **Approval/execution unavailable:** “Approval is a security boundary. We stop before execution rather than bypass it for the demo.”
