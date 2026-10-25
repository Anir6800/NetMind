import { memo } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  Handle,
  Position,
  useInternalNode,
  type EdgeProps,
  type NodeProps,
} from "@xyflow/react";
import type { TopologyLink, TopologyNode } from "../../lib/api";
import { ipOf, labelOf } from "../../sim/engine";
import { useLinkDots } from "./playback";
import { Icon, type IconSize } from "../../components/icons/Icon";
import { DEVICE_ICON } from "../../components/icons/registry";

export const DEVICE_TYPES = ["router", "switch", "hub", "repeater", "host", "server", "firewall", "access-point"];
export const TYPE_BADGE: Record<string, string> = {
  router: "L3 router",
  firewall: "L3 firewall",
  switch: "L2 switch",
  "access-point": "L2 AP",
  hub: "L1 hub",
  repeater: "L1 repeater",
  host: "PC",
  server: "Server",
};

export const LAYER_OF: Record<string, "l1" | "l2" | "l3" | "l7"> = {
  hub: "l1",
  repeater: "l1",
  switch: "l2",
  "access-point": "l2",
  router: "l3",
  firewall: "l3",
  host: "l7",
  server: "l7",
};

export function DeviceSymbol({ type, size = 20, filled = true, label }: { type: string; size?: IconSize; filled?: boolean; label?: string }) {
  return <Icon name={DEVICE_ICON[type] ?? "host"} size={size} filled={filled} label={label} className="device-symbol" />;
}

export type DeviceData = {
  node: TopologyNode;
  role?: "SRC" | "DST";
  critical?: string;
  unreachable?: boolean;
};

export const DeviceNode = memo(function DeviceNode({ data, selected }: NodeProps) {
  const { node, role, critical, unreachable } = data as DeviceData;
  const down = node.state === "down";
  const state = down ? "powered down" : unreachable ? "unreachable from the source" : "up";
  return (
    <div
      className={`device-card${down ? " is-down" : ""}${unreachable ? " is-unreachable" : ""}${selected ? " is-selected" : ""}`}
      data-type={node.type}
      data-layer={LAYER_OF[node.type] ?? "l3"}
      title={`${labelOf(node)} · ${TYPE_BADGE[node.type] ?? node.type} · ${state}`}
    >
      <Handle type="target" position={Position.Top} className="device-handle device-handle--target" />
      <span className="device-icon">
        <DeviceSymbol type={node.type} filled={!down} label={TYPE_BADGE[node.type] ?? node.type} />
      </span>
      <span className="device-text">
        <strong>{labelOf(node)}</strong>
        <small>
          {ipOf(node)}
          {node.interfaces.length > 1 && ` · ${node.interfaces.length} ports`}
        </small>
      </span>
      <span className="device-badge">{TYPE_BADGE[node.type] ?? node.type}</span>
      <i className="status-dot" role="img" aria-label={state} />
      {down && (
        <span className="state-chip state-chip--down">
          <Icon name="power" size={16} /> DOWN
        </span>
      )}
      {role && <span className={`role-tag role-tag--${role.toLowerCase()}`}>{role}</span>}
      {critical && (
        <span className="spof-tag" title={critical} aria-label={`Single point of failure: ${critical}`}>
          <Icon name="critical" size={16} filled /> SPOF
        </span>
      )}
      <Handle type="source" position={Position.Right} className="device-handle" />
    </div>
  );
});

export type PlaybackDot = { key: string; fraction: number; tone: string; label: string };
export type TrafficData = {
  link: TopologyLink;
  utilisation: number;
  forward: boolean; // student flow travels a -> b
  backward: boolean; // student flow (or its reply) travels b -> a
  showLabel?: boolean;
  bridge?: string; // single-point-of-failure summary when this link is a bridge
};

function center(node: ReturnType<typeof useInternalNode>) {
  if (!node) return { x: 0, y: 0 };
  return {
    x: node.internals.positionAbsolute.x + (node.measured.width ?? 0) / 2,
    y: node.internals.positionAbsolute.y + (node.measured.height ?? 0) / 2,
  };
}

// Straight centre-to-centre link with continuous traffic dots.
export const TrafficEdge = memo(function TrafficEdge({ id, source, target, data, selected }: EdgeProps) {
  const a = center(useInternalNode(source));
  const b = center(useInternalNode(target));
  const { link, utilisation, forward, backward, showLabel, bridge } = data as TrafficData;
  const dots = useLinkDots(id, link.a.node_id);
  const path = `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
  const down = link.state === "down";
  const tone = down ? "down" : utilisation >= 90 ? "hot" : utilisation >= 70 ? "warm" : forward || backward ? "path" : "idle";
  // Density and speed follow utilisation; a down link carries nothing.
  const count = down ? 0 : Math.min(4, 1 + Math.floor(utilisation / 30));
  const seconds = Math.max(0.7, 2.6 - utilisation / 50);
  const stream = (reverse: boolean, kind: string) =>
    Array.from({ length: count }, (_, index) => (
      <circle key={`${kind}-${index}`} r={kind === "flow" ? 3.6 : 2.2} className={`packet-dot packet-dot--${kind === "flow" ? tone : "bg"}`}>
        <animateMotion
          dur={`${seconds}s`}
          begin={`${(index * seconds) / count}s`}
          repeatCount="indefinite"
          path={path}
          keyPoints={reverse ? "1;0" : "0;1"}
          keyTimes="0;1"
          calcMode="linear"
        />
      </circle>
    ));
  const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  return (
    <>
      <BaseEdge id={id} path={path} className={`traffic-edge traffic-edge--${tone}${selected ? " is-selected" : ""}`} interactionWidth={18} />
      {forward && stream(false, "flow")}
      {backward && stream(true, "flow")}
      {!forward && !backward && utilisation > 0 && stream(false, "background")}
      {(forward || backward) && !down && (
        <path
          className="flow-arrow"
          d="M -5 -4 L 4 0 L -5 4 z"
          transform={`translate(${mid.x} ${mid.y}) rotate(${forward ? angle : angle + 180})`}
        />
      )}
      {bridge && link.state !== "down" && (
        <g className="bridge-mark" transform={`translate(${mid.x} ${mid.y + 12})`}>
          <title>{bridge}</title>
          <rect x={-15} y={-7} width={30} height={13} rx={6} />
          <text y={3}>SPOF</text>
        </g>
      )}
      {dots.map((dot) => {
        const x = a.x + (b.x - a.x) * dot.fraction;
        const y = a.y + (b.y - a.y) * dot.fraction;
        return (
          <g key={dot.key} className={`sim-packet sim-packet--${dot.tone}`} transform={`translate(${x} ${y})`}>
            <circle r="7" />
            <text y="-11">{dot.label}</text>
          </g>
        );
      })}
      {(selected || showLabel || link.state !== "up") && (
        <EdgeLabelRenderer>
          <div
            className={`edge-label edge-label--${link.state}${selected || showLabel ? " is-open" : ""}`}
            style={{ transform: `translate(-50%, -50%) translate(${mid.x}px, ${mid.y}px)` }}
          >
            <Icon name={link.state === "down" ? "link-down" : link.state === "degraded" ? "warning" : "link"} size={16} filled />
            {selected || showLabel ? (
              <>
                {link.capacity_mbps} Mbps · {link.length_m != null ? `${link.length_m} m` : `${link.delay_ms} ms`}
                {utilisation > 0 && ` · ${Math.round(utilisation)}%`}
                {link.state !== "up" && ` · ${link.state.toUpperCase()}`}
              </>
            ) : (
              link.state.toUpperCase()
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});

export const nodeTypes = { device: DeviceNode };
export const edgeTypes = { traffic: TrafficEdge };
