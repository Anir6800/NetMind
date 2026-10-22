# Simulation modes

NetMind selects `MININET` only on a capable Linux host; otherwise it runs `SIMULATED`. The UI must show a visible `SIMULATED` badge and must not describe generated values as measured network traffic.

| Mode | Adapter | Telemetry source | Claim boundary |
| --- | --- | --- | --- |
| `MININET` | privileged controller | `MEASURED` | Reports only controller-observed results |
| `SIMULATED` | deterministic NetworkX fallback | `SIMULATED` | Models topology/path effects; it does not measure a network |

Both adapters expose the same typed allowlisted controller contract. In simulated mode, link failure removes that edge from the graph and recomputes the expected host paths. Every telemetry payload includes `source` so consumers can render the correct badge and wording.
