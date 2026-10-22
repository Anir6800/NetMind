type Status = "healthy" | "warning" | "critical" | "neutral";

export function StatusPill({ status = "neutral", children }: { status?: Status; children: string }) {
  return <span className={`status-pill status-pill--${status}`}><span aria-hidden="true" className="status-pill__dot" />{children}</span>;
}
