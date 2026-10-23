import { PlanReview } from "../features/recovery/PlanReview";

export function Recovery() { return <section className="page-card recovery"><p className="eyebrow">SAFE WORKFLOW · NO AUTO-EXECUTION</p><h1>Recovery center</h1><p>Review a bounded recovery proposal before an authorized human can approve it. Execution and rollback stay controller-side.</p><PlanReview /></section>; }
