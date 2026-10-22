import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { Copilot } from "../pages/Copilot";
import { IncidentDetail } from "../pages/IncidentDetail";
import { Incidents } from "../pages/Incidents";
import { Lab } from "../pages/Lab";
import { Monitoring } from "../pages/Monitoring";
import { Overview } from "../pages/Overview";
import { Recovery } from "../pages/Recovery";
import { Topology } from "../pages/Topology";

export const router = createBrowserRouter([{ element: <AppShell />, children: [
  { path: "/", element: <Overview /> }, { path: "/topology", element: <Topology /> }, { path: "/monitoring", element: <Monitoring /> }, { path: "/incidents", element: <Incidents /> }, { path: "/incidents/:incidentId", element: <IncidentDetail /> }, { path: "/copilot", element: <Copilot /> }, { path: "/recovery", element: <Recovery /> }, { path: "/lab", element: <Lab /> },
] }]);
