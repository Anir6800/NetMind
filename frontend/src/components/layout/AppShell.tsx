import { signOut } from "firebase/auth";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { ThemeToggle } from "../ui/ThemeToggle";
import { StatusPill } from "../ui/StatusPill";
import { auth } from "../../lib/firebase";

const links = [["/", "My networks"]] as const;

export function AppShell() {
  const navigate = useNavigate();
  return <div className="app-shell"><a className="skip-link" href="#content">Skip to content</a><aside className="sidebar"><div className="brand">NETMIND <span>STUDENT LAB</span></div><nav aria-label="Main navigation">{links.map(([to, label]) => <NavLink key={to} to={to} end={to === "/"}>{label}</NavLink>)}</nav><div className="sidebar-spacer" /><StatusPill status="warning">SIMULATED</StatusPill><button className="sidebar-action" onClick={async () => { await signOut(auth); navigate("/login"); }}>Sign out</button></aside><div className="shell-main"><header className="topbar"><span className="eyebrow">NETWORK DESIGN & SIMULATION STUDIO</span><ThemeToggle /></header><main id="content" className="page-content"><Outlet /></main></div></div>;
}
