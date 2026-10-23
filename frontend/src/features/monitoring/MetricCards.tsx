import { useEffect, useState } from "react";
import type { TelemetryMetric } from "../../lib/api";

function ageSeconds(sampledAt: string, now: number) { return Math.max(0, Math.floor((now - new Date(sampledAt).getTime()) / 1000)); }

export function MetricCards({ metrics }: { metrics: TelemetryMetric[] }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1_000); return () => window.clearInterval(timer); }, []);
  if (!metrics.length) return <p>No telemetry samples are available.</p>;
  return <div className="metric-cards">{metrics.map((metric) => {
    const age = ageSeconds(metric.sampled_at, now);
    const stale = age > metric.ttl_seconds;
    return <article className={`metric-card${stale ? " metric-card--stale" : ""}`} key={metric.name} data-testid={`metric-${metric.name}`}>
      <div><p className="eyebrow">{metric.source === "MEASURED" ? "MEASURED · MININET" : "SIMULATED · FALLBACK"}</p><h2>{metric.name}</h2></div>
      <strong>{metric.value === null ? "Unavailable" : `${metric.value} ${metric.unit}`}</strong>
      <p>Sampled {new Date(metric.sampled_at).toLocaleTimeString()} · {age}s old</p>
      <p className={stale ? "metric-state metric-state--stale" : "metric-state"} role={stale ? "status" : undefined}>{stale ? `STALE — older than ${metric.ttl_seconds}s TTL` : "FRESH"}</p>
    </article>;
  })}</div>;
}
