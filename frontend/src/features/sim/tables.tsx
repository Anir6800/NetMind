import { useMemo, useState } from "react";
import type { Topology } from "../../lib/api";
import { converge, traceroute, type ConvergenceResult } from "../../sim/convergence";
import { macOf } from "../../sim/des";
import { ipOf, type Protocol, type Tables } from "../../sim/engine";
import { usePlayback } from "./playback";

const seconds = (value: number | null) => (value === null ? "never" : value < 1000 ? `${value.toFixed(1)} ms` : `${(value / 1000).toFixed(2)} s`);

export function RouteTable({ device, tables, previous, label }: { device: string; tables: Tables; previous: Tables | null; label: (id: string) => string }) {
  const now = tables.get(device) ?? [];
  const was = previous?.get(device) ?? null;
  const removed = was ? was.filter((route) => !now.some((item) => item.prefix === route.prefix)) : [];
  return (
    <table className="route-table">
      <caption className="hint">
        Codes: C connected · S static · R RIP · O OSPF{was ? " · rows coloured against the table before the last change" : ""}
      </caption>
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
        {now.map((route) => {
          const old = was?.find((item) => item.prefix === route.prefix);
          const status = !was ? "" : !old ? "row-added" : old.nextHop !== route.nextHop || old.metric !== route.metric ? "row-changed" : "";
          return (
            <tr key={route.prefix} className={status}>
              <td>{route.code}</td>
              <td>{route.prefix}</td>
              <td>{route.nextHop ? label(route.nextHop) : "connected"}</td>
              <td>{route.iface}</td>
              <td>
                {route.metric}
                {old && status === "row-changed" && <small> (was {old.nextHop ? label(old.nextHop) : "connected"}, {old.metric})</small>}
              </td>
            </tr>
          );
        })}
        {removed.map((route) => (
          <tr key={`gone-${route.prefix}`} className="row-removed">
            <td>{route.code}</td>
            <td>{route.prefix}</td>
            <td>{route.nextHop ? label(route.nextHop) : "connected"}</td>
            <td>{route.iface}</td>
            <td>{route.metric}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ARP and MAC tables are learned from traffic, so they come from the last packet run.
export function LearnedTables({ device, isSwitch, label, topology }: { device: string; isSwitch: boolean; label: (id: string) => string; topology: Topology }) {
  const { run } = usePlayback();
  const owner = new Map(topology.nodes.map((node) => [macOf(node.id), node.id]));
  const byIp = new Map(topology.nodes.map((node) => [ipOf(node), node.id]));
  if (!run) return <p className="hint">ARP and MAC tables are learned from traffic: Simulate → Send packets to fill them.</p>;
  const arp = [...(run.arpCaches.get(device) ?? [])];
  const mac = [...(run.macTables.get(device) ?? [])];
  return (
    <>
      {isSwitch ? (
        <table className="route-table">
          <caption className="hint">MAC address table (learned in the last run)</caption>
          <thead>
            <tr>
              <th>MAC</th>
              <th>Port</th>
              <th>Device</th>
            </tr>
          </thead>
          <tbody>
            {mac.length ? (
              mac.map(([address, port]) => (
                <tr key={address}>
                  <td>{address}</td>
                  <td>{port}</td>
                  <td>{label(owner.get(address) ?? "?")}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3}>empty — no frames crossed this switch</td>
              </tr>
            )}
          </tbody>
        </table>
      ) : (
        <table className="route-table">
          <caption className="hint">ARP cache (learned in the last run)</caption>
          <thead>
            <tr>
              <th>IP</th>
              <th>MAC</th>
              <th>Device</th>
            </tr>
          </thead>
          <tbody>
            {arp.length ? (
              arp.map(([ip, address]) => (
                <tr key={ip}>
                  <td>{ip}</td>
                  <td>{address}</td>
                  <td>{label(byIp.get(ip) ?? "?")}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3}>empty</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </>
  );
}

export function ConvergencePanel({
  change,
  protocol,
  flow,
  label,
  isRouter,
}: {
  change: { title: string; before: Topology; after: Topology };
  protocol: Protocol;
  flow?: { src: string; dst: string };
  label: (id: string) => string;
  isRouter: (id: string) => boolean;
}) {
  const [options, setOptions] = useState({ seed: 1, splitHorizon: true, triggeredUpdates: true, showHosts: false });
  const [compare, setCompare] = useState<ConvergenceResult[] | null>(null);
  const result = useMemo(() => converge(change.before, change.after, { protocol, flow, ...options }), [change, protocol, flow, options]);
  const steps = result.steps.filter((step) => options.showHosts || isRouter(step.router));
  const perRouter = new Map<string, number>();
  for (const item of result.changes) perRouter.set(item.router, (perRouter.get(item.router) ?? 0) + 1);
  return (
    <section className="convergence">
      <p className="eyebrow">CONVERGENCE TIMELINE · {protocol.toUpperCase()}</p>
      <h3>After: {change.title}</h3>
      <dl className="live-metrics">
        <div>
          <dt>Detection</dt>
          <dd>{seconds(result.detectionMs)}</dd>
        </div>
        <div>
          <dt>Converged</dt>
          <dd>{protocol === "static" ? "never — static routes do not change by themselves" : seconds(result.convergedMs)}</dd>
        </div>
        <div>
          <dt>Flow outage</dt>
          <dd>{result.outageMs === null ? (result.reachableAtEnd ? "—" : "permanent (blackholed / unreachable)") : seconds(result.outageMs)}</dd>
        </div>
        <div>
          <dt>Packets lost</dt>
          <dd>{result.packetsLost === null ? "all, until restored" : `${result.packetsLost} at 100 packets/s`}</dd>
        </div>
        <div>
          <dt>Table changes</dt>
          <dd>{[...perRouter].filter(([id]) => isRouter(id)).map(([id, count]) => `${label(id)} ${count}`).join(" · ") || "none"}</dd>
        </div>
      </dl>
      {result.countToInfinity && <p className="delta-worse">Count-to-infinity: a metric climbed hop by hop towards 16 before the route was declared unreachable.</p>}
      {protocol === "rip" && (
        <div className="acl-grid">
          <label className="check">
            <input type="checkbox" checked={options.splitHorizon} onChange={(event) => setOptions({ ...options, splitHorizon: event.target.checked })} />
            Split horizon + poison reverse
          </label>
          <label className="check">
            <input type="checkbox" checked={options.triggeredUpdates} onChange={(event) => setOptions({ ...options, triggeredUpdates: event.target.checked })} />
            Triggered updates
          </label>
        </div>
      )}
      <div className="inspector-actions">
        <label className="seed-field">
          Seed
          <input type="number" value={options.seed} onChange={(event) => setOptions({ ...options, seed: Number(event.target.value) })} />
        </label>
        <label className="check">
          <input type="checkbox" checked={options.showHosts} onChange={(event) => setOptions({ ...options, showHosts: event.target.checked })} />
          Show host steps
        </label>
        <button onClick={() => setCompare((["static", "rip", "ospf"] as Protocol[]).map((each) => converge(change.before, change.after, { protocol: each, flow, ...options })))}>
          Compare Static vs RIP vs OSPF
        </button>
      </div>
      {compare && (
        <table className="route-table">
          <thead>
            <tr>
              <th>Protocol</th>
              <th>Detection</th>
              <th>Converged</th>
              <th>Outage</th>
              <th>Lost @100 pps</th>
            </tr>
          </thead>
          <tbody>
            {compare.map((item) => (
              <tr key={item.protocol}>
                <td>{item.protocol.toUpperCase()}</td>
                <td>{seconds(item.detectionMs)}</td>
                <td>{seconds(item.convergedMs)}</td>
                <td>{item.outageMs === null ? (item.reachableAtEnd ? "—" : "permanent") : seconds(item.outageMs)}</td>
                <td>{item.packetsLost ?? "all"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <ol className="event-log">
        {steps.slice(0, 400).map((step, index) => (
          <li key={index} className={step.kind === "route" ? "is-route" : ""}>
            <time>t={seconds(step.t)}</time> {step.text}
          </li>
        ))}
      </ol>
      <p className="sim-note">SIMULATED timers: RIP update 30 s, invalid 180 s, flush 240 s, triggered 1–5 s; OSPF hello 10 s, dead 40 s, SPF delay 200 ms.</p>
    </section>
  );
}

export function TraceroutePanel({ topology, protocol, flow, label }: { topology: Topology; protocol: Protocol; flow?: { src: string; dst: string }; label: (id: string) => string }) {
  const [hops, setHops] = useState<ReturnType<typeof traceroute> | null>(null);
  if (!flow) return null;
  return (
    <section className="traceroute">
      <button onClick={() => setHops(traceroute(topology, protocol, flow.src, flow.dst))}>
        Traceroute {label(flow.src)} → {label(flow.dst)}
      </button>
      {hops && (
        <table className="route-table">
          <thead>
            <tr>
              <th>TTL</th>
              <th>Reply from</th>
              <th>RTT</th>
              <th>Message</th>
            </tr>
          </thead>
          <tbody>
            {hops.map((hop) => (
              <tr key={hop.ttl}>
                <td>{hop.ttl}</td>
                <td>{hop.device ? label(hop.device) : "*"}</td>
                <td>{hop.rttMs === null ? "*" : `${hop.rttMs.toFixed(3)} ms`}</td>
                <td>{hop.reply}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
