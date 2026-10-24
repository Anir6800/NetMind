import { DragEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { getNetworks, getTopology, saveNetwork, type Topology, type TopologyLink, type TopologyNode } from "../lib/api";
import { DEVICE_TYPES, DeviceSymbol, edgeTypes, nodeTypes, type DeviceData, type TrafficData } from "../features/sim/canvas";
import { ImpactCard, Legend, LinkInspector, NodeInspector, Palette } from "../features/sim/panels";
import {
  PACKET_BYTES,
  analyzeFlow,
  applyFault,
  compareImpact,
  computeTables,
  isL3,
  labelOf,
  reachability,
  type Fault,
  type FaultKind,
  type Impact,
  type Protocol,
  type Tables,
} from "../sim/engine";

export type Panel = "canvas" | "simulate" | "tables" | "logs" | "ai";
type Menu = { kind: "node" | "link" | "pane"; id: string; x: number; y: number };
type LogEntry = { at: string; source: "LIVE" | "PREVIEW" | "EDIT"; text: string };
type History = { past: Topology[]; present: Topology | null; future: Topology[] };
type EndpointFlow = { src: string; dst: string; app: string };

const SHORT: Record<string, string> = {
  router: "R",
  switch: "SW",
  hub: "HUB",
  repeater: "REP",
  host: "PC",
  server: "SRV",
  firewall: "FW",
  "access-point": "AP",
};
const MAX_DEVICES = 50;
const clock = () => new Date().toLocaleTimeString([], { hour12: false });

function freshSubnet(topology: Topology) {
  const used = new Set(
    topology.nodes.flatMap((node) => node.interfaces.map((item) => item.address.split(".").slice(0, 3).join("."))),
  );
  for (let third = 1; third < 255; third += 1) if (!used.has(`10.20.${third}`)) return `10.20.${third}`;
  return "10.21.0";
}

// Uses the first interface no link is attached to, or adds one.
function freeInterface(topology: Topology, node: TopologyNode): { node: TopologyNode; interfaceId: string } {
  const taken = new Set(
    topology.links.flatMap((link) => [
      link.a.node_id === node.id ? link.a.interface_id : "",
      link.b.node_id === node.id ? link.b.interface_id : "",
    ]),
  );
  const free = node.interfaces.find((item) => !taken.has(item.id));
  if (free) return { node, interfaceId: free.id };
  const interfaceId = `port-${node.interfaces.length + 1}`;
  const address = isL3(node) ? `${freshSubnet(topology)}.1/24` : `${node.interfaces[0].address.split("/")[0].split(".").slice(0, 3).join(".")}.${200 + node.interfaces.length}/24`;
  return { node: { ...node, interfaces: [...node.interfaces, { id: interfaceId, address }] }, interfaceId };
}

export function Simulator() {
  return (
    <ReactFlowProvider>
      <Studio />
    </ReactFlowProvider>
  );
}

function Studio() {
  const networkId = Number(useParams().networkId);
  const [searchParams, setSearchParams] = useSearchParams();
  const panel = (searchParams.get("panel") ?? "simulate") as Panel;
  const flowApi = useReactFlow();
  const topologyQuery = useQuery({ queryKey: ["topology", networkId], queryFn: () => getTopology(networkId), enabled: Number.isFinite(networkId) });
  const networks = useQuery({ queryKey: ["networks"], queryFn: getNetworks });
  const [history, setHistory] = useState<History>({ past: [], present: null, future: [] });
  const topology = history.present;
  const [name, setName] = useState("");
  const [protocol, setProtocol] = useState<Protocol>("ospf");
  const [flows, setFlows] = useState<EndpointFlow[]>([]);
  const [selection, setSelection] = useState<{ nodes: string[]; edges: string[] }>({ nodes: [], edges: [] });
  const [focus, setFocus] = useState<{ kind: "node" | "link"; id: string; rename?: boolean } | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [impact, setImpact] = useState<{ title: string; impact: Impact; pending?: Fault } | null>(null);
  const [previousTables, setPreviousTables] = useState<Tables | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [faultKind, setFaultKind] = useState<FaultKind>("link-down");
  const [faultTarget, setFaultTarget] = useState("");
  const [saveState, setSaveState] = useState("");
  const [search, setSearch] = useState("");
  const saved = useRef<Topology | null>(null);
  const dragOrigin = useRef<Topology | null>(null);
  const dataCache = useRef(new WeakMap<TopologyNode, DeviceData>());
  const edgeCache = useRef(new WeakMap<TopologyLink, TrafficData>());

  const setPanel = useCallback(
    (next: Panel) =>
      setSearchParams(
        (params) => {
          params.set("panel", next);
          return params;
        },
        { replace: true },
      ),
    [setSearchParams],
  );

  useEffect(() => {
    if (!topologyQuery.data || topology) return;
    const loaded = topologyQuery.data.topology;
    saved.current = loaded;
    setHistory({ past: [], present: loaded, future: [] });
    const endpoints = loaded.nodes.filter((node) => ["host", "server"].includes(node.type));
    const src = endpoints[0]?.id ?? loaded.nodes[0]?.id ?? "";
    const dst = endpoints.at(-1)?.id ?? loaded.nodes.at(-1)?.id ?? "";
    setFlows(src && dst ? [{ src, dst, app: "ICMP" }] : []);
    const routed = loaded.nodes.find((node) => node.type === "router")?.routing_protocol;
    if (routed) setProtocol(routed);
    const baseline = loaded.expected_baseline_paths?.[0]?.link_ids ?? [];
    setFaultTarget(baseline[Math.floor(baseline.length / 2)] ?? loaded.links[0]?.id ?? "");
    try {
      localStorage.setItem("netmind-last-network", String(networkId));
    } catch {
      /* storage is a convenience only */
    }
  }, [networkId, topology, topologyQuery.data]);

  useEffect(() => {
    if (!name && networks.data) setName(networks.data.find((item) => item.id === networkId)?.name ?? `Network ${networkId}`);
  }, [name, networkId, networks.data]);

  const commit = useCallback(
    (next: Topology) => setHistory((h) => ({ past: h.present ? [...h.past.slice(-49), h.present] : h.past, present: next, future: [] })),
    [],
  );
  const undo = () =>
    setHistory((h) => (h.past.length && h.present ? { past: h.past.slice(0, -1), present: h.past.at(-1)!, future: [h.present, ...h.future] } : h));
  const redo = () =>
    setHistory((h) => (h.future.length && h.present ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) } : h));
  const log = (source: LogEntry["source"], text: string) => setLogs((items) => [{ at: clock(), source, text }, ...items].slice(0, 500));

  const byId = useMemo(() => new Map((topology?.nodes ?? []).map((node) => [node.id, node])), [topology]);
  const label = useCallback((id: string) => (byId.has(id) ? labelOf(byId.get(id)) : id), [byId]);
  const primary = flows[0];
  const tables = useMemo<Tables>(() => (topology ? computeTables(topology, protocol) : new Map()), [topology, protocol]);
  const results = useMemo(
    () => (topology ? flows.map((flow) => analyzeFlow(topology, { ...flow, protocol }, tables)) : []),
    [flows, protocol, tables, topology],
  );
  const unreachable = useMemo(() => {
    if (!topology || !primary || !byId.has(primary.src)) return new Set<string>();
    return new Set([...reachability(topology, tables, primary.src)].filter(([, ok]) => !ok).map(([id]) => id));
  }, [byId, primary, tables, topology]);

  const rfNodes = useMemo<Node[]>(() => {
    if (!topology) return [];
    return topology.nodes.map((node) => {
      const role = node.id === primary?.src ? "SRC" : node.id === primary?.dst ? "DST" : undefined;
      const lost = unreachable.has(node.id);
      let data = dataCache.current.get(node);
      if (!data || data.role !== role || data.unreachable !== lost) {
        data = { node, role, unreachable: lost };
        dataCache.current.set(node, data);
      }
      return { id: node.id, type: "device", position: { x: node.x ?? 0, y: node.y ?? 0 }, data, selected: selection.nodes.includes(node.id) };
    });
  }, [primary, selection.nodes, topology, unreachable]);

  const rfEdges = useMemo<Edge[]>(() => {
    if (!topology) return [];
    const direction = new Map<string, { forward: boolean; backward: boolean }>();
    for (const result of results)
      for (const trace of [result.forward, result.reverse]) {
        if (!trace.delivered) continue;
        trace.links.forEach((id, index) => {
          const link = topology.links.find((item) => item.id === id)!;
          const entry = direction.get(id) ?? { forward: false, backward: false };
          if (link.a.node_id === trace.nodes[index]) entry.forward = true;
          else entry.backward = true;
          direction.set(id, entry);
        });
      }
    return topology.links.map((link) => {
      const flow = direction.get(link.id) ?? { forward: false, backward: false };
      let data = edgeCache.current.get(link);
      if (!data || data.forward !== flow.forward || data.backward !== flow.backward) {
        data = { link, utilisation: link.utilisation_pct ?? 0, ...flow };
        edgeCache.current.set(link, data);
      }
      return { id: link.id, source: link.a.node_id, target: link.b.node_id, type: "traffic", data, selected: selection.edges.includes(link.id) };
    });
  }, [results, selection.edges, topology]);

  // ---------- edits ----------

  function liveChange(fault: Fault, title: string) {
    if (!topology) return;
    const next = applyFault(topology, fault);
    if (!primary) {
      commit(next);
      log("LIVE", `${title} (choose a source and destination to see path impact)`);
      return;
    }
    const started = performance.now();
    const result = compareImpact(topology, next, { ...primary, protocol });
    setPreviousTables(tables);
    commit(next);
    setImpact({ title, impact: result });
    log(
      "LIVE",
      `${title} → ${result.after.reachable ? `path ${result.after.forward.l3Hops.map(label).join(" → ")} (${result.after.metrics.total.toFixed(3)} ms)` : `destination unreachable: ${result.after.forward.reason}`}; reachable devices ${result.reachableBefore} → ${result.reachableAfter} (recalculated in ${(performance.now() - started).toFixed(1)} ms)`,
    );
  }

  function updateNode(next: TopologyNode) {
    if (!topology) return;
    commit({ ...topology, nodes: topology.nodes.map((node) => (node.id === next.id ? next : node)) });
    log("EDIT", `${labelOf(next)} updated`);
  }
  function updateLink(next: TopologyLink) {
    if (!topology) return;
    commit({ ...topology, links: topology.links.map((link) => (link.id === next.id ? next : link)) });
    log("EDIT", `link ${next.id} updated: ${next.capacity_mbps} Mbps, ${next.delay_ms} ms, loss ${next.loss_pct ?? 0}%`);
  }

  function addDevice(type: string, position?: { x: number; y: number }) {
    if (!topology || topology.nodes.length >= MAX_DEVICES) return;
    let number = 1;
    while (topology.nodes.some((node) => node.id === `${type}-${number}`)) number += 1;
    const subnet = freshSubnet(topology);
    const where = position ?? flowApi.screenToFlowPosition({ x: window.innerWidth / 2 - 200, y: window.innerHeight / 2 });
    const node: TopologyNode = {
      id: `${type}-${number}`,
      name: `${SHORT[type] ?? type}${number}`,
      type,
      interfaces: [{ id: "port-1", address: `${subnet}.${["host", "server"].includes(type) ? 10 : 1}/24` }],
      x: Math.round(where.x / 20) * 20,
      y: Math.round(where.y / 20) * 20,
      processing_delay_ms: 0.2,
      routing_protocol: protocol,
      state: "up",
    };
    commit({ ...topology, nodes: [...topology.nodes, node] });
    log("EDIT", `added ${node.name} (${type}) with ${node.interfaces[0].address}`);
  }

  function connect(source: string, target: string) {
    if (!topology || source === target) return;
    const a = freeInterface(topology, byId.get(source)!);
    const withA = { ...topology, nodes: topology.nodes.map((node) => (node.id === source ? a.node : node)) };
    const b = freeInterface(withA, byId.get(target)!);
    let id = `link-${source}-${target}`;
    for (let suffix = 2; topology.links.some((link) => link.id === id); suffix += 1) id = `link-${source}-${target}-${suffix}`;
    const link: TopologyLink = {
      id,
      a: { node_id: source, interface_id: a.interfaceId },
      b: { node_id: target, interface_id: b.interfaceId },
      capacity_mbps: 100,
      delay_ms: 1,
      loss_pct: 0,
      jitter_ms: 0,
      state: "up",
    };
    commit({ ...withA, nodes: withA.nodes.map((node) => (node.id === target ? b.node : node)), links: [...topology.links, link] });
    log("EDIT", `connected ${label(source)} ${a.interfaceId} ↔ ${label(target)} ${b.interfaceId} (100 Mbps, 1 ms)`);
  }

  function remove(nodeIds: string[], linkIds: string[]) {
    if (!topology || (!nodeIds.length && !linkIds.length)) return;
    const gone = new Set(nodeIds);
    const links = new Set(linkIds);
    commit({
      ...topology,
      nodes: topology.nodes.filter((node) => !gone.has(node.id)),
      links: topology.links.filter((link) => !links.has(link.id) && !gone.has(link.a.node_id) && !gone.has(link.b.node_id)),
      expected_baseline_paths: [],
    });
    setFlows((items) => items.filter((flow) => !gone.has(flow.src) && !gone.has(flow.dst)));
    setFocus(null);
    log("EDIT", `deleted ${[...nodeIds.map(label), ...linkIds].join(", ")}`);
  }

  function setEndpoint(role: "src" | "dst", id: string) {
    setFlows(([first, ...rest]) => [{ ...(first ?? { src: id, dst: id, app: "ICMP" }), [role]: id }, ...rest]);
  }

  // ---------- React Flow wiring ----------

  function onNodesChange(changes: NodeChange[]) {
    if (!topology) return;
    let nodes = topology.nodes;
    let picked = selection.nodes;
    for (const change of changes) {
      if (change.type === "position" && change.position) {
        const { x, y } = change.position;
        nodes = nodes.map((node) => (node.id === change.id ? { ...node, x, y } : node));
      }
      if (change.type === "select") picked = change.selected ? [...new Set([...picked, change.id])] : picked.filter((id) => id !== change.id);
    }
    if (nodes !== topology.nodes) setHistory((h) => ({ ...h, present: { ...topology, nodes } }));
    if (picked !== selection.nodes) setSelection((current) => ({ ...current, nodes: picked }));
  }
  function onEdgesChange(changes: EdgeChange[]) {
    let picked = selection.edges;
    for (const change of changes)
      if (change.type === "select") picked = change.selected ? [...new Set([...picked, change.id])] : picked.filter((id) => id !== change.id);
    if (picked !== selection.edges) setSelection((current) => ({ ...current, edges: picked }));
  }
  function openMenu(kind: Menu["kind"], id: string, x: number, y: number) {
    setMenu({ kind, id, x: Math.min(x, window.innerWidth - 260), y: Math.min(y, window.innerHeight - 380) });
  }
  function onDrop(event: DragEvent) {
    event.preventDefault();
    const type = event.dataTransfer.getData("device-type");
    if (DEVICE_TYPES.includes(type)) addDevice(type, flowApi.screenToFlowPosition({ x: event.clientX, y: event.clientY }));
  }
  function onKeyDown(event: KeyboardEvent) {
    const typing = (event.target as HTMLElement).closest("input, textarea, select");
    if (event.key === "Escape") setMenu(null);
    if (typing) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
      event.preventDefault();
      redo();
    }
    // Keyboard context menu for the focused selection (Shift+F10 or the Menu key).
    if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
      event.preventDefault();
      const node = selection.nodes[0];
      const edge = selection.edges[0];
      const box = (document.activeElement as HTMLElement | null)?.getBoundingClientRect();
      if (node) openMenu("node", node, box?.right ?? 300, box?.top ?? 200);
      else if (edge) openMenu("link", edge, box?.right ?? 300, box?.top ?? 200);
    }
  }
  function focusDevice(query: string) {
    const match = topology?.nodes.find((node) => [node.id, node.name ?? ""].some((value) => value.toLowerCase() === query.trim().toLowerCase()));
    if (!match) return;
    flowApi.fitView({ nodes: [{ id: match.id }], duration: 400, maxZoom: 1.4 });
    setSelection({ nodes: [match.id], edges: [] });
    setFocus({ kind: "node", id: match.id });
    setPanel("canvas");
  }

  async function persist() {
    if (!topology) return;
    setSaveState("Saving…");
    try {
      const document = { ...topology, nodes: topology.nodes.map((node) => ({ ...node, routing_protocol: protocol })) };
      await saveNetwork(networkId, name, document);
      saved.current = topology;
      setSaveState("Saved to PostgreSQL");
    } catch {
      setSaveState("Save failed — check names and addresses");
    }
  }

  if (topologyQuery.isLoading) return <section className="panel">Loading simulator…</section>;
  if (topologyQuery.isError || !topology)
    return (
      <section className="panel">
        <p role="alert">Network could not be loaded.</p>
        <Link to="/">Return to networks</Link>
      </section>
    );

  const focusNode = focus?.kind === "node" ? byId.get(focus.id) : undefined;
  const focusLink = focus?.kind === "link" ? topology.links.find((link) => link.id === focus.id) : undefined;
  const menuNode = menu?.kind === "node" ? byId.get(menu.id) : undefined;
  const menuLink = menu?.kind === "link" ? topology.links.find((link) => link.id === menu.id) : undefined;
  const dirty = saved.current !== topology;
  const primaryResult = results[0];
  const faultTargets = faultKind.startsWith("node") ? topology.nodes : topology.links;
  const routers = topology.nodes.filter(isL3);
  const tableDevice = focusNode && isL3(focusNode) ? focusNode.id : routers.find((node) => node.type === "router")?.id;

  return (
    <div className="studio" onKeyDown={onKeyDown}>
      <header className="studio-bar">
        <Link to="/" className="back-link" aria-label="Back to networks">
          ←
        </Link>
        <input className="network-name" value={name} onChange={(event) => setName(event.target.value)} aria-label="Network name" />
        <span className="count-chip">
          {topology.nodes.length}/{MAX_DEVICES} devices · {topology.links.length} links
        </span>
        <span className="sim-badge" title="Educational model: calculated, not measured">
          SIMULATED
        </span>
        {searchParams.get("planner") && <span className="planner-badge">Generated by {searchParams.get("planner")}</span>}
        <form
          className="search-box"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            focusDevice(search);
          }}
        >
          <input
            list="device-names"
            placeholder="Find device…"
            aria-label="Find and focus a device"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <datalist id="device-names">
            {topology.nodes.map((node) => (
              <option key={node.id} value={node.name ?? node.id} />
            ))}
          </datalist>
        </form>
        <div className="bar-actions">
          <button className="ghost-button" onClick={undo} disabled={!history.past.length} title="Undo (Ctrl+Z)">
            ↶ Undo
          </button>
          <button className="ghost-button" onClick={redo} disabled={!history.future.length} title="Redo (Ctrl+Y)">
            ↷ Redo
          </button>
          <span className="save-state" role="status">
            {saveState || (dirty ? "Unsaved changes" : "")}
          </span>
          <button className="primary-button" onClick={persist}>
            Save
          </button>
        </div>
      </header>
      <div className="studio-body">
        <main className="canvas-wrap" onDragOver={(event) => event.preventDefault()} onDrop={onDrop} aria-label="Network canvas">
          <ReactFlow
            nodes={rfNodes}
            edges={rfEdges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={(connection: Connection) => connection.source && connection.target && connect(connection.source, connection.target)}
            onNodeDragStart={() => (dragOrigin.current = topology)}
            onNodeDragStop={() => {
              const origin = dragOrigin.current;
              dragOrigin.current = null;
              if (origin && origin !== topology) setHistory((h) => ({ past: [...h.past.slice(-49), origin], present: h.present, future: [] }));
            }}
            onDelete={({ nodes, edges }) => remove(nodes.map((node) => node.id), edges.map((edge) => edge.id))}
            onNodeClick={(_, node) => {
              setFocus({ kind: "node", id: node.id });
              setMenu(null);
            }}
            onEdgeClick={(_, edge) => {
              setFocus({ kind: "link", id: edge.id });
              setMenu(null);
            }}
            onPaneClick={() => setMenu(null)}
            onNodeContextMenu={(event, node) => {
              event.preventDefault();
              openMenu("node", node.id, event.clientX, event.clientY);
            }}
            onEdgeContextMenu={(event, edge) => {
              event.preventDefault();
              openMenu("link", edge.id, event.clientX, event.clientY);
            }}
            onPaneContextMenu={(event) => {
              event.preventDefault();
              openMenu("pane", "", event.clientX, event.clientY);
            }}
            snapToGrid
            snapGrid={[20, 20]}
            minZoom={0.15}
            deleteKeyCode={["Delete", "Backspace"]}
            multiSelectionKeyCode={["Shift", "Control", "Meta"]}
            fitView
          >
            <Background gap={20} size={1} />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable nodeStrokeWidth={3} nodeColor="#2dd4bf" maskColor="rgba(9, 12, 18, 0.65)" bgColor="#141a25" ariaLabel="Network minimap" />
          </ReactFlow>
          {!topology.nodes.length && (
            <div className="empty-canvas">
              <strong>Blank network</strong>
              <p>Drag a device from the Canvas drawer, or right-click here → Add device.</p>
            </div>
          )}
          {impact && (
            <ImpactCard
              title={impact.title}
              impact={impact.impact}
              label={label}
              onClose={() => setImpact(null)}
              onApply={
                impact.pending
                  ? () => {
                      const pending = impact.pending!;
                      liveChange(pending, `${pending.kind} on ${label(pending.target)}`);
                    }
                  : undefined
              }
            />
          )}
        </main>
        <aside className="drawer" aria-label={`${panel} panel`}>
          {panel === "canvas" &&
            (focusNode ? (
              <>
                <NodeInspector node={focusNode} onChange={updateNode} focusName={focus?.rename} key={`${focusNode.id}-${focus?.rename}`} />
                <div className="inspector-actions">
                  <button onClick={() => liveChange({ kind: focusNode.state === "down" ? "node-up" : "node-down", target: focusNode.id }, `${labelOf(focusNode)} ${focusNode.state === "down" ? "restored" : "powered down"}`)}>
                    {focusNode.state === "down" ? "Restore" : "Power down"}
                  </button>
                  <button onClick={() => setEndpoint("src", focusNode.id)}>Set as source</button>
                  <button onClick={() => setEndpoint("dst", focusNode.id)}>Set as destination</button>
                  <button className="danger-menu" onClick={() => remove([focusNode.id], [])}>
                    Delete
                  </button>
                </div>
                <label>
                  Connect to
                  <select
                    value=""
                    onChange={(event) => event.target.value && connect(focusNode.id, event.target.value)}
                  >
                    <option value="">Choose a device…</option>
                    {topology.nodes
                      .filter((node) => node.id !== focusNode.id)
                      .map((node) => (
                        <option key={node.id} value={node.id}>
                          {labelOf(node)} ({node.type})
                        </option>
                      ))}
                  </select>
                </label>
              </>
            ) : focusLink ? (
              <>
                <LinkInspector link={focusLink} label={label} onChange={updateLink} key={focusLink.id} />
                <div className="inspector-actions">
                  <button onClick={() => liveChange({ kind: focusLink.state === "down" ? "link-up" : "link-down", target: focusLink.id }, `Link ${focusLink.id} ${focusLink.state === "down" ? "restored" : "set down"}`)}>
                    {focusLink.state === "down" ? "Restore link" : "Set link down"}
                  </button>
                  <button className="danger-menu" onClick={() => remove([], [focusLink.id])}>
                    Delete link
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="eyebrow">DEVICE LIBRARY</p>
                <h2>Add devices</h2>
                <Palette onAdd={(type) => addDevice(type)} full={topology.nodes.length >= MAX_DEVICES} />
                <p className="hint">Click to add at the centre, drag onto the canvas, or right-click empty canvas. Drag from a device's right handle to another device to connect. Shift+F10 opens the menu for the selected item.</p>
                <Legend />
              </>
            ))}
          {panel === "simulate" && (
            <div className="simulate-panel">
              <p className="eyebrow">PACKET & FAILURE LAB</p>
              <h2>Simulate</h2>
              <div className="field-grid">
                <label>
                  Routing
                  <select value={protocol} onChange={(event) => setProtocol(event.target.value as Protocol)}>
                    <option value="static">Static</option>
                    <option value="rip">RIP</option>
                    <option value="ospf">OSPF</option>
                  </select>
                </label>
                <label>
                  Packet
                  <select value={primary?.app ?? "ICMP"} onChange={(event) => setFlows(([first, ...rest]) => (first ? [{ ...first, app: event.target.value }, ...rest] : []))}>
                    {Object.keys(PACKET_BYTES).map((app) => (
                      <option key={app}>{app}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Source
                  <select value={primary?.src ?? ""} onChange={(event) => setEndpoint("src", event.target.value)}>
                    {topology.nodes.filter(isL3).map((node) => (
                      <option key={node.id} value={node.id}>
                        {labelOf(node)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Destination
                  <select value={primary?.dst ?? ""} onChange={(event) => setEndpoint("dst", event.target.value)}>
                    {topology.nodes.filter(isL3).map((node) => (
                      <option key={node.id} value={node.id}>
                        {labelOf(node)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {primaryResult && (
                <dl className="live-metrics" aria-live="polite">
                  <div>
                    <dt>Path</dt>
                    <dd>{primaryResult.reachable ? primaryResult.forward.l3Hops.map(label).join(" → ") : primaryResult.forward.reason}</dd>
                  </div>
                  <div>
                    <dt>One-way</dt>
                    <dd>{primaryResult.metrics.total.toFixed(3)} ms</dd>
                  </div>
                  <div>
                    <dt>RTT</dt>
                    <dd>{primaryResult.rttMs.toFixed(3)} ms</dd>
                  </div>
                  <div>
                    <dt>TTL at dest</dt>
                    <dd>{primaryResult.forward.ttlAtDest}</dd>
                  </div>
                </dl>
              )}
              <div className="flow-list">
                <strong>Active flows ({flows.length})</strong>
                {flows.map((flow, index) => (
                  <span key={`${flow.src}-${flow.dst}-${index}`} className="flow-chip">
                    {label(flow.src)} → {label(flow.dst)} · {flow.app}
                    {index > 0 && (
                      <button aria-label="Remove flow" onClick={() => setFlows((items) => items.filter((_, position) => position !== index))}>
                        ✕
                      </button>
                    )}
                  </span>
                ))}
                {primary && (
                  <button className="ghost-button" onClick={() => setFlows((items) => [items[0], { ...items[0] }, ...items.slice(1)])}>
                    + Keep this flow running and add another
                  </button>
                )}
              </div>
              <fieldset>
                <legend>Fault preview</legend>
                <div className="field-grid">
                  <label>
                    Fault
                    <select
                      value={faultKind}
                      onChange={(event) => {
                        const next = event.target.value as FaultKind;
                        setFaultKind(next);
                        setFaultTarget((next.startsWith("node") ? topology.nodes[0]?.id : topology.links[0]?.id) ?? "");
                      }}
                    >
                      <option value="link-down">Link down</option>
                      <option value="node-down">Device down</option>
                      <option value="congestion">Congestion (95% load)</option>
                      <option value="latency">High latency (+100 ms)</option>
                      <option value="packet-loss">Packet loss (30%)</option>
                    </select>
                  </label>
                  <label>
                    Target
                    <select value={faultTarget} onChange={(event) => setFaultTarget(event.target.value)}>
                      {faultTargets.map((item) => (
                        <option key={item.id} value={item.id}>
                          {"type" in item ? labelOf(item) : `${item.id} (${label(item.a.node_id)}↔${label(item.b.node_id)})`}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <button
                  disabled={!primary || !faultTarget}
                  onClick={() => {
                    const fault = { kind: faultKind, target: faultTarget };
                    setImpact({ title: `Preview: ${faultKind} on ${label(faultTarget)}`, impact: compareImpact(topology, applyFault(topology, fault), { ...primary!, protocol }), pending: fault });
                    log("PREVIEW", `${faultKind} on ${faultTarget} previewed (nothing changed)`);
                  }}
                >
                  Preview impact
                </button>
              </fieldset>
            </div>
          )}
          {panel === "tables" && (
            <div className="tables-panel">
              <p className="eyebrow">ROUTING TABLE · {protocol.toUpperCase()}</p>
              <label>
                Device
                <select value={tableDevice ?? ""} onChange={(event) => setFocus({ kind: "node", id: event.target.value })}>
                  {routers.map((node) => (
                    <option key={node.id} value={node.id}>
                      {labelOf(node)} ({node.type})
                    </option>
                  ))}
                </select>
              </label>
              {tableDevice && (
                <table className="route-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Prefix</th>
                      <th>Next hop</th>
                      <th>Iface</th>
                      <th>Metric</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(tables.get(tableDevice) ?? []).map((route) => {
                      const old = previousTables?.get(tableDevice)?.find((item) => item.prefix === route.prefix);
                      const changed = previousTables && (!old || old.nextHop !== route.nextHop || old.metric !== route.metric);
                      return (
                        <tr key={route.prefix} className={changed ? "row-changed" : ""}>
                          <td>{route.code}</td>
                          <td>{route.prefix}</td>
                          <td>{route.nextHop ? label(route.nextHop) : "connected"}</td>
                          <td>{route.iface}</td>
                          <td>{route.metric}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
          {panel === "logs" && (
            <div className="logs-panel">
              <p className="eyebrow">EVENT LOG · THIS NETWORK ONLY</p>
              <ol className="event-log">
                {logs.length ? (
                  logs.map((entry, index) => (
                    <li key={`${entry.at}-${index}`}>
                      <time>{entry.at}</time> <b>{entry.source}</b> {entry.text}
                    </li>
                  ))
                ) : (
                  <li>No events yet. Right-click a device or link, or preview a fault.</li>
                )}
              </ol>
            </div>
          )}
          {panel === "ai" && (
            <div className="ai-panel">
              <p className="eyebrow">LAB ASSISTANT</p>
              <p>AI explain and suggest arrive in a later step.</p>
            </div>
          )}
        </aside>
      </div>
      {menu && (
        <div
          className="context-menu"
          style={{ left: menu.x, top: menu.y }}
          role="menu"
          aria-label="Canvas actions"
          onKeyDown={(event) => event.key === "Escape" && setMenu(null)}
        >
          {menuNode && (
            <>
              <strong>
                {labelOf(menuNode)} · {menuNode.type}
              </strong>
              <button role="menuitem" autoFocus onClick={() => (liveChange({ kind: menuNode.state === "down" ? "node-up" : "node-down", target: menuNode.id }, `${labelOf(menuNode)} ${menuNode.state === "down" ? "restored" : "powered down"}`), setMenu(null))}>
                {menuNode.state === "down" ? "Restore (power on)" : "Power down"}
              </button>
              <button role="menuitem" onClick={() => (setFocus({ kind: "node", id: menuNode.id, rename: true }), setPanel("canvas"), setMenu(null))}>
                Rename
              </button>
              <button role="menuitem" onClick={() => (setFocus({ kind: "node", id: menuNode.id }), setPanel("canvas"), setMenu(null))}>
                Edit interfaces / IP
              </button>
              <button role="menuitem" onClick={() => (setEndpoint("src", menuNode.id), setMenu(null))}>
                Set as source
              </button>
              <button role="menuitem" onClick={() => (setEndpoint("dst", menuNode.id), setMenu(null))}>
                Set as destination
              </button>
              <button role="menuitem" onClick={() => (setFocus({ kind: "node", id: menuNode.id }), setPanel("tables"), setMenu(null))}>
                Show routing / ARP / MAC tables
              </button>
              <button role="menuitem" className="danger-menu" onClick={() => (remove([menuNode.id], []), setMenu(null))}>
                Delete device
              </button>
            </>
          )}
          {menuLink && (
            <>
              <strong>
                {label(menuLink.a.node_id)} ↔ {label(menuLink.b.node_id)}
              </strong>
              <button role="menuitem" autoFocus onClick={() => (liveChange({ kind: menuLink.state === "down" ? "link-up" : "link-down", target: menuLink.id }, `Link ${menuLink.id} ${menuLink.state === "down" ? "restored" : "set down"}`), setMenu(null))}>
                {menuLink.state === "down" ? "Restore link" : "Set link down"}
              </button>
              <button role="menuitem" onClick={() => (setFocus({ kind: "link", id: menuLink.id }), setPanel("canvas"), setMenu(null))}>
                Edit bandwidth / delay / loss / jitter / queue
              </button>
              <button role="menuitem" className="danger-menu" onClick={() => (remove([], [menuLink.id]), setMenu(null))}>
                Delete link
              </button>
            </>
          )}
          {menu.kind === "pane" && (
            <>
              <strong>Add device here</strong>
              {DEVICE_TYPES.map((type, index) => (
                <button
                  role="menuitem"
                  autoFocus={index === 0}
                  key={type}
                  disabled={topology.nodes.length >= MAX_DEVICES}
                  onClick={() => {
                    addDevice(type, flowApi.screenToFlowPosition({ x: menu.x, y: menu.y }));
                    setMenu(null);
                  }}
                >
                  <DeviceSymbol type={type} /> {type}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
