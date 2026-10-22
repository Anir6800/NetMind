# Architecture baseline

The repository currently contains a local capability probe and documentation only. The probe is the boundary between host capabilities and future runtime behavior:

```text
host OS/tools/privileges -> scripts/probe_capabilities.py -> capability matrix -> MININET or SIMULATED
```

No application cloud hosting configuration exists. Stitch remains design-time only; the optional NVIDIA diagnosis provider is server-only, reads its key from ignored local configuration, and falls back deterministically when unavailable. Future services must consume the probe result rather than a manually maintained mode flag.
