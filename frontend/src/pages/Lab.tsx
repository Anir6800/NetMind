import { useState } from "react";

const scenarios = [
  ["link_down", "Link down"],
  ["high_latency", "High latency"],
  ["packet_loss", "Packet loss"],
  ["congestion", "Congestion"],
  ["node_down", "Node down"],
] as const;

export function Lab() {
  const [selected, setSelected] = useState<(typeof scenarios)[number][0]>("link_down");

  return <section className="page-card"><p className="eyebrow">SIMULATED · LOCAL CONTROLLER</p><h1>Simulation lab</h1><p>Deterministic demo scenarios create ground-truth labels for later detection and localisation scoring.</p><div className="scenario-list" aria-label="Available scenarios">{scenarios.map(([id, label]) => <button className={selected === id ? "scenario-button selected" : "scenario-button"} key={id} onClick={() => setSelected(id)} type="button">{label}</button>)}</div><p aria-live="polite">Selected: {selected}. No controller command has been sent from this browser.</p><p>Start and stop are available only through the token-authenticated local controller using the allowlisted demo topology.</p></section>;
}
