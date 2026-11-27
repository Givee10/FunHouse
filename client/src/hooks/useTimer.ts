import { useEffect, useState } from 'react';

export function useTimer(endsAt: number | null, serverTime: number | null) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!endsAt) { setLeft(0); return; }
    const offset = (serverTime ?? Date.now()) - Date.now();
    const adjEnds = endsAt - offset;
    const tick = () => {
      const ms = Math.max(0, adjEnds - Date.now());
      setLeft(Math.ceil(ms / 1000));
    };
    tick();
    const iv = setInterval(tick, 100);
    return () => clearInterval(iv);
  }, [endsAt, serverTime]);
  return left;
}