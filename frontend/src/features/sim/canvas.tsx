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

// Simplified line-art versions of the classic network diagram symbols.
const SYMBOLS: Record<string, React.ReactNode> = {
  router: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9 9 5.5 5.5m0 0v3m0-3h3M15 15l3.5 3.5m0 0v-3m0 3h-3M15 9l3.5-3.5m-3.5 0h3.5v3.5M9 15l-3.5 3.5m3.5 0H5.5V15" />
    </>
  ),
  switch: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M7 10h9m0 0-2-2m2 2-2 2M17 14H8m0 0 2-2m-2 2 2 2" />
    </>
  ),
  hub: (
    <>
      <rect x="3" y="7" width="18" height="10" rx="2" />
      <path d="M7 12h.01M10.5 12h.01M14 12h.01M17.5 12h.01M12 3v4m0 10v4" />
    </>
  ),
  repeater: (
    <>
      <path d="M4 12h3l2-5 3 10 2-5h6" />
      <path d="M18 9l3 3-3 3" />
    </>
  ),
  host: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="1.5" />
      <path d="M9 20h6M12 16v4" />
    </>
  ),
  server: (
    <>
      <rect x="6" y="3" width="12" height="18" rx="1.5" />
      <path d="M9 7h6M9 10h6M9 14h.01M12 14h3" />
    </>
  ),
  firewall: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="1" />
      <path d="M3 9.7h18M3 14.3h18M9 5v4.7M15 5v4.7M6 9.7v4.6M12 9.7v4.6M18 9.7v4.6M9 14.3V19M15 14.3V19" />
    </>
  ),
  "access-point": (
    <>
      <path d="M12 13v8M8 21h8" />
      <path d="M8.5 9.5a5 5 0 0 1 7 0M5.5 6.5a9 9 0 0 1 13 0" />
      <circle cx="12" cy="12.5" r="1" />
    </>
  ),
};

export function DeviceSymbol({ type }: { type: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="device-symbol">
      {SYMBOLS[type] ?? SYMBOLS.host}
    </svg>
  );
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
  return (
    <div
      className={`device-card${down ? " is-down" : ""}${unreachable ? " is-unreachable" : ""}${selected ? " is-selected" : ""}`}
      data-type={node.type}
    >
      <Handle type="target" position={Position.Top} className="device-handle device-handle--target" />
      <span className="device-icon">
        <DeviceSymbol type={node.type} />
      </span>
      <span className="device-text">
        <strong>{labelOf(node)}</strong>
        <small>{ipOf(node)}</small>
      </span>
      <span className="device-badge">{TYPE_BADGE[node.type] ?? node.type}</span>
      <i
        className="status-dot"
        role="img"
        aria-label={down ? "powered down" : unreachable ? "unreachable from source" : "up"}
      />
      {role && <span className={`role-tag role-tag--${role.toLowerCase()}`}>{role}</span>}
      {critical && (
        <span className="spof-tag" title={critical}>
          SPOF
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
      {(selected || showLabel) && (
        <EdgeLabelRenderer>
          <div className="edge-label" style={{ transform: `translate(-50%, -50%) translate(${mid.x}px, ${mid.y}px)` }}>
            {link.capacity_mbps} Mbps · {link.length_m != null ? `${link.length_m} m` : `${link.delay_ms} ms`}
            {utilisation > 0 && ` · ${Math.round(utilisation)}%`}
            {link.state !== "up" && ` · ${link.state.toUpperCase()}`}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});

export const nodeTypes = { device: DeviceNode };
export const edgeTypes = { traffic: TrafficEdge };
