import { useSyncExternalStore } from "react";
import type { SimRun } from "../../sim/des";
import type { PlaybackDot } from "./canvas";

// Playback speed 1x = 10 ms of simulated network time per real second.
export const SIM_MS_PER_SECOND = 10;
export const SPEEDS = [0.1, 0.25, 0.5, 1, 2, 5, 10];

type State = { run: SimRun | null; clock: number; playing: boolean; speed: number; selected: number | null };
let state: State = { run: null, clock: 0, playing: false, speed: 0.25, selected: null };
const listeners = new Set<() => void>();
let frame = 0;
let last = 0;

function tick(now: number) {
  if (!state.playing || !state.run) return;
  const clock = Math.min(state.run.endTime, state.clock + ((now - last) / 1000) * SIM_MS_PER_SECOND * state.speed);
  last = now;
  set({ clock, playing: clock < state.run.endTime });
  if (state.playing) frame = requestAnimationFrame(tick);
}

export function set(patch: Partial<State>) {
  const wasPlaying = state.playing;
  state = { ...state, ...patch };
  if (state.playing && !wasPlaying) {
    last = performance.now();
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(tick);
  }
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const usePlayback = () => useSyncExternalStore(subscribe, () => state);

export function stepToNextEvent() {
  const next = state.run?.events.find((event) => event.t > state.clock + 1e-9);
  if (next) set({ clock: next.t, playing: false });
}

// Packets currently on one link, re-rendering only when they change.
const cache = new Map<string, { key: string; dots: PlaybackDot[] }>();
export function useLinkDots(linkId: string, a: string): PlaybackDot[] {
  return useSyncExternalStore(subscribe, () => {
    const dots: PlaybackDot[] = [];
    for (const transit of state.run?.transits ?? [])
      if (transit.link === linkId && state.clock >= transit.start && state.clock <= transit.end) {
        const progress = transit.end > transit.start ? (state.clock - transit.start) / (transit.end - transit.start) : 1;
        dots.push({ key: `${transit.packet}-${transit.start}`, fraction: transit.from === a ? progress : 1 - progress, tone: transit.tone, label: `#${transit.packet}` });
      }
    const key = dots.map((dot) => `${dot.key}:${dot.fraction.toFixed(3)}`).join("|");
    const cached = cache.get(linkId);
    if (cached?.key === key) return cached.dots;
    cache.set(linkId, { key, dots });
    return dots;
  });
}
