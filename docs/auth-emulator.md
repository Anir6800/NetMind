# Firebase Auth emulator

The local project is `demo-netmind`; the Auth emulator listens on `127.0.0.1:9099` and its UI on `127.0.0.1:4000`. The frontend connects to it only in Vite development mode.

Supported custom-claim roles are `viewer`, `operator`, `approver`, and `admin`. The backend rejects tokens without one of these roles. For local backend tests only, setting `NETMIND_AUTH_ALLOW_UNSIGNED=true` accepts an unsigned JWT-shaped token and logs a warning. Never enable this setting outside local emulator/test use; normal operation verifies Firebase Admin SDK ID tokens.

The frontend uses relative API paths, so the deployed application is expected to be same-origin and does not enable permissive CORS. Authentication uses Bearer tokens rather than cookies, so no cookie-based CSRF exemption is relied on; any future cookie/session endpoint must add explicit CSRF protection. The recovery execution preflight accepts only `operator` or `admin`; approval remains restricted to `approver` or `admin` in the approval service.
