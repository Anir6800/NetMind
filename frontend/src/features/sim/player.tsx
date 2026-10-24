import { useMemo, useState } from "react";
import { toCsv, type SimRun } from "../../sim/des";
import { DEVICE_LAYER } from "../../sim/engine";
import { SIM_MS_PER_SECOND, SPEEDS, set, stepToNextEvent, usePlayback } from "./playback";

const ms = (value: number) => value.toFixed(4);

export function PlayerControls() {
  const { run, clock, playing, speed } = usePlayback();
  if (!run) return null;
  const current = [...run.events].reverse().find((event) => event.t <= clock + 1e-9);
  return (
    <div className="player" aria-label="Slow-motion player">
      <div className="player-row">
        <button onClick={() => set({ playing: !playing, clock: clock >= run.endTime ? 0 : clock })} aria-label={playing ? "Pause" : "Play"}>
          {playing ? "❚❚ Pause" : "▶ Play"}
        </button>
        <button onClick={stepToNextEvent} title="Jump to the next event and pause">
          Step ⏭
        </button>
        <button onClick={() => set({ clock: 0, playing: false })}>⟲ Reset</button>
        <label className="speed">
          Speed
          <select aria-label="Speed" value={speed} onChange={(event) => set({ speed: Number(event.target.value) })}>
            {SPEEDS.map((value) => (
              <option key={value} value={value}>
                {value}×
              </option>
            ))}
          </select>
        </label>
      </div>
      <input
        type="range"
        min={0}
        max={run.endTime}
        step={run.endTime / 500 || 0.001}
        value={clock}
        aria-label="Virtual time"
        onChange={(event) => set({ clock: Number(event.target.value), playing: false })}
      />
      <p className="virtual-clock">
        t = {clock.toFixed(3)} ms <small>/ {run.endTime.toFixed(3)} ms · 1× = {SIM_MS_PER_SECOND} ms per real second</small>
      </p>
      {current && (
        <p className="current-event" aria-live="polite">
          <b>t={current.t.toFixed(3)} ms</b> {current.text}
        </p>
      )}
    </div>
  );
}

export function PacketList({ run, label }: { run: SimRun; label: (id: string) => string }) {
  const { selected } = usePlayback();
  return (
    <div className="packet-list">
      <strong>Packets ({run.packets.length})</strong>
      <ul>
        {run.packets.map((packet) => (
          <li key={packet.id}>
            <button className={selected === packet.id ? "active" : ""} onClick={() => set({ selected: packet.id })}>
              #{packet.id} {packet.kind} {label(packet.from)}→{label(packet.to)}{" "}
              {packet.reason ? <em className="delta-worse">dropped: {packet.reason}</em> : packet.deliveredAt !== undefined ? `${(packet.deliveredAt - packet.sentAt).toFixed(3)} ms${packet.rttMs ? ` · RTT ${packet.rttMs.toFixed(3)} ms` : ""}` : "in flight"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const LAYER_NAMES: Record<number, string> = { 1: "L1 Physical", 2: "L2 Data link", 3: "L3 Network", 7: "L4–L7 Transport/Application" };

export function PacketInspector({ run, packetId, label, typeOf }: { run: SimRun; packetId: number; label: (id: string) => string; typeOf: (id: string) => string }) {
  const packet = run.packets[packetId - 1];
  const hops = run.hops.filter((hop) => hop.packet === packetId);
  const events = run.events.filter((event) => event.packet === packetId);
  const devices = [...new Set(events.map((event) => event.device))];
  const total = hops.reduce((sum, hop) => sum + hop.proc + hop.queue + hop.tx + hop.prop, 0);
  if (!packet) return null;
  return (
    <section className="packet-inspector">
      <p className="eyebrow">
        PACKET #{packet.id} · {packet.protocol} {packet.kind}
      </p>
      <h3>Layer view</h3>
      <ol className="layer-view">
        {devices.map((device) => {
          const depth = DEVICE_LAYER[typeOf(device)] ?? 3;
          return (
            <li key={device}>
              <strong>{label(device)}</strong> <span className="layer-chip">up to {LAYER_NAMES[depth]}</span>
              <div className="layer-bars" aria-hidden="true">
                {[1, 2, 3, 7].map((layer) => (
                  <i key={layer} className={layer <= depth ? "on" : ""} />
                ))}
              </div>
              <ul>
                {events
                  .filter((event) => event.device === device)
                  .map((event) => (
                    <li key={event.seq}>
                      <b>t={event.t.toFixed(3)}</b> [{event.layer}] {event.text}
                    </li>
                  ))}
              </ul>
            </li>
          );
        })}
      </ol>
      <h3>Hop timing</h3>
      <table className="route-table">
        <thead>
          <tr>
            <th>From</th>
            <th>Link</th>
            <th>t_proc</th>
            <th>t_queue</th>
            <th>t_tx</th>
            <th>t_prop</th>
          </tr>
        </thead>
        <tbody>
          {hops.map((hop, index) => (
            <tr key={index} title={`t_tx = ${hop.bytes} B × 8 / ${hop.mbps} Mbps`}>
              <td>{label(hop.device)}</td>
              <td>{hop.link}</td>
              <td>{ms(hop.proc)}</td>
              <td>{ms(hop.queue)}</td>
              <td>{ms(hop.tx)}</td>
              <td>{ms(hop.prop)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint">
        hop delay = t_proc + t_queue + t_tx + t_prop · t_tx = bits ÷ bandwidth · t_prop = length ÷ 2×10⁸ m/s (or configured delay). Sum of hops {total.toFixed(4)} ms
        {packet.deliveredAt !== undefined && ` + destination processing = ${(packet.deliveredAt - packet.sentAt).toFixed(4)} ms one-way`}.
      </p>
    </section>
  );
}

function download(name: string, type: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function RunLog({ run, label }: { run: SimRun; label: (id: string) => string }) {
  const { clock } = usePlayback();
  const [filters, setFilters] = useState({ device: "", packet: "", layer: "", protocol: "", text: "" });
  const options = useMemo(
    () => ({
      device: [...new Set(run.events.map((event) => event.device))],
      packet: [...new Set(run.events.map((event) => String(event.packet)))],
      layer: [...new Set(run.events.map((event) => event.layer))],
      protocol: [...new Set(run.events.map((event) => event.protocol))],
    }),
    [run],
  );
  const shown = run.events.filter(
    (event) =>
      (!filters.device || event.device === filters.device) &&
      (!filters.packet || String(event.packet) === filters.packet) &&
      (!filters.layer || event.layer === filters.layer) &&
      (!filters.protocol || event.protocol === filters.protocol) &&
      (!filters.text || event.text.toLowerCase().includes(filters.text.toLowerCase())),
  );
  return (
    <div className="run-log">
      <div className="field-grid">
        {(["device", "packet", "layer", "protocol"] as const).map((key) => (
          <label key={key}>
            {key}
            <select aria-label={`Filter ${key}`} value={filters[key]} onChange={(event) => setFilters({ ...filters, [key]: event.target.value })}>
              <option value="">all</option>
              {options[key].map((value) => (
                <option key={value} value={value}>
                  {key === "device" ? label(value) : value}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <input placeholder="Search events…" aria-label="Search events" value={filters.text} onChange={(event) => setFilters({ ...filters, text: event.target.value })} />
      <div className="inspector-actions">
        <button onClick={() => download("netmind-events.csv", "text/csv", toCsv(shown))}>Export CSV</button>
        <button onClick={() => download("netmind-events.json", "application/json", JSON.stringify(shown, null, 2))}>Export JSON</button>
        <span className="hint">
          {shown.length}/{run.events.length} events
        </span>
      </div>
      <ol className="event-log">
        {shown.map((event) => (
          <li key={event.seq} className={event.t <= clock + 1e-9 ? "is-past" : ""}>
            <time>t={event.t.toFixed(3)}ms</time> <b>#{event.packet}</b> [{event.layer}] {event.text}
          </li>
        ))}
      </ol>
    </div>
  );
}
