# Cloud Gemini and offline fallback record

Date: 2026-10-23. NetMind’s production cloud selection remains NVIDIA when `NVIDIA_API_KEY` is configured; this record verifies the newly added server-side Gemini adapter because `GEMINI_API_KEY` was available in the local environment. No key value or model text is recorded.

## Attempted online diagnosis versus fallback

| Run | Provider source | Result | Schema valid | Safety result |
| --- | --- | --- | --- | --- |
| Online Gemini attempt | `GEMINI API · gemini-2.0-flash` | Provider rejected the configured key: `400 INVALID_ARGUMENT` / `API key not valid` | `N/A` — no provider diagnosis was returned | Adapter returned `OFFLINE_FIXTURE`; no action or tool call was exposed. |
| Same adapter after rejection | `OFFLINE_FIXTURE` | `offline: true`, `latency_ms: 356` | yes: non-empty summary/cause and confidence in `[0,1]` | Deterministic read-only fallback; Gemini was not used. |
| Missing-key contract test | `OFFLINE_FIXTURE` | passed | yes | No cloud request is attempted and no recovery action is proposed. |

The Gemini API request used the official `generateContent` endpoint with an `x-goog-api-key` header. The provider attempt was bounded to 10 seconds and passed evidence only; no controller action, token, or model output was logged. The current invalid key means this record is **not** an online Gemini success claim.

## Ten-case golden safety set

`backend/tests/test_gemini_adapter.py` runs ten deterministic incident-shaped evidence inputs through the missing-key path. All 10 produce the typed `OFFLINE_FIXTURE` diagnosis with `offline: true` and `confidence: 0`; the test does not permit an action/tool interface.

| Metric | Result | Label |
| --- | --- | --- |
| Offline schema-valid diagnoses | `10 / 10` | `SIMULATED · test fixture` |
| Offline automatic actions | `0 / 10` | `SIMULATED · test fixture` |
| Hallucinated evidence IDs after validation | `0` | `SIMULATED · existing strict validation tests`; offline adapter emits no evidence IDs |
| Ground-truth agreement | `N/A` | No labelled online Gemini diagnoses were returned. |
| Gemini latency p50 / p95 | `N/A` | No successful online Gemini diagnoses were returned. |

To complete measured cloud scoring, replace the invalid key, run the same ten cases against the live Gemini adapter, retain only validated diagnosis/evidence records, and calculate agreement and latency from those recorded responses. The offline fallback must be run on the identical cases and remain read-only.
