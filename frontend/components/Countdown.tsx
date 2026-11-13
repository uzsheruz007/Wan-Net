'use client';

import { useEffect, useRef, useState } from 'react';

function formatLeft(ms: number) {
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return (d > 0 ? `${d}d ` : '') + [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

/** Teskari sanoq. Server vaqti emas, brauzer soati bo'yicha (asl shablondagi kabi). */
export function Countdown({ target, empty, onDone }: { target: number | null; empty: string; onDone?: () => void }) {
  const [now, setNow] = useState<number | null>(null);
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  });

  useEffect(() => {
    if (target === null) return;
    let finish: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      const current = Date.now();
      setNow(current);
      if (current >= target) {
        clearInterval(timer);
        // Vaqt tugadi: 2 soniyadan keyin sahifa serverdan qayta olinadi
        finish = setTimeout(() => doneRef.current?.(), 2000);
      }
    };
    const timer = setInterval(tick, 1000);
    tick();
    return () => {
      clearInterval(timer);
      clearTimeout(finish);
    };
  }, [target]);

  const left = target !== null && now !== null ? target - now : null;
  const done = left !== null && left <= 0;

  if (left === null) return <>{empty}</>;
  return <>{done ? '00:00:00' : formatLeft(left)}</>;
}
