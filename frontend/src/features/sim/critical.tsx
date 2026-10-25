import { useMemo } from "react";
import type { Topology } from "../../lib/api";
import { dependents, failureImpact, type criticalSummary } from "../../sim/analysis";
import type { Protocol } from "../../sim/engine";

type Summary = ReturnType<typeof criticalSummary>;

export function CriticalList({ summary, label, onFocus }: { summary: Summary; label: (id: string) => string; onFocus: (kind: "node" | "link", id: string) => void }) {
  return (
    <section className="critical-list">
      <p className="eyebrow">SINGLE POINTS OF FAILURE · SIMULATED</p>
      {summary.busiest && (
        <p className="hint">
          Busiest middle device: <strong>{label(summary.busiest.id)}</strong> carries the most shortest paths between end devices (betweenness {summary.busiest.score.toFixed(1)}).
        </p>
      )}
      {summary.spof.length ? (
        <ol>
          {summary.spof.slice(0, 12).map((item) => (
            <li key={item.id}>
              <button className="link-button" onClick={() => onFocus(item.kind === "device" ? "node" : "link", item.id)}>
                <span className="spof-tag">SPOF</span> {item.summary}
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="hint">No single point of failure: every device and link has a backup path.</p>
      )}
      {summary.spof.length > 12 && <p className="hint">… and {summary.spof.length - 12} more.</p>}
    </section>
  );
}

export function DependencyView({
  topology,
  protocol,
  device,
  flows,
  label,
}: {
  topology: Topology;
  protocol: Protocol;
  device: string;
  flows: { src: string; dst: string; app: string }[];
  label: (id: string) => string;
}) {
  const view = useMemo(() => dependents(topology, protocol, device, flows), [device, flows, protocol, topology]);
  const impact = useMemo(() => failureImpact(topology, device), [device, topology]);
  return (
    <section className="dependency-view">
      <p className="eyebrow">DEPENDENCIES</p>
      <p className={impact.lost.length ? "delta-worse" : "hint"}>{impact.summary[0].toUpperCase() + impact.summary.slice(1)}.</p>
      <dl className="live-metrics">
        <div>
          <dt>Upstream</dt>
          <dd>{view.upstream.map(label).join(" → ") || "— (this is the core)"}</dd>
        </div>
        <div>
          <dt>Downstream</dt>
          <dd>{view.downstream.map(label).join(", ") || "nothing depends only on it"}</dd>
        </div>
      </dl>
      {view.flows.length > 0 && (
        <ul className="flow-layers">
          {view.flows.map((flow, index) => (
            <li key={index}>
              Flow {label(flow.src)} → {label(flow.dst)} uses it at {flow.layers.join(", ")}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function LinkImpact({ topology, link }: { topology: Topology; link: string }) {
  const impact = useMemo(() => failureImpact(topology, link), [link, topology]);
  return <p className={impact.lost.length ? "delta-worse" : "hint"}>{impact.summary[0].toUpperCase() + impact.summary.slice(1)}.</p>;
}
