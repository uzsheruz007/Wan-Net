const LEVELS = {
  easy: { label: 'OSON', bars: 1, color: 'var(--acc)' },
  medium: { label: "O'RTA", bars: 2, color: 'var(--warn)' },
  hard: { label: 'QIYIN', bars: 3, color: 'var(--danger)' },
} as const;

export type Level = keyof typeof LEVELS;

export const LEVEL_LABEL: Record<Level, string> = { easy: 'Oson', medium: "O'rta", hard: 'Qiyin' };

/** Qiyinlik: uchta chiziq va yorliq (rang yagona belgi emas — matn ham bor) */
export function Difficulty({ level }: { level: string }) {
  const item = LEVELS[level as Level];
  if (!item) return null;
  return (
    <span className="inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.18em]" style={{ color: item.color }}>
      <span className="flex gap-[3px]" aria-hidden="true">
        {[1, 2, 3].map((n) => (
          <i key={n} className="block w-3 h-1.5" style={{ background: n <= item.bars ? item.color : 'rgba(255,255,255,.1)' }}></i>
        ))}
      </span>
      {item.label}
    </span>
  );
}
