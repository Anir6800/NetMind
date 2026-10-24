import { signOut } from "firebase/auth";
import { Link, NavLink, Outlet, useMatch, useNavigate, useSearchParams } from "react-router-dom";
import { ThemeToggle } from "../ui/ThemeToggle";
import { auth } from "../../lib/firebase";

const panels = [
  ["canvas", "Canvas", "⬡"],
  ["simulate", "Simulate", "▶"],
  ["tables", "Tables", "☰"],
  ["logs", "Logs", "≡"],
  ["ai", "AI", "✦"],
] as const;

function lastNetwork() {
  try {
    return localStorage.getItem("netmind-last-network");
  } catch {
    return null;
  }
}

export function AppShell() {
  const navigate = useNavigate();
  const inSimulator = useMatch("/simulator/:networkId");
  const [params] = useSearchParams();
  const networkId = inSimulator?.params.networkId ?? lastNetwork();
  const active = inSimulator ? (params.get("panel") ?? "simulate") : "";
  return (
    <div className={`app-shell${inSimulator ? " app-shell--studio" : ""}`}>
      <a className="skip-link" href="#content">
        Skip to content
      </a>
      <main id="content" className="page-content">
        <Outlet />
      </main>
      <nav className="bottom-pill" aria-label="Main navigation">
        <NavLink to="/" end className="pill-item">
          <span aria-hidden="true">◫</span> Networks
        </NavLink>
        {panels.map(([panel, label, icon]) =>
          networkId ? (
            <Link
              key={panel}
              to={`/simulator/${networkId}?panel=${panel}`}
              className={`pill-item${active === panel ? " active" : ""}`}
              aria-current={active === panel ? "page" : undefined}
            >
              <span aria-hidden="true">{icon}</span> {label}
            </Link>
          ) : (
            <span key={panel} className="pill-item is-disabled" aria-disabled="true" title="Open a network first">
              <span aria-hidden="true">{icon}</span> {label}
            </span>
          ),
        )}
        <span className="pill-divider" aria-hidden="true" />
        <ThemeToggle />
        <button
          className="pill-item pill-signout"
          onClick={async () => {
            await signOut(auth);
            navigate("/login");
          }}
        >
          Sign out
        </button>
      </nav>
    </div>
  );
}
