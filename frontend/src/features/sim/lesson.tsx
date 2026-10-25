import { useMemo, useState } from "react";
import { Icon } from "../../components/icons/Icon";
import type { Topology } from "../../lib/api";
import type { Protocol } from "../../sim/engine";
import { LESSONS, lessonProgress, type LessonState } from "../../sim/lessons";
import type { Ladder } from "../../sim/protocols";
import { usePlayback } from "./playback";

export function LessonPanel(props: {
  lessonId: string;
  topology: Topology;
  protocol: Protocol;
  flows: { src: string; dst: string; app: string }[];
  panel: string;
  focus: { kind: "node" | "link"; id: string } | null;
  change: LessonState["change"];
  ladder: Ladder | null;
  onClose: () => void;
}) {
  const { run, selected } = usePlayback();
  const [open, setOpen] = useState(true);
  const lesson = LESSONS.find((item) => item.id === props.lessonId);
  const state: LessonState = useMemo(
    () => ({ topology: props.topology, protocol: props.protocol, flows: props.flows, panel: props.panel, focus: props.focus, run, selectedPacket: selected, change: props.change, ladder: props.ladder }),
    [props.topology, props.protocol, props.flows, props.panel, props.focus, run, selected, props.change, props.ladder],
  );
  if (!lesson) return null;
  const done = lessonProgress(lesson, state);
  return (
    <section className="lesson-card" aria-label="Guided lesson" aria-live="polite">
      <header>
        <div>
          <p className="eyebrow">
            LESSON · {Math.min(done, lesson.steps.length)}/{lesson.steps.length} STEPS
          </p>
          <h2>{lesson.title}</h2>
        </div>
        <button className="ghost-button" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? "–" : "+"}
        </button>
        <button className="ghost-button" onClick={props.onClose} aria-label="Leave lesson">
          <Icon name="close" size={20} />
        </button>
      </header>
      {open && (
        <ol className="lesson-steps">
          {lesson.steps.map((step, index) => (
            <li key={step.title} className={index < done ? "is-done" : index === done ? "is-current" : ""}>
              <strong>
                {index < done ? "✓ " : ""}
                {step.title}
              </strong>
              {index === done && <p>{step.instruction}</p>}
            </li>
          ))}
        </ol>
      )}
      {done >= lesson.steps.length && <p className="delta-better">Lesson complete — well done.</p>}
    </section>
  );
}
