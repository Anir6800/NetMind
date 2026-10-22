import type { TopologyNode } from "../../lib/api";

export function DeviceInspector({ device }: { device: TopologyNode | null }) {
  if (!device) return <aside className="device-inspector" aria-live="polite">Select a device to inspect its API-backed interfaces.</aside>;
  return <aside className="device-inspector" aria-live="polite"><p className="eyebrow">DEVICE INSPECTOR</p><h2>{device.id}</h2><p>{device.type}</p><ul>{device.interfaces.map((item) => <li key={item.id}><code>{item.id}</code> {item.address}</li>)}</ul></aside>;
}
