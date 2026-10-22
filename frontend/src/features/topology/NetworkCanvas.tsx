import { Background, Controls, ReactFlow, type Edge, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { Topology, TopologyNode } from "../../lib/api";

type Props = { topology: Topology; onSelect: (node: TopologyNode) => void };

export function NetworkCanvas({ topology, onSelect }: Props) {
  const nodes: Node[] = topology.nodes.map((node, index) => ({ id: node.id, data: { label: `${node.id} · ${node.type}` }, position: { x: (index % 3) * 220, y: Math.floor(index / 3) * 150 } }));
  const edges: Edge[] = topology.links.map((link) => ({ id: link.id, source: link.a.node_id, target: link.b.node_id, label: link.state, animated: link.state === "degraded", style: { stroke: link.state === "down" ? "var(--nm-danger)" : link.state === "degraded" ? "var(--nm-warning)" : "var(--nm-success)", strokeDasharray: link.state === "down" ? "6 4" : undefined } }));
  return <div className="network-canvas"><ReactFlow nodes={nodes} edges={edges} fitView onNodeClick={(_, clicked) => { const device = topology.nodes.find((item) => item.id === clicked.id); if (device) onSelect(device); }}><Background /><Controls /></ReactFlow></div>;
}
