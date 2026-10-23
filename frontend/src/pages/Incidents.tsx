import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getIncidents } from "../lib/api";
import { useNetworkEvents } from "../hooks/useNetworkEvents";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

export function Incidents() {
  const incidents = useQuery({ queryKey: ["incidents"], queryFn: getIncidents });
  const queryClient = useQueryClient();
  const stream = useNetworkEvents();
  useEffect(() => { if (stream.events.length) queryClient.invalidateQueries({ queryKey: ["incidents"] }); }, [queryClient, stream.events.length]);
  return <section className="page-card"><p className="eyebrow">LIVE API · INCIDENTS · {stream.connected ? "STREAMING" : stream.fallback ? "POLLING FALLBACK" : "RECONNECTING"}</p><h1>Incident center</h1>{incidents.isLoading && <p aria-live="polite">Loading incidents…</p>}{incidents.isError && <p role="alert">{incidents.error.message}</p>}{incidents.data?.length === 0 && <p>No incidents found.</p>}{incidents.data && incidents.data.length > 0 && <div className="incident-list">{incidents.data.map((incident) => <Link className="incident-row" to={`/incidents/${incident.id}`} key={incident.id}><span><strong>{incident.title}</strong><small>Network {incident.network_id} · Incident #{incident.id}</small></span><span><b className={`severity severity-${incident.severity}`}>{incident.severity}</b><small>{incident.state}</small></span></Link>)}</div>}</section>;
}
