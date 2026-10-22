# Architecture baseline

The repository currently contains a local capability probe and documentation only. The probe is the boundary between host capabilities and future runtime behavior:

```text
host OS/tools/privileges -> scripts/probe_capabilities.py -> capability matrix -> MININET or SIMULATED
```

No application backend, cloud hosting configuration, or online Gemini/Stitch runtime dependency is present yet. Future services must consume the probe result rather than a manually maintained mode flag.
