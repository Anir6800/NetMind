import { Link } from "react-router-dom";

export function IncidentActions({ incidentId }: { incidentId: number }) {
  return <section className="incident-actions" aria-label="Incident actions"><Link to={`/recovery?incident=${incidentId}`}>Review bounded recovery proposal</Link><p>Recovery requires evidence review and human approval. This action cannot execute a network change.</p></section>;
}
