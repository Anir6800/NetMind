import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DeviceInspector } from "../features/topology/DeviceInspector";
import { NetworkCanvas } from "../features/topology/NetworkCanvas";
import { getTopology, type TopologyNode } from "../lib/api";

export function Topology() {
  const [selected, setSelected] = useState<TopologyNode | null>(null);
  const query = useQuery({ queryKey: ["topology"], queryFn: getTopology, refetchInterval: 5000 });
  if (query.isLoading) return <section className="page-card"><p>Loading topology from API…</p></section>;
  if (query.isError || !query.data) return <section className="page-card"><p>Topology unavailable.</p></section>;
  return <section><div className="topology-heading"><div><p className="eyebrow">NETWORK TOPOLOGY</p><h1>Topology canvas</h1></div><p className="status-pill status-pill--warning" data-testid="topology-source">{query.data.source} · updated {new Date(query.data.last_updated).toLocaleTimeString()}</p></div><div className="topology-layout"><NetworkCanvas topology={query.data.topology} onSelect={setSelected} /><DeviceInspector device={selected} /></div></section>;
}
