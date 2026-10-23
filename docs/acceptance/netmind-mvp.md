# NetMind MVP acceptance — security and permission gates

Run date: 2026-10-23. Scope: local source, deterministic fixtures, and locked dependency manifests.

## Result: FAIL — do not treat this revision as security-release ready

The application permission, recovery, controller, source-analysis, and Python dependency gates pass. The production frontend dependency gate fails because the locked Firebase dependency tree contains four high-severity `@grpc/grpc-js` advisories. `npm audit` reports only a breaking `firebase@9.14.0` downgrade via `npm audit fix --force`; that change was not applied without a compatibility review.

| Gate | Result | Evidence |
| --- | --- | --- |
| Protected approvals and execution | PASS | `cd backend; python -m pytest tests/test_security.py tests/test_recovery_approval.py` — 12 passed. Role matrix rejects unauthenticated/unauthorised execution; forged and expired emulator tokens, wrong roles, cross-user approval consumption, replay, expiry, tampering, and proposer self-approval are rejected. |
| Allowlisted recovery and policy validation | PASS | `cd backend; python -m pytest tests/test_recovery_policy.py` — 17 passed. Invalid or unknown action plans do not reach the executor. |
| Verified recovery and rollback | PASS | `cd backend; python -m pytest tests/test_recovery_verify.py tests/test_recovery_execution.py tests/test_incident_recovery.py` — 6 passed. Successful verification resolves; failed verification rolls back and marks the plan failed. |
| No raw shell, local binding, argument/log validation | PASS | `python -m pytest simulation-controller/tests/test_controller.py` — 6 passed. The controller rejects `run_shell`, validates known interfaces, binds loopback, and the source test rejects `shell=True`. |
| Secret scan | PASS | `git grep` credential-pattern scan found no tracked credentials; tracked-file scan found no `.env`, private-key, certificate, or service-account file. The ignored local `.env` was not read or printed. |
| Python dependency audit | PASS | `pip-audit -r backend/requirements.lock` — no known vulnerabilities found. The audit tool was installed into a disposable OS temporary directory only. |
| Frontend production dependency audit | **FAIL** | `cd frontend; npm audit --omit=dev --audit-level=high` — 4 high-severity findings through `firebase` → `@firebase/firestore` → `@grpc/grpc-js` (GHSA-m9gg-hp2v-232j and GHSA-f596-whhp-79r4). |
| Static analysis | PASS | `cd backend; python -m ruff check --select S app` and `python -m ruff check .` both passed. Production workflow assertions were replaced with runtime validation so optimisation cannot remove the guard. |
| Full regression suites | PASS | `cd backend; python -m pytest` — 125 passed; `python -m pytest simulation-controller/tests` — 19 passed. |
| Frontend build and fixture E2E | PASS | `cd frontend; npm run build` passed; `npm run test:e2e` passed (1 Playwright fixture flow). The build emitted only its existing 500 kB chunk-size warning. |

## Required remediation before security release

Upgrade or replace the Firebase dependency path with a non-vulnerable, supported version; run the frontend build, fixture E2E, and `npm audit --omit=dev --audit-level=high` again. A passing audit is required to change the overall result to PASS.
