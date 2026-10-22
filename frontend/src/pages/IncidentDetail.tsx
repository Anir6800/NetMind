import { useParams } from "react-router-dom";

export function IncidentDetail() { const { incidentId } = useParams(); return <section className="page-card"><p className="eyebrow">SAMPLE · INCIDENT DETAIL</p><h1>Incident detail</h1><p>{incidentId ? `Placeholder for incident ${incidentId}.` : "Select an incident to view its evidence."}</p></section>; }
