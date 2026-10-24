import { DragEvent, useEffect, useMemo, useState } from "react";
import {
  addEdge,
  Background,
  Connection,
  Controls,
  Handle,
  NodeProps,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import {
  getNetworks,
  getTopology,
  saveNetwork,
  type Topology,
  type TopologyLink,
  type TopologyNode,
} from "../lib/api";

const deviceTypes = [
  "router",
  "switch",
  "hub",
  "repeater",
  "host",
  "server",
  "firewall",
  "access-point",
];
const packetSizes: Record<string, number> = {
  ICMP: 64,
  ARP: 42,
  DHCP: 300,
  DNS: 128,
  TCP: 1500,
  UDP: 512,
  HTTP: 1500,
};

function DeviceSymbol({ type }: { type: string }) {
  const paths: Record<string, string> = {
    router: "M4 12h16M7 8l-3 4 3 4m10-8 3 4-3 4",
    switch: "M4 7h16v10H4zM8 10v4m4-4v4m4-4v4",
    hub: "M12 4v16M4 12h16M6 6l12 12M18 6 6 18",
    repeater: "M5 8h10l-3-3m3 3-3 3M19 16H9l3-3m-3 3 3 3",
    host: "M4 5h16v11H4zM8 20h8M12 16v4",
    server: "M5 4h14v16H5zM8 8h1m2 0h5M8 13h1m2 0h5",
    firewall: "M4 5h16v14H4zM4 10h16M9 5v5m6 0v4m-6 0v5",
    "access-point":
      "M12 18v2m-4-6a6 6 0 0 1 8 0m-11-4a10 10 0 0 1 14 0m-7 6h.01",
  };
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d={paths[type] ?? paths.host} />
    </svg>
  );
}

function DeviceNode({ data }: NodeProps) {
  const item = data as { label: string; deviceType: string; status?: string };
  return (
    <div className={`device-node device-node--${item.status ?? "up"}`}>
      <Handle type="target" position={Position.Left} />
      <DeviceSymbol type={item.deviceType} />
      <span>
        <strong>{item.label}</strong>
        <small>{item.deviceType}</small>
      </span>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
const nodeTypes = { device: DeviceNode };

type RouteResult = {
  nodes: string[];
  links: string[];
  propagation: number;
  transmission: number;
  processing: number;
  queueing: number;
  total: number;
  loss: number;
  bandwidth: number;
  ttl: number;
  reachable: boolean;
};

function route(
  topology: Topology,
  source: string,
  destination: string,
  protocol: string,
  bytes: number,
  blockedNode = "",
): RouteResult {
  const links = topology.links.filter(
    (link) =>
      link.state !== "down" &&
      link.a.node_id !== blockedNode &&
      link.b.node_id !== blockedNode,
  );
  const distances = new Map<string, number>([[source, 0]]);
  const previous = new Map<string, { node: string; link: TopologyLink }>();
  const pending = new Set(
    topology.nodes
      .filter((node) => node.id !== blockedNode)
      .map((node) => node.id),
  );
  while (pending.size) {
    const current = [...pending].sort(
      (a, b) => (distances.get(a) ?? Infinity) - (distances.get(b) ?? Infinity),
    )[0];
    pending.delete(current);
    if (
      current === destination ||
      !Number.isFinite(distances.get(current) ?? Infinity)
    )
      break;
    for (const link of links.filter(
      (item) => item.a.node_id === current || item.b.node_id === current,
    )) {
      const next = link.a.node_id === current ? link.b.node_id : link.a.node_id;
      if (!pending.has(next)) continue;
      const weight =
        protocol === "ospf" ? link.delay_ms + 1000 / link.capacity_mbps : 1;
      const candidate = (distances.get(current) ?? 0) + weight;
      if (candidate < (distances.get(next) ?? Infinity)) {
        distances.set(next, candidate);
        previous.set(next, { node: current, link });
      }
    }
  }
  if (source === destination)
    return {
      nodes: [source],
      links: [],
      propagation: 0,
      transmission: 0,
      processing: 0,
      queueing: 0,
      total: 0,
      loss: 0,
      bandwidth: 0,
      ttl: 64,
      reachable: true,
    };
  if (!previous.has(destination))
    return {
      nodes: [],
      links: [],
      propagation: 0,
      transmission: 0,
      processing: 0,
      queueing: 0,
      total: 0,
      loss: 100,
      bandwidth: 0,
      ttl: 0,
      reachable: false,
    };
  const nodes = [destination];
  const pathLinks: TopologyLink[] = [];
  let cursor = destination;
  while (cursor !== source) {
    const step = previous.get(cursor)!;
    pathLinks.unshift(step.link);
    nodes.unshift(step.node);
    cursor = step.node;
  }
  const propagation = pathLinks.reduce(
    (sum, link) => sum + link.delay_ms + (link.jitter_ms ?? 0),
    0,
  );
  const transmission = pathLinks.reduce(
    (sum, link) => sum + (bytes * 8) / (link.capacity_mbps * 1000),
    0,
  );
  const processing = nodes.reduce(
    (sum, id) =>
      sum +
      (topology.nodes.find((node) => node.id === id)?.processing_delay_ms ??
        0.2),
    0,
  );
  const queueing = pathLinks.reduce(
    (sum, link) =>
      sum +
      (link.state === "degraded"
        ? (bytes * 8) / (link.capacity_mbps * 100)
        : 0),
    0,
  );
  const loss =
    100 *
    (1 -
      pathLinks.reduce(
        (success, link) => success * (1 - (link.loss_pct ?? 0) / 100),
        1,
      ));
  return {
    nodes,
    links: pathLinks.map((link) => link.id),
    propagation,
    transmission,
    processing,
    queueing,
    total: propagation + transmission + processing + queueing,
    loss,
    bandwidth: Math.min(...pathLinks.map((link) => link.capacity_mbps)),
    ttl: 64 - pathLinks.length,
    reachable: true,
  };
}

function applyScenario(
  topology: Topology,
  scenario: string,
  target: string,
): { topology: Topology; blockedNode: string } {
  const copy = structuredClone(topology);
  let blockedNode = "";
  if (scenario === "node-down") blockedNode = target;
  const link = copy.links.find((item) => item.id === target);
  if (link && scenario === "link-down") link.state = "down";
  if (link && scenario === "congestion") {
    link.state = "degraded";
    link.capacity_mbps = Math.max(1, link.capacity_mbps * 0.1);
    link.delay_ms *= 5;
  }
  if (link && scenario === "latency") {
    link.state = "degraded";
    link.delay_ms += 100;
  }
  if (link && scenario === "packet-loss") {
    link.state = "degraded";
    link.loss_pct = 30;
  }
  return { topology: copy, blockedNode };
}

export function Simulator() {
  const networkId = Number(useParams().networkId);
  const topologyQuery = useQuery({
    queryKey: ["topology", networkId],
    queryFn: () => getTopology(networkId),
    enabled: Number.isFinite(networkId),
  });
  const networks = useQuery({ queryKey: ["networks"], queryFn: getNetworks });
  const [topology, setTopology] = useState<Topology | null>(null);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState("");
  const [protocol, setProtocol] = useState("ospf");
  const [packet, setPacket] = useState("ICMP");
  const [source, setSource] = useState("");
  const [destination, setDestination] = useState("");
  const [scenario, setScenario] = useState("link-down");
  const [target, setTarget] = useState("");
  const [preview, setPreview] = useState<RouteResult | null>(null);
  const [baseline, setBaseline] = useState<RouteResult | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [activeEdge, setActiveEdge] = useState("");
  const [speed, setSpeed] = useState(1);
  const [assistantQuestion, setAssistantQuestion] = useState(
    "Which device is most critical, and what changes if this link fails?",
  );
  const [assistantAnswer, setAssistantAnswer] = useState("");
  const [saveState, setSaveState] = useState("");
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  useEffect(() => {
    if (!topologyQuery.data || topology) return;
    const loaded = topologyQuery.data.topology;
    setTopology(loaded);
    setName(
      networks.data?.find((item) => item.id === networkId)?.name ??
        `Network ${networkId}`,
    );
    const endpoints = loaded.nodes.filter((node) =>
      ["host", "server"].includes(node.type),
    );
    setSource(endpoints[0]?.id ?? loaded.nodes[0]?.id ?? "");
    setDestination(endpoints.at(-1)?.id ?? loaded.nodes.at(-1)?.id ?? "");
    const baselineLinks = loaded.expected_baseline_paths?.[0]?.link_ids ?? [];
    setTarget(
      baselineLinks[Math.floor(baselineLinks.length / 2)] ??
        loaded.links[0]?.id ??
        "",
    );
    setNodes(
      loaded.nodes.map((node, index) => ({
        id: node.id,
        type: "device",
        position: {
          x: node.x ?? (index % 8) * 170,
          y: node.y ?? Math.floor(index / 8) * 120,
        },
        data: { label: node.id, deviceType: node.type, status: "up" },
      })),
    );
    setEdges(
      loaded.links.map((link) => ({
        id: link.id,
        source: link.a.node_id,
        target: link.b.node_id,
        label: `${link.capacity_mbps} Mbps · ${link.delay_ms} ms`,
        animated: false,
      })),
    );
  }, [
    networkId,
    networks.data,
    setEdges,
    setNodes,
    topology,
    topologyQuery.data,
  ]);
  const nodeMap = useMemo(
    () => new Map(nodes.map((node) => [node.id, node])),
    [nodes],
  );
  function syncTopology(): Topology | null {
    if (!topology) return null;
    return {
      ...topology,
      nodes: topology.nodes.map((item) => ({
        ...item,
        x: nodeMap.get(item.id)?.position.x ?? item.x,
        y: nodeMap.get(item.id)?.position.y ?? item.y,
      })),
      links: edges.map(
        (edge, index) =>
          topology.links.find((item) => item.id === edge.id) ?? {
            id: edge.id,
            a: { node_id: edge.source, interface_id: "port-1" },
            b: { node_id: edge.target, interface_id: "port-1" },
            capacity_mbps: 100,
            delay_ms: 1,
            loss_pct: 0,
            jitter_ms: 0,
            state: "up",
          },
      ),
      expected_baseline_paths: topology.expected_baseline_paths?.length
        ? topology.expected_baseline_paths
        : [],
    };
  }
  function connect(connection: Connection) {
    const id = `link-${connection.source}-${connection.target}-${Date.now().toString().slice(-4)}`;
    setEdges((current) =>
      addEdge({ ...connection, id, label: "100 Mbps · 1 ms" }, current),
    );
    if (topology && connection.source && connection.target)
      setTopology({
        ...topology,
        links: [
          ...topology.links,
          {
            id,
            a: { node_id: connection.source, interface_id: "port-1" },
            b: { node_id: connection.target, interface_id: "port-1" },
            capacity_mbps: 100,
            delay_ms: 1,
            loss_pct: 0,
            jitter_ms: 0,
            state: "up",
          },
        ],
      });
  }
  function addDevice(type: string, x = 240, y = 160) {
    if (!topology || topology.nodes.length >= 50) return;
    const number =
      topology.nodes.filter((node) => node.type === type).length + 1;
    const id = `${type}-${number}-${Date.now().toString().slice(-3)}`;
    const item: TopologyNode = {
      id,
      type,
      interfaces: [1, 2, 3, 4].map((port) => ({
        id: `port-${port}`,
        address: `10.20.${topology.nodes.length}.${port}/24`,
      })),
      x,
      y,
      processing_delay_ms: 0.2,
      routing_protocol: protocol as "static" | "rip" | "ospf",
    };
    setTopology({ ...topology, nodes: [...topology.nodes, item] });
    setNodes((current) => [
      ...current,
      {
        id,
        type: "device",
        position: { x, y },
        data: { label: id, deviceType: type, status: "up" },
      },
    ]);
  }
  function drop(event: DragEvent) {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    addDevice(
      event.dataTransfer.getData("device-type"),
      event.clientX - rect.left,
      event.clientY - rect.top,
    );
  }
  function calculatePreview() {
    const current = syncTopology();
    if (!current) return;
    const before = route(
      current,
      source,
      destination,
      protocol,
      packetSizes[packet],
    );
    const changed = applyScenario(current, scenario, target);
    setBaseline(before);
    setPreview(
      route(
        changed.topology,
        source,
        destination,
        protocol,
        packetSizes[packet],
        changed.blockedNode,
      ),
    );
  }
  function execute() {
    const current = syncTopology();
    if (!current) return;
    const changed = applyScenario(current, scenario, target);
    const result = route(
      changed.topology,
      source,
      destination,
      protocol,
      packetSizes[packet],
      changed.blockedNode,
    );
    const convergence =
      protocol === "rip" ? 30000 : protocol === "ospf" ? 5000 : 0;
    setTopology(changed.topology);
    setPreview(result);
    setLogs([
      `0.000 ms · ${scenario} applied to ${target}`,
      `${convergence.toFixed(3)} ms · ${protocol.toUpperCase()} routing convergence model`,
      `${result.total.toFixed(3)} ms · propagation + transmission + queueing + processing`,
      result.reachable
        ? `${result.total.toFixed(3)} ms · ${packet} route selected: ${result.nodes.join(" → ")}`
        : `${result.total.toFixed(3)} ms · destination unreachable; packet dropped`,
    ]);
    setEdges((items) =>
      items.map((edge) => ({
        ...edge,
        animated: result.links.includes(edge.id),
        style: {
          stroke:
            edge.id === target
              ? "var(--nm-danger)"
              : result.links.includes(edge.id)
                ? "var(--nm-accent)"
                : "var(--nm-border)",
        },
      })),
    );
    result.links.forEach((id, index) =>
      setTimeout(
        () => setActiveEdge(id),
        index * Math.max(250, (result.total * 30) / speed),
      ),
    );
    setTimeout(
      () => setActiveEdge(""),
      result.links.length * Math.max(250, (result.total * 30) / speed),
    );
  }
  async function persist() {
    const current = syncTopology();
    if (!current) return;
    setSaveState("Saving…");
    try {
      await saveNetwork(networkId, name, current);
      setSaveState("Saved to PostgreSQL");
    } catch {
      setSaveState("Save failed");
    }
  }
  function askAssistant() {
    const result =
      preview ??
      (topology
        ? route(topology, source, destination, protocol, packetSizes[packet])
        : null);
    if (!result) return;
    const critical =
      result.nodes[Math.floor(result.nodes.length / 2)] ?? "none";
    setAssistantAnswer(
      result.reachable
        ? `SIMULATED_AI_PLANNER: ${critical} is central on the selected path. ${protocol.toUpperCase()} uses ${result.links.length} links with ${result.total.toFixed(3)} ms calculated delay and ${result.loss.toFixed(2)}% cumulative loss. Suggested change: add a redundant link around ${critical}, preview it, then confirm before saving.`
        : `SIMULATED_AI_PLANNER: the destination becomes unreachable. Restore ${target} or add a redundant path, preview the route, and confirm before saving.`,
    );
  }
  if (topologyQuery.isLoading)
    return <section className="panel">Loading simulator…</section>;
  if (topologyQuery.isError || !topology)
    return (
      <section className="panel">
        <p role="alert">Network could not be loaded.</p>
        <Link to="/">Return to networks</Link>
      </section>
    );
  const routeRows = topology.nodes
    .filter((node) => node.type === "router")
    .map((router) => ({
      router: router.id,
      next: preview?.nodes.includes(router.id)
        ? (preview.nodes[preview.nodes.indexOf(router.id) + 1] ?? "local")
        : "—",
      metric:
        protocol === "ospf"
          ? "cost/delay"
          : protocol === "rip"
            ? `${preview?.links.length ?? 0} hops`
            : "static",
    }));
  return (
    <div className="simulator-page">
      <header className="simulator-header">
        <div>
          <Link to="/" className="back-link">
            ← Networks
          </Link>
          <input
            className="network-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-label="Network name"
          />
          <p>
            {topology.nodes.length}/50 devices · {topology.links.length} links ·
            SIMULATED
          </p>
        </div>
        <div className="header-actions">
          <span>{saveState}</span>
          <button className="primary-button" onClick={persist}>
            Save network
          </button>
        </div>
      </header>
      <div className="simulator-grid">
        <aside className="toolbox panel">
          <p className="eyebrow">DEVICE LIBRARY</p>
          <h2>Drag onto canvas</h2>
          <div className="device-palette">
            {deviceTypes.map((type) => (
              <button
                draggable
                onDragStart={(event) =>
                  event.dataTransfer.setData("device-type", type)
                }
                onClick={() => addDevice(type)}
                key={type}
              >
                <DeviceSymbol type={type} />
                <span>{type}</span>
              </button>
            ))}
          </div>
          <p className="toolbox-note">
            Drag devices, connect their handles, then save.
          </p>
          <label>
            Selected device
            <select
              value={selected}
              onChange={(event) => setSelected(event.target.value)}
            >
              <option value="">None</option>
              {topology.nodes.map((node) => (
                <option key={node.id}>{node.id}</option>
              ))}
            </select>
          </label>
          {selected && (
            <div className="inspector-mini">
              <strong>{selected}</strong>
              <span>
                {topology.nodes.find((node) => node.id === selected)?.type}
              </span>
              <span>
                Processing:{" "}
                {topology.nodes.find((node) => node.id === selected)
                  ?.processing_delay_ms ?? 0.2}{" "}
                ms
              </span>
            </div>
          )}
        </aside>
        <main
          className="canvas-panel panel"
          onDragOver={(event) => event.preventDefault()}
          onDrop={drop}
        >
          <div className="canvas-toolbar">
            <span>{packet} packet view</span>
            <span className="legend">
              <i className="up" />
              Active <i className="down" />
              Fault <i className="path" />
              Packet path
            </span>
          </div>
          <ReactFlow
            nodes={nodes.map((node) => ({
              ...node,
              className: activeEdge ? "simulation-running" : "",
            }))}
            edges={edges.map((edge) => ({
              ...edge,
              className: edge.id === activeEdge ? "edge-active" : "",
            }))}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={connect}
            onNodeClick={(_, node) => setSelected(node.id)}
            fitView
          >
            <Background gap={22} size={1} />
            <Controls />
          </ReactFlow>
        </main>
        <aside className="simulation-panel panel">
          <p className="eyebrow">PACKET & FAILURE LAB</p>
          <h2>Preview impact</h2>
          <div className="compact-form">
            <label>
              Routing
              <select
                value={protocol}
                onChange={(event) => setProtocol(event.target.value)}
              >
                <option value="static">Static</option>
                <option value="rip">RIP</option>
                <option value="ospf">OSPF</option>
              </select>
            </label>
            <label>
              Packet
              <select
                value={packet}
                onChange={(event) => setPacket(event.target.value)}
              >
                {Object.keys(packetSizes).map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </label>
            <label>
              From
              <select
                value={source}
                onChange={(event) => setSource(event.target.value)}
              >
                {topology.nodes.map((node) => (
                  <option key={node.id}>{node.id}</option>
                ))}
              </select>
            </label>
            <label>
              To
              <select
                value={destination}
                onChange={(event) => setDestination(event.target.value)}
              >
                {topology.nodes.map((node) => (
                  <option key={node.id}>{node.id}</option>
                ))}
              </select>
            </label>
            <label>
              Failure
              <select
                value={scenario}
                onChange={(event) => {
                  const next = event.target.value;
                  setScenario(next);
                  setTarget(
                    next === "node-down"
                      ? (topology.nodes[0]?.id ?? "")
                      : (topology.links[0]?.id ?? ""),
                  );
                  setPreview(null);
                }}
              >
                <option value="link-down">Link down</option>
                <option value="node-down">Device down</option>
                <option value="congestion">Congestion</option>
                <option value="latency">High latency</option>
                <option value="packet-loss">Packet loss</option>
              </select>
            </label>
            <label>
              Target
              <select
                value={target}
                onChange={(event) => setTarget(event.target.value)}
              >
                {(scenario === "node-down"
                  ? topology.nodes
                  : topology.links
                ).map((item) => (
                  <option key={item.id}>{item.id}</option>
                ))}
              </select>
            </label>
            <label>
              Replay speed
              <select
                value={speed}
                onChange={(event) => setSpeed(Number(event.target.value))}
              >
                <option value="0.5">0.5× slow</option>
                <option value="1">1×</option>
                <option value="2">2×</option>
              </select>
            </label>
          </div>
          <div className="simulation-actions">
            <button
              disabled={!source || !destination || source === destination || !target}
              onClick={calculatePreview}
            >
              Preview
            </button>
            <button
              className="danger-solid"
              disabled={!preview}
              onClick={() =>
                confirm("Execute this simulated fault?") && execute()
              }
            >
              Confirm & execute
            </button>
          </div>
          {preview && (
            <div className="impact-card">
              <strong>
                {preview.reachable
                  ? "Alternate path available"
                  : "Network partition detected"}
              </strong>
              <dl>
                <div>
                  <dt>Total delay</dt>
                  <dd>{preview.total.toFixed(3)} ms</dd>
                </div>
                <div>
                  <dt>Propagation</dt>
                  <dd>{preview.propagation.toFixed(3)} ms</dd>
                </div>
                <div>
                  <dt>Transmission</dt>
                  <dd>{preview.transmission.toFixed(3)} ms</dd>
                </div>
                <div>
                  <dt>Processing</dt>
                  <dd>{preview.processing.toFixed(3)} ms</dd>
                </div>
                <div>
                  <dt>Queueing</dt>
                  <dd>{preview.queueing.toFixed(3)} ms</dd>
                </div>
                <div>
                  <dt>Bottleneck</dt>
                  <dd>{preview.bandwidth.toFixed(0)} Mbps</dd>
                </div>
                <div>
                  <dt>Loss</dt>
                  <dd>{preview.loss.toFixed(2)}%</dd>
                </div>
                <div>
                  <dt>TTL remaining</dt>
                  <dd>{preview.ttl}</dd>
                </div>
                <div>
                  <dt>Route change</dt>
                  <dd>{baseline?.links.join(" → ") || "none"}</dd>
                </div>
                <div>
                  <dt>New route</dt>
                  <dd>{preview.links.join(" → ") || "unreachable"}</dd>
                </div>
              </dl>
            </div>
          )}
        </aside>
      </div>
      <section className="analysis-grid">
        <article className="panel">
          <p className="eyebrow">ROUTING TABLE CHANGES</p>
          <h2>{protocol.toUpperCase()} convergence</h2>
          <table>
            <thead>
              <tr>
                <th>Router</th>
                <th>Next hop</th>
                <th>Metric</th>
              </tr>
            </thead>
            <tbody>
              {routeRows.map((row) => (
                <tr key={row.router}>
                  <td>{row.router}</td>
                  <td>{row.next}</td>
                  <td>{row.metric}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
        <article className="panel">
          <p className="eyebrow">EVENT LOG</p>
          <h2>Timing and propagation</h2>
          <ol className="event-log">
            {logs.length ? (
              logs.map((log, index) => <li key={`${log}-${index}`}>{log}</li>)
            ) : (
              <li>Preview and execute a simulation to create logs.</li>
            )}
          </ol>
        </article>
        <article className="panel assistant-panel">
          <p className="eyebrow">AI LAB ASSISTANT</p>
          <h2>Explain and suggest</h2>
          <textarea
            value={assistantQuestion}
            onChange={(event) => setAssistantQuestion(event.target.value)}
          />
          <button onClick={askAssistant}>Analyse current topology</button>
          {assistantAnswer && <p>{assistantAnswer}</p>}
        </article>
      </section>
    </div>
  );
}
