# Stitch to React handoff

## Preferred path: connected Stitch editor

Use the project `14139945189700577776` only when the editor exposes the authenticated Stitch MCP connection. Read project/screen metadata, inspect the approved **Soft Liquid Minimal Design System** screen, and export HTML/CSS or screenshots through the editor tools. Do not add a Stitch API key, browser token, or credentials file to this repository.

Before copying generated UI, replace visual literals with the semantic variables in `frontend/src/styles/tokens.css`. Keep generated markup inside the existing React route/component boundary; do not replace the app shell, API client, or authentication initialization.

## Manual fallback: reproduce the shell

This fallback requires no editor connection, account, key, or export:

1. Copy the approved visual constraints from `MASTER_PROMPT.md`.
2. Import `../styles/tokens.css` in the React entry point (already done in `frontend/src/main.tsx`).
3. Keep the overview route at `/` and build the shell with a `main` landmark, `NetMind` heading, overview description, and backend-health status.
4. Use `--nm-canvas`, `--nm-surface`, `--nm-text`, `--nm-primary`, and `--nm-border` rather than raw colors. Use opaque surfaces for telemetry/topology content.
5. Verify with `npm run build` from `frontend/`.

The current `frontend/src/app/router.tsx` is the minimal reproducible shell. It remains usable whether Stitch output is available or not.
