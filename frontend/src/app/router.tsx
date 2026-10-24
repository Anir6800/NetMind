import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { ProtectedRoute } from "../features/auth/ProtectedRoute";
import { Dashboard } from "../pages/Dashboard";
import { Login } from "../pages/Login";
import { Simulator } from "../pages/Simulator";

export const router = createBrowserRouter([
  { path: "/login", element: <Login /> },
  { element: <ProtectedRoute><AppShell /></ProtectedRoute>, children: [
    { path: "/", element: <Dashboard /> },
    { path: "/simulator/:networkId", element: <Simulator /> },
  ] },
]);
