import { useQuery } from "@tanstack/react-query";
import { MetricCards } from "../features/monitoring/MetricCards";
import { getTelemetry } from "../lib/api";

export function Monitoring() {
  const telemetry = useQuery({ queryKey: ["telemetry"], queryFn: getTelemetry, refetchInterval: 5_000 });
  return <section className="page-card monitoring"><p className="eyebrow">LIVE API · TELEMETRY</p><h1>Live monitoring</h1><p>Every metric identifies its collection source and sample age. Samples older than their TTL are explicitly marked stale.</p>{telemetry.isLoading ? <p>Loading telemetry…</p> : telemetry.isError ? <p role="alert">Telemetry unavailable. No metric is being presented as live.</p> : <MetricCards metrics={telemetry.data ?? []} />}</section>;
}
