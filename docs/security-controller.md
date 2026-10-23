# Local controller isolation

The simulation controller is a separate process and listens only on `127.0.0.1:8765`; it is not an HTTP route and must never bind to `0.0.0.0`. Every JSON-RPC request needs the `NETMIND_CONTROLLER_TOKEN`, is size-limited, parsed as JSON, and is checked by the topology-backed action allowlist.

Only typed recovery operations reach the controller. Raw shell commands and arbitrary command arguments are not part of the protocol. Subprocess calls use argument arrays with `shell=False`; the controller test suite rejects any future `shell=True` usage and verifies the loopback binding.

Mininet commonly needs Linux network privileges. Keep those privileges outside the web API boundary: run the controller under a dedicated local account where possible and set `NETMIND_CONTROLLER_UID` (plus `NETMIND_CONTROLLER_GID` when needed) when a root-launched POSIX process can clear inherited groups and drop privileges after setup. Keep the controller token in local environment configuration, never command-line arguments or logs. Rejection messages are generic to clients and sanitised before logging.
