'use client';

import { useEffect, useRef, useState } from 'react';
import { scadaAudio } from './ScadaAudio';
import type { ScadaLogLine, ScadaScenarioId } from './scada-types';

interface Props {
  lines: ScadaLogLine[];
  onCommand: (cmd: string) => void;
  busy: boolean;
  prompt: string;
  scenario: ScadaScenarioId;
}

export function ScadaTerminal({ lines, onCommand, busy, prompt, scenario }: Props) {
  const [val, setVal] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [lines]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = val.trim();
    if (!text || busy) return;
    scadaAudio.click();
    setHistory((prev) => [...prev, text]);
    setHistIdx(-1);
    setVal('');
    onCommand(text);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!history.length) return;
      const nextIdx = histIdx === -1 ? history.length - 1 : Math.max(0, histIdx - 1);
      setHistIdx(nextIdx);
      setVal(history[nextIdx] ?? '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (histIdx === -1) return;
      const nextIdx = histIdx + 1;
      if (nextIdx >= history.length) {
        setHistIdx(-1);
        setVal('');
      } else {
        setHistIdx(nextIdx);
        setVal(history[nextIdx] ?? '');
      }
    }
  }

  // Sanoat tezkor buyruqlar tugmalari
  const quickActions: { label: string; cmd: string; icon: string; tone: string }[] = [
    { label: 'Relelar (Coils)', cmd: 'read-coils 1 4', icon: 'fa-list-check', tone: 'info' },
    { label: 'Registrlar', cmd: 'read-holding 40001 5', icon: 'fa-microchip', tone: 'info' },
    { label: 'DPI Sniffer', cmd: 'sniff', icon: 'fa-satellite-dish', tone: 'warn' },
    { label: 'Replay (MITM)', cmd: 'replay on', icon: 'fa-snowflake', tone: 'danger' },
    { label: 'SIS Bypass', cmd: 'bypass-sis', icon: 'fa-shield-halved', tone: 'danger' },
    { label: 'Telemetriya', cmd: 'status', icon: 'fa-chart-line', tone: 'info' },
    { label: 'Xavfsiz Tiklash', cmd: 'restore', icon: 'fa-rotate-left', tone: 'success' },
  ];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '360px',
        background: '#04070a',
        border: '1px solid var(--line)',
        borderRadius: '8px',
        fontFamily: 'var(--font-mono)',
        fontSize: '12.5px',
        overflow: 'hidden',
      }}
    >
      {/* Tezkor sanoat buyruqlari chizig'i */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 10px',
          background: 'rgba(7, 12, 17, 0.95)',
          borderBottom: '1px solid var(--line)',
          overflowX: 'auto',
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ fontSize: '11px', color: 'var(--muted)', marginRight: '4px' }}>
          <i className="fas fa-bolt" style={{ color: 'var(--cyan)' }}></i> Tezkor CLI:
        </span>
        {quickActions.map((qa) => (
          <button
            key={qa.cmd}
            type="button"
            disabled={busy}
            onClick={() => {
              scadaAudio.click();
              onCommand(qa.cmd);
            }}
            style={{
              padding: '3px 8px',
              borderRadius: '4px',
              border: '1px solid var(--line-soft)',
              background: 'rgba(255,255,255,0.04)',
              color: 'var(--text)',
              fontSize: '11px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
            }}
          >
            <i className={`fas ${qa.icon}`} style={{ fontSize: '10px', color: 'var(--cyan)' }}></i>
            {qa.label}
          </button>
        ))}
      </div>

      {/* Terminal log maydoni */}
      <div
        ref={logRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 14px',
          lineHeight: '1.6',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {lines.map((l) => {
          let col = 'var(--text-dim)';
          if (l.type === 'cmd') col = '#ffffff';
          else if (l.type === 'success') col = '#34d399';
          else if (l.type === 'warn') col = '#fbbf24';
          else if (l.type === 'danger') col = '#ef4444';

          return (
            <div key={l.id} style={{ color: col, marginTop: l.type === 'cmd' ? '6px' : '1px' }}>
              {l.text}
            </div>
          );
        })}
        {busy && <span style={{ color: 'var(--cyan)' }}>...</span>}
      </div>

      {/* Terminal input formasi */}
      <form
        onSubmit={submit}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          borderTop: '1px solid var(--line)',
          background: '#09121a',
        }}
      >
        <span style={{ color: '#34d399', whiteSpace: 'nowrap', fontWeight: 600 }}>{prompt}</span>
        <input
          ref={inputRef}
          type="text"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={busy}
          placeholder="help, read-coils, write-coil 2 1, replay on, bypass-sis..."
          style={{
            flex: 1,
            background: 'transparent',
            border: 0,
            outline: 'none',
            color: '#fff',
            font: 'inherit',
          }}
        />
        <button
          type="submit"
          disabled={busy || !val.trim()}
          style={{
            padding: '3px 10px',
            borderRadius: '4px',
            border: '1px solid var(--line-strong)',
            background: 'rgba(56, 189, 248, 0.15)',
            color: 'var(--cyan)',
            cursor: 'pointer',
            fontSize: '11px',
          }}
        >
          Yuborish
        </button>
      </form>
    </div>
  );
}
