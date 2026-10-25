import type { Ladder } from "../../sim/protocols";

const COLUMN = 170;
const ROW = 38;
const TOP = 46;
const time = (ms: number) => (ms < 1000 ? `${ms.toFixed(3)} ms` : `${(ms / 1000).toFixed(3)} s`);

// Sequence (ladder) diagram: one column per participant, one row per message.
export function LadderDiagram({ ladder, label, onClose }: { ladder: Ladder; label: (id: string) => string; onClose: () => void }) {
  const columns = new Map(ladder.participants.map((id, index) => [id, 70 + index * COLUMN]));
  const width = 300 + (ladder.participants.length - 1) * COLUMN; // room for local notes on the right
  const height = TOP + ladder.messages.length * ROW + 20;
  return (
    <section className="ladder-card" aria-label={`${ladder.kind.toUpperCase()} sequence diagram`}>
      <header>
        <div>
          <p className="eyebrow">SEQUENCE · {ladder.kind.toUpperCase()} · SIMULATED</p>
          <h2 className={ladder.ok ? "delta-better" : "delta-worse"}>{ladder.outcome}</h2>
        </div>
        <button className="ghost-button" onClick={onClose} aria-label="Close sequence diagram">
          ✕
        </button>
      </header>
      <div className="ladder-scroll">
        <svg width={width} height={height} role="img" aria-label="Message ladder">
          <defs>
            <marker id="ladder-head" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 0 10 5 0 10z" className="ladder-head" />
            </marker>
          </defs>
          {ladder.participants.map((id) => (
            <g key={id}>
              <text x={columns.get(id)} y={18} className="ladder-actor">
                {label(id)}
              </text>
              <line x1={columns.get(id)} x2={columns.get(id)} y1={28} y2={height - 6} className="ladder-life" />
            </g>
          ))}
          {ladder.messages.map((message, index) => {
            const y = TOP + index * ROW;
            const x1 = columns.get(message.from) ?? 70;
            const x2 = columns.get(message.to) ?? x1;
            const stamp = `t=${time(message.sendAt)}${message.arriveAt !== null && message.arriveAt !== message.sendAt ? ` → ${time(message.arriveAt)}` : ""}`;
            if (x1 === x2)
              return (
                <g key={index} className={message.lost ? "ladder-lost" : "ladder-local"}>
                  <title>{message.note ?? message.label}</title>
                  <rect x={x1 - 6} y={y - 12} width={12} height={16} rx={3} />
                  <text x={x1 + 12} y={y} className="ladder-label">
                    {message.label}
                  </text>
                  <text x={x1 + 12} y={y + 12} className="ladder-time">
                    {stamp}
                  </text>
                </g>
              );
            const end = message.lost ? x1 + (x2 - x1) * 0.55 : x2;
            return (
              <g key={index} className={message.lost ? "ladder-lost" : "ladder-ok"}>
                <title>{`${message.layer} · ${message.note ?? message.label}`}</title>
                <line x1={x1} y1={y} x2={end} y2={y + (message.lost ? 6 : 10)} markerEnd={message.lost ? undefined : "url(#ladder-head)"} />
                {message.lost && (
                  <text x={end} y={y + 11} className="ladder-x">
                    ✕
                  </text>
                )}
                <text x={(x1 + x2) / 2} y={y - 5} className="ladder-label" textAnchor="middle">
                  {message.label}
                  {message.lost ? " (lost)" : ""}
                </text>
                <text x={(x1 + x2) / 2} y={y + 22} className="ladder-time" textAnchor="middle">
                  {stamp}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <details>
        <summary>What is simplified</summary>
        <ul>
          {ladder.simplifications.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </details>
    </section>
  );
}
