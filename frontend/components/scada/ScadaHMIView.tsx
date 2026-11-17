'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiForm } from '@/components/ApiForm';
import { A } from '@/components/ui';

import { scadaAudio } from './ScadaAudio';
import { ScadaCanvas } from './ScadaCanvas';
import { ScadaGauges } from './ScadaGauges';
import { ScadaTerminal } from './ScadaTerminal';
import { ScadaForensicModal } from './ScadaForensicModal';
import {
  type ScadaDifficultyId,
  type ScadaForensicReport,
  type ScadaLogLine,
  type ScadaScenarioId,
  type ScadaState,
  INITIAL_SCADA_STATE,
  SCADA_DIFFICULTY_LIST,
  SCADA_SCENARIO_LIST,
  executeScadaCommand,
  fetchScadaState,
  resetScadaState,
  switchScadaDifficulty,
  switchScadaMode,
  switchScadaScenario,
} from './scada-types';

interface Props {
  challengeId?: number;
}

let lineId = 0;
const withIds = (lines: { type: 'cmd' | 'info' | 'success' | 'warn' | 'danger'; text: string }[]): ScadaLogLine[] =>
  lines.map((l) => ({ ...l, id: ++lineId }));

const INITIAL_WELCOME: { type: 'cmd' | 'info' | 'success' | 'warn' | 'danger'; text: string }[] = [
  { type: 'info', text: 'Wan-Net SCADA / ICS Kiber-Fizik Poligoni · Modbus TCP & Sanoat Tizimlari faol' },
  { type: 'info', text: "🔴 Red Team: Sanoat klapanlari va parametrlarini o'zgartirib, tizimni falokat darajasiga yetkazing." },
  { type: 'info', text: "🔵 Blue Team: 'mode blue' buyrug'i orqali stansiya muhandisi roliga o'tib, avariyaning oldini oling." },
  { type: 'info', text: "Yordam va buyruqlar ro'yxati uchun 'help' deb yozing yoki yuqoridagi tezkor tugmalardan foydalaning." },
];

export function ScadaHMIView({ challengeId = 52 }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<ScadaState>(INITIAL_SCADA_STATE);
  const [lines, setLines] = useState<ScadaLogLine[]>(() => withIds(INITIAL_WELCOME));
  const [busy, setBusy] = useState(false);
  const [muted, setMuted] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<'terminal' | 'alarms' | 'registers' | 'guide'>('terminal');

  useEffect(() => {
    scadaAudio.setMuted(true);
    const onFs = () => setFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener('fullscreenchange', onFs);

    fetchScadaState().then((s) => {
      if (s) setState(s);
    });

    return () => {
      document.removeEventListener('fullscreenchange', onFs);
      scadaAudio.stopSiren();
    };
  }, []);

  // Real-time server sync & physics ticker
  useEffect(() => {
    const isFinished = state.is_disaster || (state.mode === 'red' ? !!state.red_flag : !!state.blue_flag);

    const interval = window.setInterval(() => {
      fetchScadaState().then((s) => {
        if (s) {
          setState(s);
          if (s.is_disaster && !muted) {
            scadaAudio.startSiren();
          } else {
            scadaAudio.stopSiren();
          }
        }
      });
    }, 2000);

    return () => window.clearInterval(interval);
  }, [state.is_disaster, state.mode, state.red_flag, state.blue_flag, muted]);

  const runCommand = useCallback(
    async (cmdStr: string) => {
      if (busy) return;
      setBusy(true);
      try {
        const res = await executeScadaCommand(cmdStr);
        if (res.state) {
          setState(res.state);
        }
        if (res.lines.length) {
          setLines((prev) => [...prev, ...withIds(res.lines)]);
        }
        setBusy(false);
      } catch {
        setBusy(false);
      }
    },
    [busy],
  );

  const handleCoilToggle = useCallback(
    async (coilId: number, currentVal: number) => {
      const nextVal = currentVal === 1 ? 0 : 1;
      scadaAudio.playBreakerClick();
      await runCommand(`write-coil ${coilId} ${nextVal}`);
    },
    [runCommand],
  );

  const handleSwitchScenario = useCallback(
    async (sc: ScadaScenarioId) => {
      if (busy) return;
      setBusy(true);
      scadaAudio.click();
      try {
        const s = await switchScadaScenario(sc);
        setState(s);
        setLines((prev) => [
          ...prev,
          ...withIds([
            { type: 'cmd', text: `scenario ${sc}` },
            { type: 'success', text: `[+] Sanoat ssenariysi yuklandi: ${sc.toUpperCase()}. Datchiklar va fizik model yangilandi.` },
          ]),
        ]);
        setBusy(false);
      } catch {
        setBusy(false);
      }
    },
    [busy],
  );

  const handleSwitchMode = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    scadaAudio.click();
    try {
      const nextMode = state.mode === 'red' ? 'blue' : 'red';
      const s = await switchScadaMode(nextMode);
      setState(s);
      setLines((prev) => [
        ...prev,
        ...withIds([
          { type: 'cmd', text: `mode ${nextMode}` },
          {
            type: 'success',
            text: `[+] Rejim almashtirildi: ${
              nextMode === 'blue' ? '🔵 Moviy jamoa (Stansiya Muhandisi)' : '🔴 Qizil jamoa (OT Tajovuzkor)'
            }`,
          },
        ]),
      ]);
      setBusy(false);
    } catch {
      setBusy(false);
    }
  }, [busy, state.mode]);

  const handleSwitchDifficulty = useCallback(
    async (diff: ScadaDifficultyId) => {
      if (busy || diff === state.difficulty) return;
      setBusy(true);
      scadaAudio.click();
      try {
        const s = await switchScadaDifficulty(diff);
        setState(s);
        const meta = SCADA_DIFFICULTY_LIST.find((d) => d.id === diff);
        setLines((prev) => [
          ...prev,
          ...withIds([
            { type: 'cmd', text: `difficulty ${diff}` },
            { type: diff === 'nightmare' ? 'danger' : 'info', text: `[*] Qiyinchilik: ${meta?.label}. ${meta?.desc ?? ''}` },
          ]),
        ]);
        setBusy(false);
      } catch {
        setBusy(false);
      }
    },
    [busy, state.difficulty],
  );

  const handleReset = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    scadaAudio.click();
    scadaAudio.stopSiren();
    try {
      const s = await resetScadaState(state.mode, state.scenario);
      setState(s);
      setLines((prev) => [
        ...prev,
        ...withIds([
          { type: 'cmd', text: 'reset' },
          { type: 'info', text: "[*] SCADA stansiyasi parametrlari boshlang'ich holatga qaytarildi." },
        ]),
      ]);
      setBusy(false);
    } catch {
      setBusy(false);
    }
  }, [busy, state.mode, state.scenario]);

  function toggleSound() {
    const next = !muted;
    setMuted(next);
    scadaAudio.setMuted(next);
    if (!next) {
      scadaAudio.startAmbient();
      if (state.is_disaster) scadaAudio.startSiren();
    } else {
      scadaAudio.stopSiren();
    }
  }

  async function toggleFullscreen() {
    const el = rootRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await el.requestFullscreen();
    } catch {
      setFullscreen((v) => !v);
    }
  }

  const activeFlag = state.mode === 'red' ? state.red_flag : state.blue_flag;

  function copyFlag() {
    if (!activeFlag) return;
    navigator.clipboard?.writeText(activeFlag).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    });
  }

  const activeScMeta = SCADA_SCENARIO_LIST.find((s) => s.id === state.scenario) || SCADA_SCENARIO_LIST[0];

  // Status Badge
  let statusLabel = 'NORMAL';
  let statusTone = 'ok';
  if (state.is_disaster) {
    statusLabel = 'FALOKAT (DISASTER)';
    statusTone = 'danger';
  } else if (state.is_tripped) {
    statusLabel = 'SIS TRIP';
    statusTone = 'warn';
  } else if (state.threat >= 60) {
    statusLabel = 'XAVF YUQORI';
    statusTone = 'danger';
  } else if (state.threat >= 30) {
    statusLabel = 'OGOHLANTIRISH';
    statusTone = 'warn';
  }

  const reportData: ScadaForensicReport = state.forensic_report || {
    scenario: state.scenario,
    scenario_title: activeScMeta.title,
    subsystem: activeScMeta.tag,
    protocol: 'Modbus TCP / DNP3',
    mode: state.mode,
    grade: state.is_disaster ? (state.mode === 'red' ? 'S' : 'F') : state.is_mitigated ? (state.mode === 'blue' ? 'S' : 'C') : 'B',
    verdict: state.is_disaster
      ? 'Kiber-fizik diversiya ro‘y berdi: Xavfsizlik chegaralari buzildi va ob’ekt falokatga uchradi.'
      : state.is_mitigated
      ? 'Sanoat avariyasi bartaraf etildi: Barcha fizik parametrlar xavfsiz holatga qaytarildi.'
      : 'Sanoat tizimi faol nazorat ostida.',
    threat_peak: state.threat,
    time_taken: `${Math.floor((state.total_time - state.time_remaining) / 60)}m ${(state.total_time - state.time_remaining) % 60}s`,
    alarms_count: state.alarms.length,
    physical_summary: state.physical,
    completed_at: new Date().toLocaleTimeString(),
  };

  return (
    <div
      ref={rootRef}
      className={`lab3d ${fullscreen ? 'is-fullscreen' : ''}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        background: '#04070a',
        color: 'var(--text)',
        minHeight: '100%',
        padding: '16px',
      }}
    >
      {/* 1. SCADA HMI TOP BAR */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          background: '#09121a',
          border: '1px solid var(--line)',
          borderRadius: '10px',
          padding: '10px 16px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        }}
      >
        {/* Sarlavha va status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="live-dot" style={{ background: state.is_disaster ? '#ef4444' : 'var(--acc)' }}></span>
              <span style={{ fontSize: '15px', fontWeight: 700, color: '#fff', letterSpacing: '0.04em' }}>
                SCADA HMI // {activeScMeta.title}
              </span>
              <span className={`chip ${statusTone === 'danger' ? 'chip-red' : statusTone === 'warn' ? 'chip-warn' : 'chip-cyan'}`}>
                {statusLabel}
              </span>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
              {activeScMeta.tag} · Vaqt: {Math.floor(state.time_remaining / 60)}:{String(state.time_remaining % 60).padStart(2, '0')}
            </span>
          </div>
        </div>

        {/* Ssenariy tanlagich */}
        <div style={{ display: 'inline-flex', alignItems: 'center', background: '#05090d', borderRadius: '6px', border: '1px solid var(--line)', padding: '2px', gap: '2px' }}>
          {SCADA_SCENARIO_LIST.map((sc) => (
            <button
              key={sc.id}
              type="button"
              className={`lab3d-action ${state.scenario === sc.id ? 'is-info' : ''}`}
              style={{
                padding: '4px 10px',
                fontSize: '11px',
                minHeight: '28px',
                border: 0,
                background: state.scenario === sc.id ? 'rgba(56,189,248,0.2)' : 'transparent',
                color: state.scenario === sc.id ? 'var(--heading)' : 'var(--muted)',
                cursor: 'pointer',
              }}
              onClick={() => handleSwitchScenario(sc.id)}
            >
              <i className={`fas ${sc.icon}`} style={{ marginRight: '5px' }}></i>
              {sc.id.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Qiyinchilik tanlagich */}
        <div className="scada-diff" role="group" aria-label="Qiyinchilik darajasi">
          {SCADA_DIFFICULTY_LIST.map((d) => (
            <button
              key={d.id}
              type="button"
              className={`is-${d.id}`}
              aria-pressed={state.difficulty === d.id}
              title={d.desc}
              onClick={() => handleSwitchDifficulty(d.id)}
              disabled={busy}
            >
              {d.id === 'nightmare' && <i className="fas fa-skull" style={{ marginRight: '5px', fontSize: '10px' }}></i>}
              {d.label}
            </button>
          ))}
        </div>

        {/* Asboblar paneli */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {state.ids_active && (
            <span className="chip chip-warn" style={{ fontSize: '10px', animation: 'pulse-dot 1.4s infinite' }} title="IDS avtomatik remediatsiya faol">
              <i className="fas fa-robot" style={{ marginRight: '4px' }}></i> IDS FAOL
            </span>
          )}
          <button
            type="button"
            className={`btn btn-sm ${state.mode === 'red' ? 'btn-danger' : 'btn-cyan'}`}
            onClick={handleSwitchMode}
            style={{ fontSize: '11px', padding: '4px 10px' }}
          >
            <i className={`fas ${state.mode === 'red' ? 'fa-user-secret' : 'fa-user-shield'} mr-1`}></i>
            {state.mode === 'red' ? 'QIZIL (HUJUM)' : 'MOVIY (HIMOYA)'}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={toggleSound}
            title={muted ? 'Ovozni yoqish' : "Ovozni o'chirish"}
            style={{ padding: '4px 8px' }}
          >
            <i className={`fas ${muted ? 'fa-volume-xmark' : 'fa-volume-high'}`}></i>
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={toggleFullscreen}
            style={{ padding: '4px 8px' }}
          >
            <i className={`fas ${fullscreen ? 'fa-compress' : 'fa-expand'}`}></i>
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              scadaAudio.click();
              setShowReport(true);
            }}
            style={{ fontSize: '11px', padding: '4px 8px' }}
          >
            <i className="fas fa-file-shield mr-1"></i> Hisobot
          </button>
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={handleReset}
            style={{ fontSize: '11px', padding: '4px 8px' }}
          >
            <i className="fas fa-rotate-right"></i>
          </button>
        </div>
      </div>

      {/* Flag Banner */}
      {activeFlag && (
        <div className="lab3d-flag" role="status" style={{ margin: 0 }}>
          <i className="fas fa-flag" aria-hidden="true"></i>
          <span>{state.mode === 'blue' ? 'Moviy jamoa SCADA bayrog‘i olindi' : 'Qizil jamoa SCADA bayrog‘i olindi'}</span>
          <code>{activeFlag}</code>
          <button type="button" className="lab3d-icon" onClick={copyFlag} aria-label="Flagdan nusxa olish">
            <i className={`fas ${copied ? 'fa-check' : 'fa-copy'}`} aria-hidden="true"></i>
          </button>
          <button
            type="button"
            className="lab3d-action is-info"
            onClick={() => setShowReport(true)}
            style={{ marginLeft: '8px', padding: '3px 8px', fontSize: '11px' }}
          >
            <i className="fas fa-file-shield" aria-hidden="true"></i> RCA Hisoboti
          </button>
        </div>
      )}

      {/* 2. 3D SAHNA */}
      <ScadaCanvas state={state} onCoilToggle={handleCoilToggle} />

      {/* 3. GAUGES & COIL ACTUATORS */}
      <ScadaGauges state={state} onCoilChange={handleCoilToggle} />

      {/* 4. TERMINAL, TABS & CHALLENGE SUBMIT */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
        {/* Terminal and Tabs Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', background: '#09121a', border: '1px solid var(--line)', borderRadius: '10px', overflow: 'hidden' }}>
          <div className="lab3d-tabs" role="tablist">
            {(
              [
                ['terminal', 'Modbus CLI', 'fa-terminal'],
                ['alarms', `Avariyalar (${state.alarms.length})`, 'fa-triangle-exclamation'],
                ['registers', 'Holding Registrlar', 'fa-microchip'],
                ['guide', "Qo'llanma", 'fa-book'],
              ] as const
            ).map(([id, label, icon]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
              >
                <i className={`fas ${icon}`} style={{ marginRight: '6px' }}></i> {label}
              </button>
            ))}
          </div>

          <div style={{ padding: '12px' }}>
            {tab === 'terminal' && (
              <ScadaTerminal
                lines={lines}
                onCommand={runCommand}
                busy={busy}
                prompt={state.mode === 'red' ? 'operator@scada-kali:~$' : 'engineer@ot-soc:~$'}
                scenario={state.scenario}
              />
            )}

            {tab === 'alarms' && (
              <div style={{ maxHeight: '360px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase' }}>
                    Sanoat Ogohlantirishlar Jurnali (SCADA Alarm Log)
                  </span>
                  <span className={`chip ${state.threat >= 60 ? 'chip-red' : 'chip-cyan'}`}>
                    Shubha: {state.threat}%
                  </span>
                </div>
                {state.alarms.length === 0 ? (
                  <p style={{ color: 'var(--muted)', fontSize: '13px', padding: '16px 0' }}>
                    Hozircha hech qanday avariya yoki xavfsizlik chegarasi buzilishi qayd etilmadi.
                  </p>
                ) : (
                  state.alarms.slice().reverse().map((a, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        background: '#04070a',
                        borderLeft: `3px solid ${a.severity === 'CRITICAL' ? '#ef4444' : '#fbbf24'}`,
                        border: '1px solid var(--line-soft)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                        <span>[{a.time}] {a.code}</span>
                        <span style={{ color: a.severity === 'CRITICAL' ? '#ef4444' : '#fbbf24', fontWeight: 700 }}>{a.severity}</span>
                      </div>
                      <div style={{ fontSize: '12.5px', color: '#fff', marginTop: '2px' }}>{a.message}</div>
                    </div>
                  ))
                )}
              </div>
            )}

            {tab === 'registers' && (
              <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
                  <thead>
                    <tr style={{ color: 'var(--muted)', borderBottom: '1px solid var(--line)', textAlign: 'left' }}>
                      <th style={{ padding: '6px 8px' }}>Offset</th>
                      <th style={{ padding: '6px 8px' }}>Hex</th>
                      <th style={{ padding: '6px 8px' }}>Dec</th>
                      <th style={{ padding: '6px 8px' }}>Tavsif</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(state.holding).map(([reg, val]) => (
                      <tr key={reg} style={{ borderBottom: '1px solid var(--line-soft)' }}>
                        <td style={{ padding: '6px 8px', color: 'var(--cyan)' }}>{reg}</td>
                        <td style={{ padding: '6px 8px', color: 'var(--warn)' }}>0x{val.toString(16).toUpperCase().padStart(4, '0')}</td>
                        <td style={{ padding: '6px 8px', color: '#fff' }}>{val}</td>
                        <td style={{ padding: '6px 8px', color: 'var(--text-dim)' }}>
                          {reg === '40001' && 'Asosiy Parametr #1'}
                          {reg === '40002' && 'Asosiy Parametr #2'}
                          {reg === '40003' && 'Kritik Parametr #3'}
                          {reg === '40004' && 'Sensor #4'}
                          {reg === '40005' && 'SIS Xavfsizlik Bloki (1=ON)'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {tab === 'guide' && (
              <div style={{ maxHeight: '360px', overflowY: 'auto', fontSize: '13px', lineHeight: '1.6' }}>
                <h4 style={{ color: 'var(--heading)', marginBottom: '4px' }}>Ssenariy Maqsadi:</h4>
                <p style={{ color: 'var(--text-dim)', marginBottom: '12px' }}>
                  {state.mode === 'red' ? activeScMeta.title + ' ob’ektiga kiber-fizik diversiya uyushtirish.' : 'Ob’ektni hujumdan saqlab qolish va me’yorga qaytarish.'}
                </p>
                <h4 style={{ color: 'var(--heading)', marginBottom: '4px' }}>Taktik Qadamlar:</h4>
                <ol style={{ paddingLeft: '18px', color: 'var(--text-dim)' }}>
                  <li><code>read-coils 1 4</code> — mavjud rele va klapanlar holatini o‘rganish.</li>
                  <li><code>read-holding 40001 5</code> — jismoniy datchik registrlari ko‘rsatkichlarini olish.</li>
                  <li><code>replay on</code> — datchik ko‘rsatkichini HMI ekranida muzlatish (MITM Stuxnet taktikasi).</li>
                  <li><code>bypass-sis</code> — avariya himoyasi blokini o‘chirish (Holding 40005 = 0).</li>
                  <li>Klapanlarni o‘zgartirib jismoniy parametrni avariya chegarasiga yetkazish.</li>
                </ol>
              </div>
            )}
          </div>
        </div>

        {/* Challenge Submit Panel */}
        <aside className="lab3d-submit" style={{ borderRadius: '10px', height: 'fit-content' }}>
          <div className="lab3d-kicker">Masala #{String(challengeId).padStart(4, '0')} · {activeScMeta.tag}</div>
          <h3>{activeScMeta.title}</h3>
          <p>
            {state.mode === 'red'
              ? 'Xavfsizlik tizimini (SIS) chetlab o‘ting, fizik parametrni xavfli chegaraga yetkazing va falokat bayrog‘ini oling.'
              : 'Sanoat telemetriyasini tahlil qiling, soxta paketlarni to‘sing va stansiyani barqaror me’yorga qaytaring.'}
          </p>
          <div className="lab3d-progress" style={{ margin: '8px 0 14px' }}>
            <span style={{ width: activeFlag ? '100%' : state.is_disaster || state.is_mitigated ? '75%' : '35%' }}></span>
          </div>

          <ApiForm action={`/challenge/${challengeId}/`}>
            <label className="label" htmlFor="scada-flag">
              Topilgan Flag
            </label>
            <input
              key={activeFlag ?? 'empty'}
              id="scada-flag"
              type="text"
              name="flag"
              className="input"
              defaultValue={activeFlag ?? ''}
              placeholder="WanNet{SCADA_...}"
              required
              autoComplete="off"
            />
            <button type="submit" className="btn btn-solid btn-block mt-3">
              <i className="fas fa-paper-plane mr-1"></i> Flagni Topshirish
            </button>
          </ApiForm>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
            <button
              type="button"
              className="lab3d-action is-info"
              onClick={() => setShowReport(true)}
              style={{ fontSize: '11px', padding: '4px 10px' }}
            >
              <i className="fas fa-file-shield mr-1"></i> RCA Ekspertiza
            </button>
            <A href={`/challenge/${challengeId}/`} className="lab3d-link">
              Masala sahifasi <i className="fas fa-arrow-right"></i>
            </A>
          </div>
        </aside>
      </div>

      {showReport && (
        <ScadaForensicModal report={reportData} onClose={() => setShowReport(false)} />
      )}
    </div>
  );
}
