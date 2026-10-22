import { useQuery } from "@tanstack/react-query";
import { createBrowserRouter } from "react-router-dom";
import { getHealth } from "../lib/api";
import { AppShell } from "../components/layout/AppShell";

function Overview() {
  const health = useQuery({ queryKey: ["health"], queryFn: getHealth });
  return <main><h1>NetMind</h1><p>Network simulation overview</p><p data-testid="health">{health.isLoading ? "Checking backend…" : health.isError ? "Backend unavailable" : `Backend: ${health.data?.status ?? "Unknown"}`}</p></main>;
}

export const router = createBrowserRouter([{ element: <AppShell />, children: [{ path: "/", element: <Overview /> }] }]);
