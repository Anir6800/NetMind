import { signOut } from "firebase/auth";
import { Link, NavLink, Outlet, useMatch, useNavigate, useSearchParams } from "react-router-dom";
import { ThemeToggle } from "../ui/ThemeToggle";
import { SystemDot } from "../ui/SystemDot";
import { KeyboardEvent, useCallback, useLayoutEffect, useRef, useState } from "react";
import { Icon } from "../icons/Icon";
import type { IconName } from "../icons/registry";
import { Tour } from "./Tour";
import { auth } from "../../lib/firebase";

const panels: [string, string, IconName][] = [
  ["canvas", "Canvas", "canvas"],
  ["simulate", "Simulate", "simulate"],
  ["tables", "Tables", "tables"],
  ["logs", "Logs", "logs"],
  ["ai", "AI", "ai"],
];

// Left/Right/Home/End move focus along the pill; Enter or Space activates.
function rove(event: KeyboardEvent<HTMLElement>) {
  const items = [...event.currentTarget.querySelectorAll<HTMLElement>("a.pill-item, button")];
  const index = items.indexOf(document.activeElement as HTMLElement);
  const next = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: items.length - 1 }[event.key];
  if (next === undefined || index < 0) return;
  event.preventDefault();
  items[(next + items.length) % items.length].focus();
}

function lastNetwork() {
  try {
    return localStorage.getItem("netmind-last-network");
  } catch {
    return null;
  }
}

// Switching drawers keeps the rest of the query (lesson, planner notes).
function withPanel(current: URLSearchParams | null, panel: string) {
  const next = new URLSearchParams(current ?? undefined);
  next.set("panel", panel);
  return next.toString();
}

export function AppShell() {
  const navigate = useNavigate();
  const inSimulator = useMatch("/simulator/:networkId");
  const [params] = useSearchParams();
  const networkId = inSimulator?.params.networkId ?? lastNetwork();
  const [replay, setReplay] = useState(0);
  const pill = useRef<HTMLElement>(null);
  const [highlight, setHighlight] = useState<React.CSSProperties>({ opacity: 0 });
  const replayed = useCallback(() => setReplay(0), []);
  const active = inSimulator ? (params.get("panel") ?? "simulate") : "";
  // Sliding highlight behind the active pill item.
  useLayoutEffect(() => {
    const target = pill.current?.querySelector<HTMLElement>(".pill-item.active");
    setHighlight(target ? { opacity: 1, width: target.offsetWidth, transform: `translateX(${target.offsetLeft}px)` } : { opacity: 0 });
  }, [active, inSimulator, networkId]);

  return (
    <div className={`app-shell${inSimulator ? " app-shell--studio" : ""}`}>
      <a className="skip-link" href="#content">
        Skip to content
      </a>
      <main id="content" className="page-content">
        <Outlet />
      </main>
      <Tour replay={replay} onReplayed={replayed} />
      <nav className="bottom-pill" aria-label="Main navigation" ref={pill} onKeyDown={rove}>
        <span className="pill-highlight" style={highlight} aria-hidden="true" />
        <SystemDot />
        <NavLink to="/" end className="pill-item" title="All networks, templates and lessons">
          {({ isActive }) => (
            <>
              <Icon name="networks" size={20} filled={isActive} /> Networks
            </>
          )}
        </NavLink>
        {panels.map(([panel, label, icon]) =>
          networkId ? (
            <Link
              key={panel}
              to={`/simulator/${networkId}?${withPanel(inSimulator ? params : null, panel)}`}
              className={`pill-item${active === panel ? " active" : ""}`}
              aria-current={active === panel ? "page" : undefined}
              title={`${label} drawer`}
            >
              <Icon name={icon} size={20} filled={active === panel} /> {label}
            </Link>
          ) : (
            <span key={panel} className="pill-item is-disabled" aria-disabled="true" title="Open a network first">
              <Icon name={icon} size={20} /> {label}
            </span>
          ),
        )}
        <span className="pill-divider" aria-hidden="true" />
        <button className="icon-button tour-button" onClick={() => setReplay(Date.now())} aria-label="Show the tutorial" title="Tutorial">
          <Icon name="help" size={20} />
        </button>
        <ThemeToggle />
        <button
          className="pill-item pill-signout"
          title="Sign out"
          onClick={async () => {
            await signOut(auth);
            navigate("/login");
          }}
        >
          <Icon name="logout" size={20} /> Sign out
        </button>
      </nav>
    </div>
  );
}
