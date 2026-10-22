import { NavLink, Outlet } from "react-router-dom";
import { ThemeToggle } from "../ui/ThemeToggle";
import { StatusPill } from "../ui/StatusPill";

const links = [["/", "Overview"], ["/topology", "Topology"], ["/monitoring", "Monitoring"], ["/incidents", "Incidents"], ["/copilot", "Copilot"], ["/recovery", "Recovery"], ["/lab", "Lab"]] as const;

export function AppShell() {
  return <div className="app-shell"><a className="skip-link" href="#content">Skip to content</a><aside className="sidebar"><div className="brand">NETMIND <span>LOCAL</span></div><nav aria-label="Main navigation">{links.map(([to, label]) => <NavLink key={to} to={to} end={to === "/"}>{label}</NavLink>)}</nav><StatusPill status="warning">SIMULATED</StatusPill></aside><div className="shell-main"><header className="topbar"><span className="eyebrow">Operations workspace</span><ThemeToggle /></header><main id="content" className="page-content"><Outlet /></main></div></div>;
}
