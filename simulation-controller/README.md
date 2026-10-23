# Simulation controller

Separate local-only boundary for observing and controlling the simulation. Start it in a dedicated process with `NETMIND_CONTROLLER_TOKEN` set; it binds only to `127.0.0.1:8765` and rejects unauthenticated, malformed, oversized, or non-allowlisted JSON-RPC requests.

The controller accepts typed recovery verbs only. It never accepts a shell command, and every action is validated against `data/topologies/demo_six_nodes.json` before it reaches the adapter. Rejection logs are sanitised to prevent control-character injection.

For Mininet, run this process under a dedicated local account. When the process starts as root on POSIX, set `NETMIND_CONTROLLER_UID` (and `NETMIND_CONTROLLER_GID` when it differs) to clear inherited groups and drop privileges after the required network setup; do not expose the port through a container mapping or reverse proxy.
