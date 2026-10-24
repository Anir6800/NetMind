import { useState } from "react";
import type { TopologyLink, TopologyNode } from "../../lib/api";
import { DEVICE_LAYER, PROCESSING_MS, ospfCost, propagationMs, type FlowResult, type Impact } from "../../sim/engine";
import { DEVICE_TYPES, DeviceSymbol, TYPE_BADGE } from "./canvas";

const ms = (value: number) => `${value.toFixed(3)} ms`;

type Row = { label: string; before: string; after: string; change: "worse" | "better" | "same" };

function compare(label: string, before: number, after: number, format: (value: number) => string, higherIsWorse = true): Row {
  const delta = after - before;
  const change = Math.abs(delta) < 1e-9 ? "same" : delta > 0 === higherIsWorse ? "worse" : "better";
  return { label, before: format(before), after: format(after), change };
}

function flowRows(before: FlowResult, after: FlowResult, reachableBefore: number, reachableAfter: number): Row[] {
  const state = (result: FlowResult) => (result.reachable ? "reachable" : `dropped: ${result.forward.reason}`);
  return [
    { label: "Destination", before: state(before), after: state(after), change: before.reachable === after.reachable ? "same" : after.reachable ? "better" : "worse" },
    compare("One-way delay", before.metrics.total, after.metrics.total, ms),
    compare("RTT", before.rttMs, after.rttMs, ms),
    compare("TTL at destination", before.forward.ttlAtDest, after.forward.ttlAtDest, String, false),
    compare("Loss", before.metrics.loss, after.metrics.loss, (value) => `${value.toFixed(2)}%`),
    compare("Throughput (bottleneck)", before.metrics.throughputMbps, after.metrics.throughputMbps, (value) => `${value.toFixed(1)} Mbps`, false),
    compare("Reachable devices", reachableBefore, reachableAfter, String, false),
  ];
}

export function ImpactCard({
  title,
  impact,
  label,
  onClose,
  onApply,
}: {
  title: string;
  impact: Impact;
  label: (id: string) => string;
  onClose: () => void;
  onApply?: () => void;
}) {
  const hops = (result: FlowResult) => result.forward.l3Hops.map(label).join(" → ") || "—";
  return (
    <section className="impact-card" aria-live="polite" aria-label="Before and after impact">
      <header>
        <div>
          <p className="eyebrow">{onApply ? "PREVIEW · NOTHING CHANGED YET" : "LIVE CHANGE APPLIED"}</p>
          <h2>{title}</h2>
        </div>
        <button className="ghost-button" onClick={onClose} aria-label="Close impact panel">
          ✕
        </button>
      </header>
      <table className="impact-table">
        <thead>
          <tr>
            <th scope="col">Metric</th>
            <th scope="col">Before</th>
            <th scope="col">After</th>
          </tr>
        </thead>
        <tbody>
          {flowRows(impact.before, impact.after, impact.reachableBefore, impact.reachableAfter).map((row) => (
            <tr key={row.label} className={`delta-${row.change}`}>
              <th scope="row">{row.label}</th>
              <td>{row.before}</td>
              <td>{row.after}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="impact-paths">
        <div>
          <dt>Path before</dt>
          <dd>{hops(impact.before)}</dd>
        </div>
        <div className={impact.before.forward.l3Hops.join() === impact.after.forward.l3Hops.join() ? "" : "delta-worse"}>
          <dt>Path after</dt>
          <dd>{impact.after.reachable ? hops(impact.after) : `none — ${impact.after.forward.reason}`}</dd>
        </div>
        <div>
          <dt>Bottleneck</dt>
          <dd>
            {impact.before.metrics.bottleneckLink || "—"} → {impact.after.metrics.bottleneckLink || "—"}
          </dd>
        </div>
      </dl>
      {impact.reachability.length > 0 && (
        <div className="reach-list">
          <strong>Reachability from the source</strong>
          <ul>
            {impact.reachability.map((item) => (
              <li key={item.node} className={item.after ? "delta-better" : "delta-worse"}>
                {label(item.node)} {item.after ? "regained" : "lost"}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="affected">
        <strong>Affected</strong>
        <p>
          Devices: {impact.changedNodes.map(label).join(", ") || "none"} · Links: {impact.changedLinks.join(", ") || "none"}
        </p>
        <ul>
          {impact.layers.map((layer) => (
            <li key={layer}>{layer}</li>
          ))}
        </ul>
        {impact.routeChanges.length > 0 && (
          <details>
            <summary>{impact.routeChanges.length} routing-table entries changed</summary>
            <ul className="route-change-list">
              {impact.routeChanges.slice(0, 40).map((change) => (
                <li key={`${change.router}-${change.prefix}`}>
                  {label(change.router)} {change.prefix}: <span className="delta-worse">{change.before}</span> ⇒{" "}
                  <span className="delta-better">{change.after}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
      {onApply && (
        <button className="danger-solid" onClick={onApply}>
          Apply this fault to the live network
        </button>
      )}
      <p className="sim-note">SIMULATED educational model — not a physical measurement.</p>
    </section>
  );
}

const IPV4_CIDR = /^((25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(25[0-5]|2[0-4]\d|1?\d?\d)\/([0-9]|[12]\d|3[0-2])$/;
const ACL_PROTOCOLS = ["ICMP", "TCP", "UDP", "HTTP", "DNS", "DHCP"];

function NumberField({ label, value, min = 0, max, step = "any", onCommit }: { label: string; value: number | undefined | null; min?: number; max?: number; step?: string; onCommit: (value: number | undefined) => void }) {
  return (
    <label>
      {label}
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        defaultValue={value ?? ""}
        key={String(value)}
        onBlur={(event) => {
          const raw = event.target.value;
          const parsed = raw === "" ? undefined : Number(raw);
          if (parsed === undefined || (parsed >= min && (max === undefined || parsed <= max))) onCommit(parsed);
          else event.target.value = String(value ?? "");
        }}
      />
    </label>
  );
}

export function NodeInspector({ node, onChange, focusName }: { node: TopologyNode; onChange: (node: TopologyNode) => void; focusName?: boolean }) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  return (
    <div className="inspector">
      <header className="inspector-head">
        <span className="device-icon">
          <DeviceSymbol type={node.type} />
        </span>
        <div>
          <p className="eyebrow">{TYPE_BADGE[node.type]} · operates up to L{DEVICE_LAYER[node.type]}</p>
          <h2>{node.name || node.id}</h2>
        </div>
      </header>
      <label>
        Display name
        <input
          autoFocus={focusName}
          defaultValue={node.name ?? ""}
          key={node.id}
          maxLength={40}
          placeholder={node.id}
          onBlur={(event) => onChange({ ...node, name: event.target.value.trim() || undefined })}
          onKeyDown={(event) => event.key === "Enter" && (event.target as HTMLInputElement).blur()}
        />
      </label>
      <p className="hint">
        ID <code>{node.id}</code> · state <strong>{node.state === "down" ? "DOWN" : "UP"}</strong> · processing {PROCESSING_MS[node.type]} ms (per device type)
      </p>
      <fieldset>
        <legend>Interfaces</legend>
        {node.interfaces.map((item, index) => (
          <label key={item.id} className="interface-row">
            <span>{item.id}</span>
            <input
              defaultValue={item.address}
              key={`${node.id}-${item.address}`}
              aria-invalid={Boolean(errors[item.id])}
              onBlur={(event) => {
                const address = event.target.value.trim();
                if (!IPV4_CIDR.test(address)) {
                  setErrors({ ...errors, [item.id]: "Use IPv4/prefix, e.g. 10.0.1.1/24" });
                  return;
                }
                setErrors({ ...errors, [item.id]: "" });
                onChange({ ...node, interfaces: node.interfaces.map((other, position) => (position === index ? { ...other, address } : other)) });
              }}
            />
            {errors[item.id] && <small role="alert">{errors[item.id]}</small>}
          </label>
        ))}
      </fieldset>
      {node.type === "firewall" && (
        <fieldset>
          <legend>Firewall rules (deny ticked protocols)</legend>
          <div className="acl-grid">
            {ACL_PROTOCOLS.map((protocol) => {
              const denied = node.acl?.some((rule) => rule.protocol === protocol && rule.action === "deny") ?? false;
              return (
                <label key={protocol} className="check">
                  <input
                    type="checkbox"
                    checked={denied}
                    onChange={() =>
                      onChange({
                        ...node,
                        acl: denied
                          ? (node.acl ?? []).filter((rule) => rule.protocol !== protocol)
                          : [...(node.acl ?? []), { action: "deny", protocol }],
                      })
                    }
                  />
                  {protocol}
                </label>
              );
            })}
          </div>
        </fieldset>
      )}
    </div>
  );
}

export function LinkInspector({ link, label, onChange }: { link: TopologyLink; label: (id: string) => string; onChange: (link: TopologyLink) => void }) {
  const set = (patch: Partial<TopologyLink>) => onChange({ ...link, ...patch });
  return (
    <div className="inspector">
      <header className="inspector-head">
        <div>
          <p className="eyebrow">LINK · {link.state.toUpperCase()}</p>
          <h2>
            {label(link.a.node_id)} ↔ {label(link.b.node_id)}
          </h2>
        </div>
      </header>
      <div className="field-grid">
        <NumberField label="Bandwidth (Mbps)" value={link.capacity_mbps} min={0.01} max={100000} onCommit={(value) => value && set({ capacity_mbps: value })} />
        <NumberField label="Propagation delay (ms)" value={link.delay_ms} max={10000} onCommit={(value) => set({ delay_ms: value ?? 0 })} />
        <NumberField label="Length (m, overrides delay)" value={link.length_m} max={10000000} onCommit={(value) => set({ length_m: value })} />
        <NumberField label="Loss (%)" value={link.loss_pct ?? 0} max={100} onCommit={(value) => set({ loss_pct: value ?? 0 })} />
        <NumberField label="Jitter (ms)" value={link.jitter_ms ?? 0} max={1000} onCommit={(value) => set({ jitter_ms: value ?? 0 })} />
        <NumberField label="Queue (packets)" value={link.queue_packets ?? 64} min={1} max={10000} step="1" onCommit={(value) => set({ queue_packets: value ?? 64 })} />
        <NumberField label="Background load (%)" value={link.utilisation_pct ?? 0} max={100} onCommit={(value) => set({ utilisation_pct: value ?? 0 })} />
        <NumberField label="OSPF cost override" value={link.ospf_cost} min={1} max={65535} step="1" onCommit={(value) => set({ ospf_cost: value })} />
      </div>
      <p className="hint">
        t_prop = {propagationMs(link).toFixed(4)} ms · OSPF cost {ospfCost(link)} (1000 Mbps reference)
      </p>
    </div>
  );
}

export function Palette({ onAdd, full }: { onAdd: (type: string) => void; full: boolean }) {
  return (
    <div className="device-palette" role="list">
      {DEVICE_TYPES.map((type) => (
        <button
          role="listitem"
          draggable
          disabled={full}
          onDragStart={(event) => event.dataTransfer.setData("device-type", type)}
          onClick={() => onAdd(type)}
          key={type}
          title={`Add ${type} (or drag onto the canvas)`}
        >
          <DeviceSymbol type={type} />
          <span>{type}</span>
        </button>
      ))}
    </div>
  );
}

export function Legend() {
  return (
    <div className="legend-box">
      <strong>Legend</strong>
      <ul>
        <li>
          <i className="swatch swatch--path" /> student flow (moving dots show direction)
        </li>
        <li>
          <i className="swatch swatch--idle" /> idle link · <i className="swatch swatch--bg" /> background load
        </li>
        <li>
          <i className="swatch swatch--warm" /> congested ≥ 70% · <i className="swatch swatch--hot" /> ≥ 90%
        </li>
        <li>
          <i className="swatch swatch--down" /> link down (carries nothing)
        </li>
        <li>
          <i className="dot dot--up" /> up · <i className="dot dot--down" /> powered down · <i className="dot dot--unreach" /> unreachable
        </li>
        <li>
          <span className="spof-tag">SPOF</span> single point of failure
        </li>
      </ul>
    </div>
  );
}

