// One registry: every icon the app uses, from self-hosted Material Symbols or an
// ORIGINAL stroke symbol (24 px grid, 2 px rounded strokes) where Material has no
// clear network-device match.
import { MATERIAL } from "./material.generated.ts";

export type IconSpec = { material: string } | { custom: string[]; badge?: string };

const CUSTOM: Record<string, string[]> = {
  // Box with two opposing arrows: frames forwarded port to port.
  switch: ["M3 7h18v10H3z", "M7 10.5h9m0 0-2-2m2 2-2 2", "M17 13.5H8m0 0 2-2m-2 2 2 2"],
  // Box with a row of ports and lines leaving every side: bits repeated everywhere.
  hub: ["M4 8h16v8H4z", "M8 12h.01M12 12h.01M16 12h.01", "M12 3v5M12 16v5M1 12h3M20 12h3"],
  // Signal in, regenerated square wave out.
  repeater: ["M2 12h4l2-5 3 10 2-5h2", "M16 9h3v6h3", "M16 9v6"],
  // Brick wall (the shield badge is drawn by the Icon component).
  firewall: ["M3 5h18v14H3z", "M3 9.7h18M3 14.3h18", "M9 5v4.7M15 5v4.7M6 9.7v4.6M12 9.7v4.6M18 9.7v4.6M9 14.3V19M15 14.3V19"],
};

export const REGISTRY = {
  // devices
  host: { material: "monitor" },
  server: { material: "dns" },
  router: { material: "router" },
  switch: { custom: CUSTOM.switch },
  hub: { custom: CUSTOM.hub },
  repeater: { custom: CUSTOM.repeater },
  firewall: { custom: CUSTOM.firewall, badge: "shield" },
  "access-point": { material: "wifi_tethering" },
  // links and states
  link: { material: "settings_ethernet" },
  cable: { material: "cable" },
  "link-down": { material: "link_off" },
  power: { material: "power_settings_new" },
  warning: { material: "warning" },
  critical: { material: "crisis_alert" },
  error: { material: "error" },
  ok: { material: "check_circle" },
  loading: { material: "hourglass_empty" },
  // navigation
  networks: { material: "grid_view" },
  canvas: { material: "grid_view" },
  simulate: { material: "play_arrow" },
  tables: { material: "table_chart" },
  logs: { material: "list_alt" },
  ai: { material: "wand_stars" },
  help: { material: "help" },
  "light-mode": { material: "light_mode" },
  "dark-mode": { material: "dark_mode" },
  logout: { material: "logout" },
  back: { material: "arrow_back" },
  // actions
  edit: { material: "edit" },
  delete: { material: "delete" },
  tune: { material: "tune" },
  route: { material: "route" },
  add: { material: "add_circle" },
  close: { material: "close" },
  undo: { material: "undo" },
  redo: { material: "redo" },
  save: { material: "save" },
  download: { material: "download" },
  upload: { material: "upload" },
  search: { material: "search" },
  view: { material: "visibility" },
  bolt: { material: "bolt" },
  // player
  clock: { material: "schedule" },
  speed: { material: "speed" },
  play: { material: "play_arrow" },
  pause: { material: "pause" },
  step: { material: "skip_next" },
  replay: { material: "replay" },
} satisfies Record<string, IconSpec>;

export type IconName = keyof typeof REGISTRY;
export const DEVICE_ICON: Record<string, IconName> = {
  host: "host", server: "server", router: "router", switch: "switch", hub: "hub", repeater: "repeater", firewall: "firewall", "access-point": "access-point",
};

// Path data for a Material icon at a weight, or undefined if not bundled.
export function materialPaths(name: string, weight: 300 | 400, filled: boolean) {
  const entry = MATERIAL[name]?.[weight] ?? MATERIAL[name]?.[400];
  return entry?.[filled ? 1 : 0];
}
