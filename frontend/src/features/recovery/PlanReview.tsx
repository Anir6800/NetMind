import { useState } from "react";

const action = "restore_link";

export function PlanReview() {
  const [reviewed, setReviewed] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [requested, setRequested] = useState(false);
  const ready = reviewed && confirmation === "RESTORE LINK";

  return <section className="plan-review" aria-labelledby="plan-review-title"><div className="plan-review__heading"><div><p className="eyebrow">PENDING HUMAN APPROVAL · PLAN HASH 4F2A…9C81</p><h2 id="plan-review-title">Restore demo link</h2></div><span className="severity severity-warning">LOW RISK</span></div><p>This proposal is bounded and expires in 60 seconds. It cannot execute from this screen.</p><dl className="plan-review__details"><div><dt>Exact action</dt><dd><code>{action}</code> <code>router-a-router-b → up</code></dd></div><div><dt>Evidence</dt><dd>Audit detection: link state is down; topology what-if preserves connectivity.</dd></div><div><dt>Expected effect</dt><dd>Restore host-to-host connectivity.</dd></div><div><dt>Rollback</dt><dd><code>set_link_state router-a-router-b → down</code> if verification fails.</dd></div></dl><section className="execution-state"><h3>Execution state</h3><ol><li>Awaiting approval</li><li>Controller executes bounded action</li><li>Connectivity verification</li><li>Confirmed or auto-rolled back</li></ol></section><form onSubmit={(event) => { event.preventDefault(); if (ready) setRequested(true); }}><label className="consent"><input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} /> I reviewed the evidence, risk, expected effect, and rollback.</label><label htmlFor="recovery-confirm">Type <strong>RESTORE LINK</strong> to request approval<input id="recovery-confirm" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" /></label><button type="submit" disabled={!ready || requested}>{requested ? "Approval request recorded" : "Request human approval"}</button></form>{requested && <p className="recovery-notice" role="status">Awaiting an authorized approver. No controller operation has been sent.</p>}</section>;
}
