import { useQuery } from "@tanstack/react-query";
import { getHealth } from "../lib/api";

export function Overview() { const health = useQuery({ queryKey: ["health"], queryFn: getHealth }); return <section className="page-card"><p className="eyebrow">SAMPLE · OPERATIONS OVERVIEW</p><h1>Operations overview</h1><p data-testid="health">{health.isLoading ? "Checking backend…" : health.isError ? "Backend unavailable" : `Backend: ${health.data?.status ?? "Unknown"}`}</p></section>; }
