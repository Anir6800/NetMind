import { useEffect, useRef, useState } from "react";

export type NetworkEvent = { id: number; type: string; payload: unknown; created_at: string };
type EventState = { events: NetworkEvent[]; connected: boolean; fallback: boolean };

export function useNetworkEvents(path = "/events", pollLimit = 12): EventState {
  const [state, setState] = useState<EventState>({ events: [], connected: false, fallback: false });
  const lastId = useRef(0);
  const pollCount = useRef(0);
  useEffect(() => {
    let source: EventSource | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const add = (event: NetworkEvent) => { if (event.id <= lastId.current) return; lastId.current = event.id; setState((current) => ({ ...current, events: [...current.events, event].slice(-100) })); };
    const poll = async () => {
      if (stopped || pollCount.current >= pollLimit) return;
      pollCount.current += 1;
      try { const response = await fetch(`/events/poll?last_event_id=${lastId.current}`); if (!response.ok) throw new Error(); for (const event of await response.json() as NetworkEvent[]) add(event); setState((current) => ({ ...current, fallback: true })); } catch { setState((current) => ({ ...current, connected: false, fallback: true })); }
      timer = setTimeout(poll, 5000);
    };
    source = new EventSource(`${path}?last_event_id=${lastId.current}`);
    source.onopen = () => { pollCount.current = 0; setState((current) => ({ ...current, connected: true, fallback: false })); };
    source.onmessage = (message) => add(JSON.parse(message.data) as NetworkEvent);
    source.onerror = () => { source?.close(); setState((current) => ({ ...current, connected: false })); poll(); };
    return () => { stopped = true; source?.close(); if (timer) clearTimeout(timer); };
  }, [path, pollLimit]);
  return state;
}
