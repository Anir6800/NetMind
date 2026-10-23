# Frontend

Presentation and user interaction layer for NetMind.

The incident center reads `/incidents` and `/incidents/:id`; select an incident from the list to open its live detail view. Evidence, timeline, and diagnosis render when provided by the API and otherwise show an explicit unavailable state.

The incident list subscribes to `/events` over SSE and resumes from the last event ID. If the stream is unavailable it polls `/events/poll` for up to 12 attempts before stopping, without interrupting the UI.

The Recovery Center deliberately has no one-click execution path: reviewers must inspect the exact action and rollback, check consent, and type the confirmation phrase before it records an approval request.
