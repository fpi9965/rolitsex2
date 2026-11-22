import { useEffect, useState } from "react";

export function useServerTime(serverTime: number, intervalMs: number, enabled = true) {
  const [sample, setSample] = useState({ serverTime, elapsed: 0 });

  useEffect(() => {
    if (!enabled) return;
    const startedAt = performance.now();
    const timer = window.setInterval(() => {
      setSample({ serverTime, elapsed: performance.now() - startedAt });
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [enabled, intervalMs, serverTime]);

  return serverTime + (enabled && sample.serverTime === serverTime ? sample.elapsed : 0);
}
