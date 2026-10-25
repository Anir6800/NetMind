import { useEffect, useLayoutEffect, useState } from "react";
import { useMatch, useSearchParams } from "react-router-dom";

type Step = { target: string; title: string; text: string; panel?: string };

const DASHBOARD: Step[] = [
  { target: ".system-dot", title: "System status", text: "One dot tells you if everything works: green = all up, blue = AI not live (local planner answers), yellow = database down, red = backend not reachable. Hover it any time." },
  { target: ".manual-button", title: "Build your own network", text: "Starts an empty canvas. You drag routers, switches, PCs and more onto it yourself (up to 50 devices)." },
  { target: ".segmented[role=tablist]", title: "Or generate one", text: "Describe a network in plain English for the AI, or use the Detailed form (no AI). The server validates every network before it is saved." },
  { target: ".lesson-grid", title: "Guided labs", text: "Five short lessons that tick off each step as you do it — the best place to start." },
  { target: ".template-grid", title: "Prepared labs", text: "25 ready topologies, from a 6-device home to 50-device campuses. Click one to open it." },
  { target: ".saved-list, .saved-panel", title: "Your saved networks", text: "Open, duplicate, export as JSON or delete. Import a .json file from the Guided labs bar." },
  { target: ".bottom-pill", title: "Navigation pill", text: "Always at the bottom. Inside a network it opens Canvas, Simulate, Tables, Logs and AI. The ? button replays this tour." },
];

const STUDIO: Step[] = [
  { target: ".canvas-wrap", title: "The canvas", text: "Your network. Drag the background to pan, scroll to zoom, drag devices to move them. Moving dots show live traffic; red dashed links are down. Everything is SIMULATED." },
  { target: ".device-palette", panel: "canvas", title: "Create: add devices", text: "Click a device to add it, or DRAG it onto the canvas where you want it. You can also right-click empty canvas → Add device." },
  { target: ".react-flow__node", panel: "canvas", title: "Connect devices", text: "Hover a device and drag from its small right-hand handle to another device to draw a cable. Or select a device and use Connect to in this drawer." },
  { target: ".react-flow__edge", title: "Break things — see changes in real time", text: "RIGHT-CLICK a link or device → Set link down / Power down. A before-vs-after card appears instantly: path, delay, RTT, TTL, loss and who lost reachability (red = worse, green = better)." },
  { target: ".simulate-panel .field-grid", panel: "simulate", title: "Choose what to test", text: "Pick the routing protocol (Static, RIP, OSPF), the packet type and the source and destination devices. The live path and delay update immediately." },
  { target: ".simulate-panel fieldset", panel: "simulate", title: "Preview a fault safely", text: "Preview impact shows what WOULD happen without changing anything. Apply only if you want it." },
  { target: ".simulate-panel .primary-button", panel: "simulate", title: "Slow motion", text: "Send packets and watch them hop device by device. Use 0.1×–10×, Pause and Step. Click a packet to see each layer it passes through and its timing formulas." },
  { target: ".tables-panel", panel: "tables", title: "Tables and convergence", text: "Routing, ARP and MAC tables update live; changed rows are coloured. After a failure, the convergence timeline compares Static vs RIP vs OSPF, and traceroute shows each hop." },
  { target: ".logs-panel", panel: "logs", title: "Event log", text: "Every packet event with its time. Filter by device, packet, layer or protocol and export as CSV or JSON." },
  { target: ".ai-panel", panel: "ai", title: "AI assistant", text: "Explain a change using the simulator's own numbers, or get suggestions you can preview before applying. It always says whether real AI or the local planner answered." },
  { target: ".bar-actions", title: "Save, undo, export", text: "Undo/Redo (Ctrl+Z / Ctrl+Y), Export to JSON and Save to the database. Unsaved work is also kept as a draft in this browser." },
  { target: ".search-box", title: "Find a device", text: "Type a device name to zoom straight to it. Keyboard users: Tab to a device, Enter to select, Shift+F10 for its menu." },
];

const key = (name: string) => `netmind-tour-${name}-done`;
const done = (name: string) => {
  try {
    return localStorage.getItem(key(name)) === "1";
  } catch {
    return true;
  }
};

// Spotlight tour: highlights one real control at a time with Back / Next / Skip.
export function Tour({ replay, onReplayed }: { replay: number; onReplayed: () => void }) {
  const inStudio = Boolean(useMatch("/simulator/:networkId"));
  const name = inStudio ? "studio" : "dashboard";
  const steps = inStudio ? STUDIO : DASHBOARD;
  const [, setParams] = useSearchParams();
  const [index, setIndex] = useState<number | null>(null);
  const [box, setBox] = useState<DOMRect | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setIndex(done(name) ? null : 0), 900);
    return () => clearTimeout(timer);
  }, [name]);
  useEffect(() => {
    if (replay) {
      setIndex(0);
      onReplayed();
    }
  }, [replay, onReplayed]);

  const step = index === null ? null : steps[index];
  useEffect(() => {
    if (step?.panel)
      setParams((params) => {
        params.set("panel", step.panel!);
        return params;
      });
  }, [setParams, step]);
  useLayoutEffect(() => {
    if (!step) return;
    const measure = () => {
      const element = document.querySelector(step.target);
      element?.scrollIntoView({ block: "nearest" });
      setBox(element ? element.getBoundingClientRect() : null);
    };
    measure();
    const timer = window.setInterval(measure, 300);
    return () => clearInterval(timer);
  }, [step]);

  function finish() {
    try {
      localStorage.setItem(key(name), "1");
    } catch {
      /* ignore */
    }
    setIndex(null);
  }
  useEffect(() => {
    if (index === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") finish();
      if (event.key === "ArrowRight") setIndex((value) => (value === null ? null : Math.min(steps.length - 1, value + 1)));
      if (event.key === "ArrowLeft") setIndex((value) => (value === null ? null : Math.max(0, value - 1)));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!step || index === null) return null;
  const pad = 6;
  const below = !box || box.bottom + 230 < window.innerHeight;
  const cardTop = !box ? window.innerHeight / 2 - 110 : below ? box.bottom + 14 : Math.max(12, box.top - 230);
  const cardLeft = !box ? window.innerWidth / 2 - 190 : Math.min(Math.max(12, box.left), window.innerWidth - 392);
  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label={`Tutorial step ${index + 1} of ${steps.length}`}>
      {box ? (
        <div className="tour-spot" style={{ top: box.top - pad, left: box.left - pad, width: box.width + pad * 2, height: box.height + pad * 2 }} />
      ) : (
        <div className="tour-dim" />
      )}
      <section className="tour-card" style={{ top: cardTop, left: cardLeft }}>
        <p className="eyebrow">
          TUTORIAL · {index + 1}/{steps.length}
        </p>
        <h2>{step.title}</h2>
        <p>{step.text}</p>
        <div className="tour-actions">
          <button className="ghost-button" onClick={finish}>
            Skip tour
          </button>
          <span />
          <button className="ghost-button" disabled={index === 0} onClick={() => setIndex(index - 1)}>
            Back
          </button>
          {index < steps.length - 1 ? (
            <button className="primary-button" autoFocus onClick={() => setIndex(index + 1)}>
              Next
            </button>
          ) : (
            <button className="primary-button" autoFocus onClick={finish}>
              Finish
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
