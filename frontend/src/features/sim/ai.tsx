import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { explainChange, getAiStatus, suggestChanges, type Answered, type Explanation, type SuggestionList, type Topology } from "../../lib/api";
import { converge } from "../../sim/convergence";
import type { Suggestion } from "../../sim/edit";
import type { FlowResult, Impact, Protocol } from "../../sim/engine";

const round = (value: number) => Number(value.toFixed(3));

function pathFacts(result: FlowResult, label: (id: string) => string) {
  return {
    reachable: result.reachable,
    reason: result.reachable ? "" : result.forward.reason,
    path: result.forward.l3Hops.map(label),
    one_way_ms: round(result.metrics.total),
    rtt_ms: round(result.rttMs),
    ttl: result.forward.ttlAtDest,
    loss_pct: round(result.metrics.loss),
    throughput_mbps: round(result.metrics.throughputMbps),
    bottleneck: result.metrics.bottleneckLink,
  };
}

export function describeSuggestion(item: Suggestion, label: (id: string) => string) {
  if (item.action === "add_link") return `Add a ${item.capacity_mbps ?? 100} Mbps link between ${label(item.a ?? "?")} and ${label(item.b ?? "?")}`;
  if (item.action === "set_ospf_cost") return `Set OSPF cost of ${item.link} to ${item.cost}`;
  if (item.action === "restore") return `Restore ${label(item.target ?? "?")}`;
  return `Switch routing to ${item.protocol?.toUpperCase()}`;
}

function Source({ answer }: { answer: Answered }) {
  return (
    <div className={`answer-source answer-source--${answer.source === "NVIDIA" ? "live" : "local"}`}>
      <strong>Answered by: {answer.answered_by}</strong>
      {answer.notes.map((note) => (
        <small key={note}>{note}</small>
      ))}
    </div>
  );
}

export function AiPanel({
  topology,
  protocol,
  flow,
  impact,
  change,
  reachableNow,
  label,
  onPreview,
}: {
  topology: Topology;
  protocol: Protocol;
  flow?: { src: string; dst: string };
  impact: { title: string; impact: Impact } | null;
  change: { title: string; before: Topology; after: Topology; target?: string } | null;
  reachableNow: boolean;
  label: (id: string) => string;
  onPreview: (item: Suggestion) => void;
}) {
  const status = useQuery({ queryKey: ["ai-status"], queryFn: getAiStatus, refetchInterval: 30_000 });
  const [question, setQuestion] = useState("");
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestionList | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function explain() {
    if (!impact || !flow) return;
    setBusy("explain");
    setError("");
    try {
      const timeline = change ? converge(change.before, change.after, { protocol, flow }) : null;
      setExplanation(
        await explainChange({
          title: impact.title,
          protocol,
          source: label(flow.src),
          destination: label(flow.dst),
          before: pathFacts(impact.impact.before, label),
          after: pathFacts(impact.impact.after, label),
          reachable_before: impact.impact.reachableBefore,
          reachable_after: impact.impact.reachableAfter,
          lost: impact.impact.reachability.filter((item) => !item.after).map((item) => label(item.node)),
          layers: impact.impact.layers,
          route_changes: impact.impact.routeChanges.length,
          convergence: timeline && {
            detection_ms: timeline.detectionMs === null ? null : round(timeline.detectionMs),
            converged_ms: timeline.convergedMs === null ? null : round(timeline.convergedMs),
            outage_ms: timeline.outageMs === null ? null : round(timeline.outageMs),
            packets_lost: timeline.packetsLost,
          },
          events: (timeline?.steps ?? []).slice(0, 30).map((step) => `t=${round(step.t)} ms ${step.text}`.slice(0, 300)),
          question,
        }),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Explanation failed");
    } finally {
      setBusy("");
    }
  }

  async function suggest() {
    if (!flow) return;
    setBusy("suggest");
    setError("");
    try {
      setSuggestions(
        await suggestChanges({
          topology,
          protocol,
          fault_target: change?.target ?? null,
          source: flow.src,
          destination: flow.dst,
          reachable_after: reachableNow,
          articulation_points: [],
          bridges: [],
        }),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Suggestions failed");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="ai-panel">
      <p className="eyebrow">AI LAB ASSISTANT</p>
      <div className={`ai-status ai-status--${status.data?.mode === "LIVE" ? "live" : "local"}`} role="status">
        {status.data ? (
          <>
            <strong>{status.data.mode === "LIVE" ? "LIVE AI available" : "AI not available"}</strong>
            <span>
              Next answer from: {status.data.answered_by}
              {status.data.mode !== "LIVE" && ` (${status.data.reason})`}
            </span>
          </>
        ) : (
          "Checking AI mode…"
        )}
      </div>
      <section>
        <h3>Explain</h3>
        <p className="hint">Explains the change shown in the before/after panel using only the simulator's numbers and timeline.</p>
        <textarea placeholder="Optional question, e.g. why did TTL drop by one?" value={question} maxLength={500} onChange={(event) => setQuestion(event.target.value)} />
        <button className="primary-button" disabled={!impact || !flow || busy !== ""} onClick={explain}>
          {busy === "explain" ? "Explaining…" : impact ? `Explain: ${impact.title}` : "Make a change first"}
        </button>
        {explanation && (
          <article className="ai-answer">
            <Source answer={explanation} />
            <p>
              <strong>Root cause.</strong> {explanation.root_cause}
            </p>
            {explanation.affected_layers.length > 0 && (
              <ul>
                {explanation.affected_layers.map((layer) => (
                  <li key={layer}>{layer}</li>
                ))}
              </ul>
            )}
            <p>{explanation.explanation}</p>
            {explanation.timing && (
              <p>
                <strong>Timing.</strong> {explanation.timing}
              </p>
            )}
          </article>
        )}
      </section>
      <section>
        <h3>Suggest</h3>
        <p className="hint">Proposes configuration changes. Each one opens a before/after preview; nothing changes until you confirm.</p>
        <button disabled={!flow || busy !== ""} onClick={suggest}>
          {busy === "suggest" ? "Thinking…" : "Suggest improvements"}
        </button>
        {suggestions && (
          <article className="ai-answer">
            <Source answer={suggestions} />
            {suggestions.suggestions.length ? (
              <ol className="suggestion-list">
                {suggestions.suggestions.map((item, index) => (
                  <li key={index}>
                    <strong>{describeSuggestion(item, label)}</strong>
                    <small>{item.reason}</small>
                    <button onClick={() => onPreview(item)}>Preview before/after</button>
                  </li>
                ))}
              </ol>
            ) : (
              <p>No change needed for this flow.</p>
            )}
          </article>
        )}
      </section>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </div>
  );
}
