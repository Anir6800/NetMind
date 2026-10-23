export type Health = { status: string; environment: string };
export type TopologyNode = { id: string; type: string; interfaces: { id: string; address: string }[] };
export type Topology = { version: string; nodes: TopologyNode[]; links: { id: string; a: { node_id: string }; b: { node_id: string }; state: "up" | "down" | "degraded" }[] };
export type TopologyResponse = { topology: Topology; source: "SIMULATED"; last_updated: string };
export type CopilotAnswer = { answer: string; citation_ids: string[]; source: string; cloud_api_called: boolean; offline: boolean };
export type TelemetryMetric = { name: string; value: number | null; unit: string; source: "MEASURED" | "SIMULATED"; sampled_at: string; ttl_seconds: number; state: "FRESH" | "STALE" };
export type Incident = { id: number; network_id: number; title: string; severity: string; state: string; created_at?: string; evidence?: unknown; timeline?: { event_type?: string; created_at?: string; payload?: unknown }[]; diagnosis?: { summary?: string; probable_cause?: string; confidence?: number } };

export async function getIncidents(): Promise<Incident[]> {
  const response = await fetch("/incidents");
  if (!response.ok) throw new Error("Incidents unavailable");
  return response.json() as Promise<Incident[]>;
}

export async function getIncident(id: string): Promise<Incident> {
  const response = await fetch(`/incidents/${encodeURIComponent(id)}`);
  if (!response.ok) throw new Error(response.status === 404 ? "Incident not found" : "Incident unavailable");
  return response.json() as Promise<Incident>;
}

export async function getHealth(): Promise<Health> {
  const response = await fetch("/health");
  if (!response.ok) throw new Error("Backend health check failed");
  return response.json() as Promise<Health>;
}

export async function getTopology(): Promise<TopologyResponse> {
  const response = await fetch("/networks/1/topology");
  if (!response.ok) throw new Error("Topology unavailable");
  return response.json() as Promise<TopologyResponse>;
}

export async function getTelemetry(): Promise<TelemetryMetric[]> {
  const response = await fetch("/telemetry/latest");
  if (!response.ok) throw new Error("Telemetry unavailable");
  return (await response.json() as { metrics: TelemetryMetric[] }).metrics;
}

export async function askCopilot(incidentId: number, question: string): Promise<CopilotAnswer> {
  const response = await fetch("/copilot/questions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ incident_id: incidentId, question }) });
  if (!response.ok) throw new Error(response.status === 429 ? "The copilot is rate-limited. Try again shortly." : "The copilot timed out or is unavailable.");
  return response.json() as Promise<CopilotAnswer>;
}
