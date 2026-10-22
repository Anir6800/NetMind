# Stitch integration

Stitch is a design-time input only. The NetMind runtime does not call Stitch, Gemini, or any other cloud design service.

## Access policy

- Use Stitch MCP only when the editor has an authenticated connection.
- Never store a Stitch API key, access token, session cookie, or generated credential in Git.
- If editor access is absent, use the manual fallback in `design/stitch/HANDOFF.md`: the master prompt, approved reference, token CSS, and existing React overview shell are sufficient.

## Handoff contract

| Design source | React destination |
| --- | --- |
| Approved visual direction | `design/stitch/MASTER_PROMPT.md` |
| Semantic token values | `design/tokens.json` and `frontend/src/styles/tokens.css` |
| Screen structure | React route/components under `frontend/src/app/` |
| Runtime data | Existing local API client under `frontend/src/lib/` |

The fallback is reproducible by following the five steps in `HANDOFF.md` and running the frontend build. This keeps the shell independent of cloud design tooling.
