export type TopologyNode = {
  id: string;
  name?: string;
  type: string;
  interfaces: { id: string; address: string }[];
  x?: number;
  y?: number;
  processing_delay_ms?: number;
  routing_protocol?: "static" | "rip" | "ospf";
  state?: "up" | "down";
  acl?: { action: "allow" | "deny"; protocol: string }[];
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
  length_m?: number;
  queue_packets?: number;
  utilisation_pct?: number;
  ospf_cost?: number;
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

export type Answered = { source: "NVIDIA" | "LOCAL_RULES" | "FORM" | "TEMPLATE"; answered_by: string; notes: string[] };

async function post<T>(url: string, body: unknown, failure: string): Promise<T> {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(typeof detail?.detail === "string" ? detail.detail : failure);
  }
  return response.json() as Promise<T>;
}

export type NetworkForm = {
  protocol: string;
  style: string;
  routers: number;
  firewalls: number;
  switches: number;
  access_points: number;
  hubs: number;
  repeaters: number;
  servers: number;
  hosts: number;
  redundancy: boolean;
};

export function generateNetwork(input: {
  name: string;
  category: string;
  device_count: number;
  protocol: string;
  prompt?: string;
  form?: NetworkForm;
}): Promise<{ network: NetworkSummary; topology: Topology; summary: string } & Answered> {
  return post("/networks/generate", input, "Network generation failed");
}

export async function getAiStatus(): Promise<{ mode: "LIVE" | "LOCAL_RULES"; answered_by: string; reason: string }> {
  const response = await fetch("/ai/status");
  if (!response.ok) throw new Error("AI status unavailable");
  return response.json();
}

export type Explanation = Answered & { root_cause: string; affected_layers: string[]; explanation: string; timing: string };
export const explainChange = (facts: unknown) => post<Explanation>("/ai/explain", facts, "Explanation failed");

export type SuggestionList = Answered & { suggestions: import("../sim/edit").Suggestion[] };
export const suggestChanges = (request: unknown) => post<SuggestionList>("/ai/suggest", request, "Suggestions failed");

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

