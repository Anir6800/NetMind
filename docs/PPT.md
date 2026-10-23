## Slide 1 — NetMind AI
- Purpose: Introduce the local-only network-operations MVP.
- On-slide text: NetMind AI: evidence-bound diagnosis and human-approved network recovery.
- Visual: A centred title box; below it, three small boxes labelled “Detect”, “Explain”, and “Approve”, connected left to right.
- Animation: Fade in title, then reveal the three boxes left to right; dissolve transition.
- Speaker notes: NetMind AI is our local-only college networking MVP. It brings the operations workflow into one console: a topology view, monitored telemetry, incidents, diagnosis, a recovery proposal, and an audit trail. Its central principle is that an explanation is not authority to change a network. The application therefore keeps diagnosis evidence-bound and recovery human-approved. This presentation shows both the implemented safety design and the honest limits of the current demonstration environment.
- Source: README.md; docs/architecture.md; docs/HANDOFF.md.

## Slide 2 — The problem
- Purpose: Frame the operational risk NetMind addresses.
- On-slide text:
  - Fault evidence is distributed across probes, topology, and operator decisions.
  - Free-form commands create avoidable privileged-controller risk.
  - Diagnosis must not become authority to operate networks.
- Visual: Three orange warning triangles above “Probe evidence”, “Topology”, and “Manual action”; arrows converge on a red “Risk” box.
- Animation: Reveal the three evidence sources, then the converging arrows and Risk box; push transition.
- Speaker notes: Network troubleshooting involves more than recognising a bad metric. An operator must relate probe evidence to topology, decide whether symptoms are correlated, and choose an action safely. The repository’s threat model treats telemetry and other incident inputs as untrusted evidence, not instructions. It also rejects raw shell access at the controller boundary. NetMind addresses this operational problem by preserving the evidence, constraining the diagnosis, and separating recovery approval from execution.
- Source: docs/security-threat-model.md; docs/security-controller.md; backend/tests/test_prompt_security.py; simulation-controller/tests/test_controller.py.

## Slide 3 — Objective and scope
- Purpose: State what the MVP demonstrates and what it deliberately excludes.
- On-slide text:
  - Local-only, evidence-bound incident diagnosis and recovery review.
  - SIMULATED fallback runs when Linux Mininet capabilities are unavailable.
  - Out of scope: production autonomy and live-network operation.
- Visual: A green “In scope” rectangle containing topology, incidents, diagnosis, approval; beside it, a grey “Out of scope” rectangle containing autonomous control and production networks.
- Animation: Reveal In scope first, then Out of scope; fade transition.
- Speaker notes: The scope is intentionally narrow. NetMind demonstrates a bounded workflow for a local demonstration: observe a topology, inspect source-labelled evidence, ask a read-only copilot question, and review a recovery plan. On Windows or another host without required Linux networking capabilities, the capability probe selects SIMULATED mode. That mode models path effects; it does not measure a real network. Production autonomy, hosted deployment, and live-network operations are explicitly outside this MVP.
- Source: README.md; docs/simulation-modes.md; docs/HANDOFF.md; docs/next-features.md; ai-memory.md.

## Slide 4 — Architecture
- Purpose: Explain the local components and the trust boundary.
- On-slide text: React console → FastAPI → telemetry, incident, diagnosis, policy → PostgreSQL/audit → controller or SIMULATED fallback.
- Visual: Six rounded rectangles in a left-to-right chain: “React console”, “FastAPI”, “Telemetry · Incident · Diagnosis · Policy”, “PostgreSQL + hash audit”, and a split final pair “Loopback controller” / “SIMULATED fallback”. A dashed cloud above Diagnosis says “Optional NVIDIA/Gemini provider”.
- Animation: Build the chain left to right; reveal the optional cloud last with a dashed fade; wipe transition.
- Speaker notes: The browser is the operations console. It calls FastAPI, where telemetry, incident handling, diagnosis, and recovery policy are separated from the privileged controller. PostgreSQL stores operational records, while audit events are hash chained. The controller is a token-authenticated loopback process, not a browser endpoint. If Mininet is not supported, the same typed controller contract uses a deterministic SIMULATED fallback. Optional cloud diagnosis remains server-side and can fall back to a deterministic read-only result.
- Source: README.md; docs/architecture.md; docs/simulation-modes.md; docs/security-controller.md; backend/app/main.py; backend/app/repositories/audit.py.

## Slide 5 — Telemetry and trust
- Purpose: Show how NetMind prevents simulated or stale data being presented as live.
- On-slide text:
  - Every telemetry payload carries a source label.
  - MEASURED means controller-observed; SIMULATED means modelled.
  - Freshness is visible; stale samples are never current proof.
- Visual: Screenshot `docs/evidence/screenshots/06-monitoring-stale-label.png`, with callouts around “MEASURED · MININET”, “SIMULATED · FALLBACK”, “FRESH”, and “STALE”.
- Animation: Show screenshot; pulse source labels, then freshness labels; fade transition.
- Speaker notes: Trust begins with precise labelling. The telemetry contract exposes a source, timestamp, time-to-live, and state for every metric. In the committed fixture screenshot, round-trip time is labelled MEASURED · MININET and fresh, while packet loss is labelled SIMULATED · FALLBACK and stale. That screenshot is fixture-backed, not a claim about this Windows host. The simulation-mode contract says SIMULATED data models topology and path effects, whereas MEASURED is reserved for controller-observed results.
- Source: docs/simulation-modes.md; backend/app/api/telemetry.py; frontend/src/features/monitoring/MetricCards.tsx; frontend/e2e/netmind-smoke.spec.ts; docs/evidence/screenshots/06-monitoring-stale-label.png.

## Slide 6 — Incident detection
- Purpose: Explain deterministic detection, correlation, and lifecycle controls.
- On-slide text:
  - Three consecutive breaches open a deterministic incident.
  - Three clear samples resolve it; flap damping suppresses repeats.
  - Link failures suppress dependent host symptoms.
  - Lifecycle: open → acknowledged → resolved.
- Visual: A timeline with sample marks 1, 2, 3 leading to “Open”; three green clear marks leading to “Resolved”; a side branch shows downstream host symptoms suppressed by link failure.
- Animation: Build threshold samples, then resolution samples, then correlation branch; wipe transition.
- Speaker notes: The detector is deterministic rather than an opaque anomaly model. Its documented rules require three consecutive breaches to open loss, latency, or unreachable-host incidents and three clear samples to resolve them. It correlates topology evidence so an active link failure suppresses dependent host symptoms, avoiding duplicate alarms. Recently resolved events are flap-damped. The incident state machine permits open to acknowledged or resolved, and acknowledged to resolved; illegal reverse transitions are rejected by tests.
- Source: ai-memory.md; backend/tests/test_detector.py; backend/app/services/incidents/detector.py.

## Slide 7 — Fault localisation
- Purpose: Explain the probe-path method with a concrete mini example.
- On-slide text:
  - Failed paths identify candidate links; passed paths clear candidates.
  - Mini example: three failed paths leave two candidate links.
  - A passed host-a link removes that link from suspicion.
- Visual: Draw three horizontal probe paths. Mark failed-a, failed-b, failed-c red; mark passed green. Underneath, draw candidate-link pills “router-a-router-b” and “switch-a-router-a”; strike through “host-a-switch-a”.
- Animation: Reveal failed paths, then passed path, then surviving candidates; dissolve transition.
- Speaker notes: Localisation uses the topology and probe paths rather than a language-model guess. In the tested example, three failed probe paths overlap around two candidate links: router-a-router-b and switch-a-router-a. A passed probe across host-a-switch-a removes that link from consideration. This is a small network-tomography style set-cover idea: failures narrow the set, while successful observations clear edges. Provider output is later checked against this server-derived candidate set.
- Source: backend/tests/test_ai_diagnosis.py; backend/app/services/ai/diagnosis.py; data/topologies/demo_six_nodes.json.

## Slide 8 — AI diagnosis with guardrails
- Purpose: Show evidence-bounded AI output and safe outage behaviour.
- On-slide text:
  - Structured diagnosis references validated evidence and candidate links.
  - Unknown evidence, commands, and unsafe actions are rejected.
  - Missing Gemini returns OFFLINE_FIXTURE, read-only fallback.
- Visual: A funnel: “Incident evidence” enters; “Schema + evidence validation” is the narrow middle; outputs are “Diagnosis” and “OFFLINE_FIXTURE”. A crossed-out command prompt sits outside the funnel.
- Animation: Build funnel top to bottom; reveal crossed-out command last; fade transition.
- Speaker notes: AI is constrained to explain evidence, not control the network. The diagnosis schema validates evidence IDs, candidate links, confidence, and action references against server-provided data. Tests reject invented evidence, free-form commands, non-allowlisted actions, and invalid confidence values. If Gemini has no key or cannot provide a usable result, the adapter returns a labelled OFFLINE_FIXTURE diagnosis with offline true and no action interface. The recorded Gemini attempt had an invalid key and correctly fell back; it is not presented as an online success.
- Source: backend/tests/test_ai_diagnosis.py; backend/tests/test_gemini_adapter.py; docs/evidence/llm-fallback.md; docs/security-threat-model.md.

## Slide 9 — Safe recovery policy
- Purpose: Explain recovery as a bounded proposal rather than a command.
- On-slide text:
  - Only typed, allowlisted recovery actions reach the controller.
  - Policy checks topology, permissions, telemetry freshness, and blast radius.
  - Example: restore_link expects down, targets up, with rollback.
- Visual: A four-gate diagram: “Allowlist” → “What-if policy” → “Human approval” → “Controller”. Add a side rollback arrow from Controller back to the original link state.
- Animation: Reveal gates one at a time; animate rollback arrow after Controller; wipe transition.
- Speaker notes: NetMind does not treat a diagnosis as an executable instruction. A recovery proposal is typed and allowlisted, then evaluated against a policy context that includes topology, permissions, telemetry freshness, and blast radius. The tested restore_link example expects router-a-router-b to be down, targets it up, carries low-risk metadata, and specifies a rollback action. Invalid or unknown action plans do not reach the executor. This is the safety boundary between useful assistance and uncontrolled network change.
- Source: backend/tests/test_recovery_policy.py; backend/tests/test_recovery_execution.py; backend/schemas/recovery.py; docs/security-controller.md.

## Slide 10 — Human approval and security
- Purpose: Show the controls that make approval distinct, attributable, and non-replayable.
- On-slide text:
  - Approver role required; proposer cannot self-approve.
  - Approval binds a plan hash, HMAC signature, expiry, and nonce.
  - Consumed nonces prevent replay; mismatches are rejected.
- Visual: Two person icons labelled “Operator” and “Approver”, separated by a signed plan card. The card lists hash, HMAC, expiry, nonce. A replay arrow is blocked by a lock icon.
- Animation: Reveal operator, plan card, approver, then lock; fade transition.
- Speaker notes: Approval is a separate security boundary, not a checkbox. The approval service binds the proposal hash to an authorised approver and issues a signed, expiring nonce. Tests show that a viewer role is rejected, a mismatched plan hash is rejected, an expired approval is rejected, a consumed nonce cannot be reused, and the proposer cannot approve their own plan. The UI fixture shows acknowledgement and typed confirmation before a request, but the browser does not execute the controller action.
- Source: backend/tests/test_recovery_approval.py; docs/security-threat-model.md; frontend/e2e/netmind-smoke.spec.ts; docs/evidence/screenshots/04-approval-gate.png.

## Slide 11 — Execution and verification
- Purpose: Describe bounded execution, post-action verification, and rollback.
- On-slide text:
  - One active recovery action per network.
  - Successful verification requires consecutive healthy probes.
  - Failed verification rolls back and marks the plan failed.
  - Fixture result: MTTD 500 ms; MTTR 3,000 ms.
- Visual: A sequence diagram: approve → execute → three green probes → verified. A second red branch from failed probe goes to rollback. Label the green timing “SIMULATED fixture: 500 ms / 3,000 ms”.
- Animation: Build successful path first, then reveal rollback branch; push transition.
- Speaker notes: Execution is idempotent and prevents overlapping active actions on the same network. In the verification test, three healthy probes after execution resolve the incident; the fixture records MTTD of 500 milliseconds and MTTR of 3,000 milliseconds. A failed verification calls rollback, returns the link to down, and marks the plan failed. These values are SIMULATED test-fixture outcomes, not measured network performance. The broader repeatability record separately reports its deterministic fixture timing.
- Source: backend/tests/test_recovery_execution.py; backend/tests/test_recovery_verify.py; docs/evidence/recovery-repeatability.md.

## Slide 12 — Tamper-evident audit trail
- Purpose: Explain how NetMind detects changed operational history.
- On-slide text:
  - Each canonical JSON event includes the prior SHA-256 hash.
  - Any edited payload breaks subsequent verification.
  - Live check: GET /audit/verify returns valid or first invalid ID.
- Visual: Seven linked blocks labelled detection, diagnosis, proposal, approval, start, confirmed, verified. Each block contains “prev hash → record hash”. Add a red edited-payload block with a broken chain icon.
- Animation: Build the chain left to right; turn one altered block red; dissolve transition.
- Speaker notes: NetMind preserves provenance with an append-only hash chain. Each audit event stores canonical JSON, the preceding record hash, and its own SHA-256-based record hash. Verification recomputes the chain and reports the first invalid event if a payload has been changed. The end-to-end fixture asserts a seven-event recovery sequence from detection through verification. The API exposes this control through GET /audit/verify, which reports a boolean validity result and an invalid event ID when applicable.
- Source: backend/app/repositories/audit.py; backend/app/api/audit.py; backend/tests/test_audit.py; backend/tests/test_incident_recovery.py.

## Slide 13 — Live demo flow
- Purpose: Give a six-step, evidence-aware walkthrough.
- On-slide text: Six steps: label mode, inspect topology, select scenario, inspect incident, review approval, verify audit.
- Visual: A 2×3 grid using these screenshot paths in order: `docs/evidence/screenshots/01-lab-simulated.png`; `02-topology-simulated.png`; `06-monitoring-stale-label.png`; `03-incident-evidence-diagnosis.png`; `04-approval-gate.png`; `05-offline-failure-mode.png`. Add a final arrow beneath the grid to “GET /audit/verify”.
- Animation: Reveal each tile in reading order; final arrow appears last; fade transition.
- Speaker notes: Start by showing the SIMULATED badge and source labels. Inspect the topology and metric freshness, then select Link down in the Simulation Lab. The current browser selector does not issue a controller command, so present it as deterministic ground truth only. Open a prepared incident to show evidence, timeline, and diagnosis. Review the bounded recovery proposal and the approval gate. Finally, show the offline copilot fallback and call the audit verification endpoint. These screenshot captures are fixture-backed UI evidence, not proof of a live controller run.
- Source: docs/DEMO_SCRIPT.md; docs/demo-script.md; docs/evidence/README.md; docs/evidence/screenshots/01-lab-simulated.png; docs/evidence/screenshots/02-topology-simulated.png; docs/evidence/screenshots/03-incident-evidence-diagnosis.png; docs/evidence/screenshots/04-approval-gate.png; docs/evidence/screenshots/05-offline-failure-mode.png; docs/evidence/screenshots/06-monitoring-stale-label.png.

## Slide 14 — Results scorecard
- Purpose: Present only the recorded outcomes and clearly mark unmeasured outcomes.
- On-slide text:
  - Injected/reset faults: 20 SIMULATED, four of each scenario.
  - Detection, false positives, localisation accuracy: NOT MEASURED.
  - Two SIMULATED fixture recoveries: 2/2 success; 0/2 rollbacks.
  - Fixture MTTD/MTTR: 100 ms / 5,000 ms, SIMULATED.
- Visual: A two-column scorecard. Left column shows “20 SIMULATED injections” with five rows of 4. Right column shows “2/2 SIMULATED fixture recoveries”, “0/2 rollbacks”, and a grey NOT MEASURED row for detection, false positives, localisation, and end-to-end MTTD/MTTR.
- Animation: Reveal recorded results first; reveal grey NOT MEASURED row last; wipe transition.
- Speaker notes: This scorecard separates what was actually recorded from what was not. The deterministic ScenarioInjector started and stopped 20 SIMULATED faults: four each of link down, high latency, packet loss, congestion, and node down. Those injector records were not wired to the backend detector or executor, so detection rate, false positives, localisation accuracy, and end-to-end MTTD and MTTR are NOT MEASURED. Two in-memory recovery fixtures succeeded, with no rollbacks; their deterministic timing was 100 milliseconds MTTD and 5,000 milliseconds MTTR.
- Source: docs/evidence/recovery-repeatability.md; simulation-controller/tests/test_scenarios.py; backend/tests/test_incident_recovery.py.

## Slide 15 — Reliability and failure handling
- Purpose: Demonstrate safe responses to provider and controller failure conditions.
- On-slide text:
  - Gemini failure: OFFLINE_FIXTURE, read-only, no automatic action.
  - Controller restart: active execution is reconciled to rollback.
  - Chaos coverage: 20 SIMULATED injections; end-to-end detection NOT MEASURED.
- Visual: Three horizontal lanes: “Cloud provider” ends in OFFLINE_FIXTURE; “Controller restart” ends in rollback; “Scenario injector” shows 20 SIMULATED markers. Put a grey NOT MEASURED badge on detector linkage.
- Animation: Reveal cloud lane, controller lane, injector lane; fade transition.
- Speaker notes: NetMind fails toward safety. The recorded Gemini attempt was rejected because its configured key was invalid; the adapter returned OFFLINE_FIXTURE with no action interface. If the controller restarts with an active execution, reconciliation rolls it back. The repository also records 20 deterministic SIMULATED scenario injections and resets, but that injector is not wired to the backend detector or recovery executor. Therefore it is honest to call the fault count SIMULATED while calling end-to-end detection performance NOT MEASURED.
- Source: docs/evidence/llm-fallback.md; backend/tests/test_recovery_execution.py; docs/evidence/recovery-repeatability.md; simulation-controller/tests/test_scenarios.py.

## Slide 16 — Limitations and honest claims
- Purpose: Make the MVP’s boundaries explicit before conclusions.
- On-slide text:
  - Windows capability probe selected SIMULATED mode.
  - Browser Lab selection does not inject controller faults.
  - Browser recovery execution API returns 501.
  - Frontend dependency audit has four high-severity findings.
- Visual: A boundary sign divided into “Demo capability” and “Not production-ready”. Under Not production-ready, place icons for Windows simulation, disconnected Lab, 501 execution, and dependency alert.
- Animation: Reveal demo capability side, then limitations side; dissolve transition.
- Speaker notes: NetMind is not a production network-control platform. The recorded Windows environment selected SIMULATED mode because Mininet capabilities were unavailable. The current Lab page is a presenter aid: selecting a scenario does not send a controller command. The browser recovery execution API is not wired and returns 501. Finally, the acceptance gate is recorded as FAIL for release readiness because the frontend dependency audit found four high-severity transitive advisories. These limits are part of the result, not details to hide.
- Source: ai-memory.md; docs/DEMO_SCRIPT.md; docs/demo-script.md; docs/acceptance/netmind-mvp.md; docs/codebase_audit.md.

## Slide 17 — Future work
- Purpose: Describe the next safe increments without expanding authority.
- On-slide text:
  - Advisory ML anomaly detection over source-labelled telemetry.
  - Citation-constrained local RAG over approved evidence.
  - Read-only analytics before charts, automation, or hosting.
- Visual: A three-step roadmap: “Telemetry retention”, “Advisory ML + RAG”, “Read-only analytics”. A lock icon remains above every step labelled “Human approval unchanged”.
- Animation: Reveal roadmap left to right; lock remains visible throughout; push transition.
- Speaker notes: The next work should improve visibility before it expands control. The documented priority is source-labelled telemetry retention, then an advisory anomaly baseline evaluated against deterministic rules. Retrieval-augmented diagnosis should remain read-only, provenance-aware, role-aware, and protected against prompt injection. Advanced analytics should display calculation windows, sources, and missing or stale states. Across every V1 item, outputs remain hypotheses; actions remain typed, policy-validated, human-approved, controller-side, verified, and rollback-capable.
- Source: docs/next-features.md; docs/HANDOFF.md.

## Slide 18 — Thank you and questions
- Purpose: Close with concise, evidence-based answers to likely questions.
- On-slide text: Thank you — questions on simulation, AI guardrails, approval, audit, or next steps.
- Visual: A clean closing slide with the NetMind name centred and five small question-mark circles along the bottom.
- Animation: Fade in title, then question circles; fade transition.
- Speaker notes: Likely question one: why an allowlist? It limits controller operations to reviewed typed actions. Two: why human approval? A diagnosis is not authority to change a network. Three: why hash-chain the audit? Changing a stored event breaks verification. Four: what is real here? The Windows lab is SIMULATED; fixture screenshots are not live-controller proof. Five: what comes next? Capture source-labelled telemetry, then advisory analytics, anomaly detection, and local citation-constrained RAG without autonomous control.
- Source: docs/demo-script.md; docs/security-controller.md; docs/simulation-modes.md; docs/next-features.md.

## Facts checklist

| Fact or number | Classification | Source |
| --- | --- | --- |
| 18 slides | MEASURED document structure | docs/PPT.md |
| Three consecutive breaches open incidents | SIMULATED deterministic rule | ai-memory.md; backend/tests/test_detector.py |
| Three clear samples resolve incidents | SIMULATED deterministic rule | ai-memory.md; backend/tests/test_detector.py |
| 10 offline Gemini golden-set cases | SIMULATED test fixture | docs/evidence/llm-fallback.md; backend/tests/test_gemini_adapter.py |
| 20 injected/reset faults; four per scenario | SIMULATED | docs/evidence/recovery-repeatability.md |
| Two successful recovery fixtures | SIMULATED in-memory fixture | docs/evidence/recovery-repeatability.md |
| 2/2 fixture action success; 0/2 rollbacks | SIMULATED in-memory fixture | docs/evidence/recovery-repeatability.md |
| Fixture MTTD 100 ms; fixture MTTR 5,000 ms | SIMULATED deterministic fixture | docs/evidence/recovery-repeatability.md |
| Verification-test MTTD 500 ms; MTTR 3,000 ms | SIMULATED test fixture | backend/tests/test_recovery_verify.py |
| Three healthy probes in verification test | SIMULATED test fixture | backend/tests/test_recovery_verify.py |
| Four high-severity frontend dependency findings | MEASURED dependency audit | docs/acceptance/netmind-mvp.md |
| 125 backend tests passed in handoff record | MEASURED test record | README.md; ai-memory.md; docs/evidence/README.md |
| Two frontend fixture E2E tests passed | MEASURED test record | README.md; ai-memory.md; docs/evidence/README.md |

## Missing evidence

- Detection rate across the 20 injected faults: NOT MEASURED.
- False-positive count or rate across the 20 injected faults: NOT MEASURED.
- Localisation top-1 accuracy: NOT MEASURED.
- End-to-end MTTD median or p95 for injector records: NOT MEASURED.
- End-to-end MTTR median or p95 for injector records: NOT MEASURED.
- MEASURED Mininet or live-network recovery performance: NOT MEASURED.
- Successful online Gemini diagnosis and Gemini p50/p95 latency: NOT MEASURED.
- Full clean launcher, live controller/recovery, login, and shutdown path: NOT RUN in the NM-RUN record.
