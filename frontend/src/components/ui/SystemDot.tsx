import { useQuery } from "@tanstack/react-query";

type Health = { status: string; database?: string; ai?: string };

// red: backend unreachable · yellow: backend up, database down · blue: AI not live · green: everything up
const STATES = {
  red: "Backend not reachable (frontend only)",
  yellow: "Backend up, database not connected",
  blue: "Backend and database up, AI not live (local rule-based planner)",
  green: "Frontend, backend, database and AI all up",
} as const;

export function SystemDot() {
  const health = useQuery({
    queryKey: ["health"],
    queryFn: async (): Promise<Health> => {
      const response = await fetch("/health");
      if (!response.ok) throw new Error("backend down");
      return response.json();
    },
    refetchInterval: 10_000,
    retry: false,
  });
  const color: keyof typeof STATES = health.isError || !health.data ? "red" : health.data.database !== "ok" ? "yellow" : health.data.ai !== "LIVE" ? "blue" : "green";
  return <span className={`system-dot system-dot--${color}`} role="status" aria-label={STATES[color]} title={STATES[color]} />;
}
