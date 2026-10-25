import { memo } from "react";
import { REGISTRY, materialPaths, type IconName, type IconSpec } from "./registry";

export type IconSize = 16 | 20 | 24 | 32 | 48;

// FILL 1 for active/selected/up, FILL 0 for idle; weight 300 from 32 px up.
export const Icon = memo(function Icon({
  name,
  size = 20,
  filled = false,
  label,
  className = "",
}: {
  name: IconName;
  size?: IconSize;
  filled?: boolean;
  label?: string;
  className?: string;
}) {
  const spec: IconSpec = REGISTRY[name];
  const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": true as const };
  if ("material" in spec)
    return (
      <svg className={`nm-icon ${className}`} width={size} height={size} viewBox="0 -960 960 960" fill="currentColor" data-icon={name} {...a11y}>
        {label && <title>{label}</title>}
        <path d={materialPaths(spec.material, size >= 32 ? 300 : 400, filled)} />
      </svg>
    );
  return (
    <svg
      className={`nm-icon nm-icon--custom ${filled ? "is-filled" : ""} ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={size >= 32 ? 1.6 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      data-icon={name}
      {...a11y}
    >
      {label && <title>{label}</title>}
      {spec.custom.map((d) => (
        <path key={d} d={d} />
      ))}
      {spec.badge && (
        <svg x={13} y={-1} width={12} height={12} viewBox="0 -960 960 960" stroke="none" fill="currentColor" className="nm-icon-badge">
          <path d={materialPaths(spec.badge, 400, true)} />
        </svg>
      )}
    </svg>
  );
});
