import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getIncident } from "../lib/api";

export function IncidentDetail() {
  const { incidentId = "" } = useParams();
  const incident = useQuery({ queryKey: ["incident", incidentId], queryFn: () => getIncident(incidentId), enabled: Boolean(incidentId) });
  if (incident.isLoading) return <section className="page-card"><p aria-live="polite">Loading incident…</p></section>;
  if (incident.isError || !incident.data) return <section className="page-card"><p role="alert">{incident.error?.message ?? "Select an incident to view its evidence."}</p></section>;
  const item = incident.data;
  return <section className="page-card incident-detail"><p className="eyebrow">LIVE API · INCIDENT #{item.id}</p><h1>{item.title}</h1><p>Network {item.network_id} · <span className={`severity severity-${item.severity}`}>{item.severity}</span> · {item.state}</p><section><h2>Evidence</h2><pre>{item.evidence ? JSON.stringify(item.evidence, null, 2) : "No evidence is available from the incident API."}</pre></section><section><h2>Timeline</h2>{item.timeline?.length ? <ol>{item.timeline.map((event, index) => <li key={`${event.event_type}-${index}`}><strong>{event.event_type ?? "Event"}</strong>{event.created_at && ` · ${event.created_at}`}<pre>{event.payload === undefined ? null : JSON.stringify(event.payload, null, 2)}</pre></li>)}</ol> : <p>No timeline is available from the incident API.</p>}</section><section><h2>Diagnosis</h2><p>{item.diagnosis?.summary ?? "No diagnosis is available from the incident API."}</p>{item.diagnosis?.probable_cause && <p>Probable cause: {item.diagnosis.probable_cause}</p>}</section></section>;
}
