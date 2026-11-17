'use client';

import { type KeyboardEvent, useEffect, useRef, useState } from 'react';

import type { LogLine } from './scenario';

interface Props {
  lines: LogLine[];
  onCommand: (raw: string) => void;
  busy: boolean;
  prompt?: string;
}

/** Terminal: faqat ko'rsatadi va buyruqni yuqoriga uzatadi (mantiq scenario.ts da) */
export function CyberTerminal({ lines, onCommand, busy, prompt = 'operator@kali:~$' }: Props) {
  const [value, setValue] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [cursor, setCursor] = useState(-1);
  const logRef = useRef<HTMLDivElement>(null);

  // Faqat terminal ichini aylantiramiz — sahifa sakramasin
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  function submit() {
    const raw = value.trim();
    setValue('');
    setCursor(-1);
    if (!raw) return;
    setHistory((h) => [...h, raw]);
    onCommand(raw);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    } else if (e.key === 'ArrowUp' && history.length) {
      e.preventDefault();
      const next = Math.min(cursor + 1, history.length - 1);
      setCursor(next);
      setValue(history[history.length - 1 - next]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = cursor - 1;
      setCursor(Math.max(next, -1));
      setValue(next >= 0 ? history[history.length - 1 - next] : '');
    }
  }

  return (
    <div className="lab3d-term">
      <div ref={logRef} className="lab3d-term-log" role="log" aria-live="polite" aria-label="Terminal chiqishi">
        {lines.map((line) => (
          <div key={line.id} className={`is-${line.type}`}>
            {line.text}
          </div>
        ))}
        {busy && <div className="is-info lab3d-term-busy">…</div>}
      </div>
      <form
        className="lab3d-term-input"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label htmlFor="lab3d-cmd">{prompt}</label>
        <input
          id="lab3d-cmd"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="help, scan, waf bypass, exploit…"
          autoComplete="off"
          spellCheck={false}
        />
        <button type="submit" className="lab3d-icon" aria-label="Buyruqni bajarish">
          <i className="fas fa-arrow-turn-down fa-rotate-90" aria-hidden="true"></i>
        </button>
      </form>
    </div>
  );
}
