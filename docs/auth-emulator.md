# Firebase Auth emulator

The local project is `demo-netmind`; the Auth emulator listens on `127.0.0.1:9099` and its UI on `127.0.0.1:4000`. The frontend connects to it only in Vite development mode.

Supported custom-claim roles are `viewer`, `operator`, `approver`, and `admin`. The backend rejects tokens without one of these roles. For local backend tests only, setting `NETMIND_AUTH_ALLOW_UNSIGNED=true` accepts an unsigned JWT-shaped token and logs a warning. Never enable this setting outside local emulator/test use; normal operation verifies Firebase Admin SDK ID tokens.
