import { signOut } from "firebase/auth";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { ThemeToggle } from "../ui/ThemeToggle";
import { StatusPill } from "../ui/StatusPill";
import { auth } from "../../lib/firebase";

const links = [["/", "My networks"]] as const;

export function AppShell() {
  const navigate = useNavigate();
  return (
    <div className="app-shell">
      <a className="skip-link" href="#content">
        Skip to content
      </a>
      <header className="topbar">
        <div className="brand">
          NETMIND <span>LIVE LAB</span>
        </div>
        <span className="eyebrow">NETWORK DESIGN & SIMULATION STUDIO</span>
      </header>
      <main id="content" className="page-content">
        <Outlet />
      </main>
      <nav className="bottom-pill" aria-label="Main navigation">
        <div className="pill-brand">NM</div>
        {links.map(([to, label]) => (
          <NavLink key={to} to={to} end={to === "/"}>
            {label}
          </NavLink>
        ))}
        <StatusPill status="warning">SIMULATED</StatusPill>
        <ThemeToggle />
        <button
          className="pill-signout"
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
