export type Health = { status: string; environment: string };
export type TopologyNode = {
  id: string;
  type: string;
  interfaces: { id: string; address: string }[];
  x?: number;
  y?: number;
  processing_delay_ms?: number;
  routing_protocol?: "static" | "rip" | "ospf";
};
export type TopologyLink = {
  id: string;
  a: { node_id: string; interface_id?: string };
  b: { node_id: string; interface_id?: string };
  capacity_mbps: number;
  delay_ms: number;
  loss_pct?: number;
  jitter_ms?: number;
  state: "up" | "down" | "degraded";
};
export type Topology = {
  version: string;
  addressing_plan?: string;
  nodes: TopologyNode[];
  links: TopologyLink[];
  expected_baseline_paths?: {
    source_host_id: string;
    destination_host_id: string;
    link_ids: string[];
  }[];
};
export type TopologyResponse = {
  topology: Topology;
  source: "SIMULATED";
  last_updated: string;
};
export type NetworkSummary = {
  id: number;
  name: string;
  topology_version: string;
};
export type CopilotAnswer = {
  answer: string;
  citation_ids: string[];
  source: string;
  cloud_api_called: boolean;
  offline: boolean;
};
export type TelemetryMetric = {
  name: string;
  value: number | null;
  unit: string;
  source: "MEASURED" | "SIMULATED";
  sampled_at: string;
  ttl_seconds: number;
  state: "FRESH" | "STALE";
};
export type Incident = {
  id: number;
  network_id: number;
  title: string;
  severity: string;
  state: string;
  created_at?: string;
  evidence?: unknown;
  timeline?: { event_type?: string; created_at?: string; payload?: unknown }[];
  diagnosis?: {
    summary?: string;
    probable_cause?: string;
    confidence?: number;
  };
};

export async function getIncidents(): Promise<Incident[]> {
  const response = await fetch("/incidents?limit=100");
  if (!response.ok) throw new Error("Incidents unavailable");
  return response.json() as Promise<Incident[]>;
}

export async function getIncident(id: string): Promise<Incident> {
  const response = await fetch(`/incidents/${encodeURIComponent(id)}`);
  if (!response.ok)
    throw new Error(
      response.status === 404 ? "Incident not found" : "Incident unavailable",
    );
  return response.json() as Promise<Incident>;
}

export async function getHealth(): Promise<Health> {
  const response = await fetch("/health");
  if (!response.ok) throw new Error("Backend health check failed");
  return response.json() as Promise<Health>;
}

export async function getTopology(id = 1): Promise<TopologyResponse> {
  const response = await fetch(`/networks/${id}/topology`);
  if (!response.ok) throw new Error("Topology unavailable");
  return response.json() as Promise<TopologyResponse>;
}

export async function getNetworks(): Promise<NetworkSummary[]> {
  const response = await fetch("/networks");
  if (!response.ok) throw new Error("Networks unavailable");
  return response.json() as Promise<NetworkSummary[]>;
}

export async function generateNetwork(input: {
  name: string;
  category: string;
  device_count: number;
  protocol: string;
  prompt?: string;
}): Promise<{ network: NetworkSummary; topology: Topology; source: string }> {
  const response = await fetch("/networks/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error("Network generation failed");
  return response.json();
}

export async function createBlankNetwork(
  name: string,
): Promise<NetworkSummary> {
  const topology: Topology = {
    version: "v1",
    addressing_plan: "Not configured",
    nodes: [],
    links: [],
    expected_baseline_paths: [],
  };
  const response = await fetch("/networks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, topology }),
  });
  if (!response.ok)
    throw new Error("Blank network creation failed. Use a unique name.");
  return response.json() as Promise<NetworkSummary>;
}

export async function saveNetwork(
  id: number,
  name: string,
  topology: Topology,
): Promise<void> {
  const response = await fetch(`/networks/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, topology }),
  });
  if (!response.ok) throw new Error("Network save failed");
}

export async function deleteNetwork(id: number): Promise<void> {
  const response = await fetch(`/networks/${id}`, { method: "DELETE" });
  if (!response.ok) throw new Error("Network delete failed");
}

export async function getTelemetry(): Promise<TelemetryMetric[]> {
  const response = await fetch("/telemetry/latest");
  if (!response.ok) throw new Error("Telemetry unavailable");
  return ((await response.json()) as { metrics: TelemetryMetric[] }).metrics;
}

export async function askCopilot(
  incidentId: number,
  question: string,
): Promise<CopilotAnswer> {
  const response = await fetch("/copilot/questions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ incident_id: incidentId, question }),
  });
  if (!response.ok)
    throw new Error(
      response.status === 429
        ? "The copilot is rate-limited. Try again shortly."
        : "The copilot timed out or is unavailable.",
    );
  return response.json() as Promise<CopilotAnswer>;
}
