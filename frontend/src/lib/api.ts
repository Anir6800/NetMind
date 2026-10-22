export type Health = { status: string; environment: string };
export type TopologyNode = { id: string; type: string; interfaces: { id: string; address: string }[] };
export type Topology = { version: string; nodes: TopologyNode[]; links: { id: string; a: { node_id: string }; b: { node_id: string }; state: "up" | "down" | "degraded" }[] };
export type TopologyResponse = { topology: Topology; source: "SIMULATED"; last_updated: string };

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
