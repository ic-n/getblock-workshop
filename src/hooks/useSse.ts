import { useEffect, useState } from 'react';
import type { StateSnapshot } from '../types';

const SSE_URL = 'http://localhost:3001/events';

export function useSse() {
  const [snapshot, setSnapshot] = useState<StateSnapshot | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const es = new EventSource(SSE_URL);

    es.onopen = () => setConnected(true);

    es.onmessage = (e: MessageEvent<string>) => {
      setSnapshot(JSON.parse(e.data) as StateSnapshot);
    };

    es.onerror = () => setConnected(false);

    return () => es.close();
  }, []);

  return { snapshot, connected };
}
