import { FormEvent, useState } from "react";

import { askCopilot, CopilotAnswer } from "../lib/api";

export function Copilot() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<CopilotAnswer | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true); setError(""); setAnswer(null);
    try { setAnswer(await askCopilot(1, question)); } catch (reason) { setError(reason instanceof Error ? reason.message : "The copilot is unavailable."); } finally { setPending(false); }
  }

  return <section className="page-card copilot"><p className="eyebrow">READ-ONLY · INCIDENT 1</p><h1>AI copilot</h1><p>Answers are limited to immutable incident evidence. Command and network-change requests are refused.</p><form onSubmit={submit}><label htmlFor="copilot-question">Question</label><textarea id="copilot-question" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask about the incident evidence" required aria-describedby={error ? "copilot-error" : undefined} /><button type="submit" disabled={pending}>{pending ? "Checking evidence…" : "Ask copilot"}</button></form>{error && <p id="copilot-error" role="alert" className="copilot-error">{error}</p>}{answer && <section className="copilot-answer" aria-live="polite"><p className="eyebrow">{answer.cloud_api_called ? "CLOUD API · NVIDIA" : answer.source}</p><p>{answer.answer}</p><h2>Evidence citations</h2><ul>{answer.citation_ids.map((citation) => <li key={citation}>{citation}</li>)}</ul></section>}</section>;
}
