import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { Dashboard } from "../pages/Dashboard";
import { Simulator } from "../pages/Simulator";

export const router = createBrowserRouter([
  { path: "/login", element: <Navigate to="/" replace /> },
  { element: <AppShell />, children: [
    { path: "/", element: <Dashboard /> },
    { path: "/simulator/:networkId", element: <Simulator /> },
  ] },
]);
