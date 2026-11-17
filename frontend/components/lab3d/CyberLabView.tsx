'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiForm } from '@/components/ApiForm';
import { A } from '@/components/ui';

import { cyberAudio } from './CyberAudio';
import { CyberLabCanvas } from './CyberLabCanvas';
import { NodeInspector, StageTopBar, ViewSwitcher } from './CyberLabHUD';
import { CyberTerminal } from './CyberTerminal';
import { ForensicModal } from './ForensicModal';
import {
  type AttackKind,
  type CameraPreset,
  executeServerCommand,
  fetchServerState,
  INITIAL_STATE,
  type LabState,
  type LogLine,
  NODE_ORDER,
  type NodeId,
  nodeStatus,
  resetServerState,
  switchServerMode,
  switchServerScenario,
  getScenarioNodes,
  RED_STEPS_BY_SCENARIO,
  BLUE_STEPS_BY_SCENARIO,
  RED_ACTIONS_BY_SCENARIO,
  BLUE_ACTIONS_BY_SCENARIO,
  SCENARIO_LIST,
  type ScenarioId,
  WELCOME,
} from './scenario';

interface Props {
  challengeId?: number;
}

let lineId = 0;
const withIds = (lines: Omit<LogLine, 'id'>[]): LogLine[] => lines.map((l) => ({ ...l, id: ++lineId }));

export function CyberLabView({ challengeId = 51 }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const [state, setState] = useState<LabState>(INITIAL_STATE);
  const [lines, setLines] = useState<LogLine[]>(() => withIds(WELCOME));
  const [node, setNode] = useState<NodeId>('web');
  const [camera, setCamera] = useState<CameraPreset>('overview');
  const [attack, setAttack] = useState<{ kind: AttackKind; key: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [muted, setMuted] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [thermalMode, setThermalMode] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [tab, setTab] = useState<'terminal' | 'soc' | 'guide' | 'nodes'>('terminal');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    cyberAudio.setMuted(true);
    const onFs = () => setFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener('fullscreenchange', onFs);

    // Dastlabki holatni serverdan olish
    fetchServerState().then((s) => {
      if (s) setState(s);
    });

    const pending = timers.current;
    return () => {
      document.removeEventListener('fullscreenchange', onFs);
      pending.forEach((t) => window.clearTimeout(t));
      cyberAudio.stopHeartbeat();
    };
  }, []);

  // Faol taymer hisoblagichi (har 1 soniyada kamayadi va tugaganda serverni ogohlantiradi)
  useEffect(() => {
    const isFinished = state.is_blocked || (state.mode === 'red' ? !!state.red.flag : !!state.blue.flag);
    if (isFinished) return;

    const interval = window.setInterval(() => {
      setState((prev) => {
        if (prev.is_blocked) return prev;
        const rem = Math.max(0, (prev.time_remaining ?? 300) - 1);
        if (rem === 0 && !prev.is_blocked) {
          executeServerCommand('tick', prev).then((res) => {
            setState(res.state);
            if (res.lines.length) setLines((l) => [...l, ...withIds(res.lines)]);
            if (res.attack) setAttack({ kind: res.attack, key: Date.now() });
          });
        }
        return { ...prev, time_remaining: rem };
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [state.is_blocked, state.mode, state.red.flag, state.blue.flag]);

  // Kritik vaziyatda (oxirgi 45 soniya) yurak urishi (heartbeat) tovushi
  useEffect(() => {
    const isFinished = state.is_blocked || (state.mode === 'red' ? !!state.red.flag : !!state.blue.flag);
    if (!muted && !isFinished && state.time_remaining <= 45 && state.time_remaining > 0) {
      cyberAudio.startHeartbeat(state.time_remaining <= 20);
    } else {
      cyberAudio.stopHeartbeat();
    }
  }, [muted, state.is_blocked, state.mode, state.red.flag, state.blue.flag, state.time_remaining]);

  const select = useCallback(
    (id: NodeId) => {
      const nodes = getScenarioNodes(state.scenario);
      setNode(id);
      setCamera(nodes[id]?.camera || 'overview');
      cyberAudio.click();
    },
    [state.scenario],
  );

  const run = useCallback(
    async (raw: string) => {
      if (busy) return;
      setBusy(true);
      try {
        const result = await executeServerCommand(raw, state);
        setState(result.state);
        setLines((prev) => (result.clear ? [] : [...prev, ...withIds(result.lines)]));
        if (result.focus) setNode(result.focus);
        if (result.camera) setCamera(result.camera);
        if (result.attack) {
          setAttack({ kind: result.attack, key: Date.now() });
        }
        if (result.later) {
          const later = result.later;
          timers.current.push(
            window.setTimeout(() => {
              setLines((prev) => [...prev, ...withIds(later.lines)]);
              if (later.state) setState(later.state);
              setBusy(false);
            }, later.delay),
          );
        } else {
          setBusy(false);
        }
      } catch {
        setBusy(false);
      }
    },
    [busy, state],
  );

  const handleSwitchMode = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    cyberAudio.click();
    try {
      const nextMode = state.mode === 'red' ? 'blue' : 'red';
      const s = await switchServerMode(nextMode);
      setState(s);
      setLines((prev) => [
        ...prev,
        ...withIds([
          { type: 'cmd', text: `mode ${nextMode}` },
          {
            type: 'success',
            text: `[+] Rejim almashtirildi: ${
              nextMode === 'blue' ? '🔵 Moviy jamoa (Himoyachi)' : '🔴 Qizil jamoa (Hujumchi)'
            }`,
          },
        ]),
      ]);
      setBusy(false);
    } catch {
      setBusy(false);
    }
  }, [busy, state.mode]);

  const handleSwitchScenario = useCallback(
    async (sc: ScenarioId) => {
      if (busy) return;
      setBusy(true);
      cyberAudio.click();
      try {
        const s = await switchServerScenario(sc);
        setState(s);
        const title = SCENARIO_LIST.find((item) => item.id === sc)?.title || sc;
        setLines((prev) => [
          ...prev,
          ...withIds([
            { type: 'cmd', text: `scenario ${sc}` },
            { type: 'success', text: `[+] Ssenariy yuklandi: ${title}. Muhit va 3D topologiya yangilandi.` },
          ]),
        ]);
        setBusy(false);
      } catch {
        setBusy(false);
      }
    },
    [busy],
  );

  const handleReset = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    cyberAudio.click();
    cyberAudio.stopHeartbeat();
    try {
      const s = await resetServerState(state.mode, state.scenario);
      setState(s);
      setLines((prev) => [
        ...prev,
        ...withIds([
          { type: 'cmd', text: 'reset' },
          { type: 'info', text: "[*] Laboratoriya holati, taymer va ogohlantirishlar boshlang'ich holatga qaytarildi." },
        ]),
      ]);
      setBusy(false);
    } catch {
      setBusy(false);
    }
  }, [busy, state.mode, state.scenario]);

  const handleOpenReport = useCallback(async () => {
    cyberAudio.click();
    if (!state.forensic_report) {
      try {
        const res = await executeServerCommand('report', state);
        setState(res.state);
        if (res.lines.length) setLines((l) => [...l, ...withIds(res.lines)]);
      } catch {
        // pass
      }
    }
    setShowReport(true);
  }, [state]);

  const toggleThermal = useCallback(() => {
    setThermalMode((v) => !v);
    cyberAudio.click();
  }, []);

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

  function toggleSound() {
    const next = !muted;
    setMuted(next);
    cyberAudio.setMuted(next);
    if (!next) cyberAudio.startAmbient();
    else cyberAudio.stopHeartbeat();
  }

  const activeFlag = state.mode === 'red' ? state.red.flag : state.blue.flag;

  function copyFlag() {
    if (!activeFlag) return;
    navigator.clipboard?.writeText(activeFlag).then(() => {
      setCopied(true);
      timers.current.push(window.setTimeout(() => setCopied(false), 1800));
    });
  }

  const currentScenario = state.scenario || 'web';
  const currentSteps =
    (state.mode === 'red' ? RED_STEPS_BY_SCENARIO[currentScenario] : BLUE_STEPS_BY_SCENARIO[currentScenario]) ||
    (state.mode === 'red' ? RED_STEPS_BY_SCENARIO.web : BLUE_STEPS_BY_SCENARIO.web);
  const currentActions =
    (state.mode === 'red' ? RED_ACTIONS_BY_SCENARIO[currentScenario] : BLUE_ACTIONS_BY_SCENARIO[currentScenario]) ||
    (state.mode === 'red' ? RED_ACTIONS_BY_SCENARIO.web : BLUE_ACTIONS_BY_SCENARIO.web);
  const doneSteps = currentSteps.filter((s) => s.done(state)).length;
  const activeSc = SCENARIO_LIST.find((s) => s.id === currentScenario) || SCENARIO_LIST[0];
  const scenarioNodes = getScenarioNodes(currentScenario);

  // Zaxira sud-kiber-ekspertiza hisoboti (modal ochilganda bo'sh qolmasligi uchun)
  const reportData = state.forensic_report || {
    scenario: currentScenario,
    scenario_title: activeSc.title,
    mode: state.mode,
    grade: (state.threat >= 75 ? 'F' : state.threat >= 45 ? 'C' : state.threat >= 20 ? 'B' : 'A') as 'A' | 'B' | 'C' | 'F',
    verdict: state.is_blocked
      ? 'Tajovuzkor SOC tomonidan to‘liq fosh qilindi va tarmoq darajasida bloklandi.'
      : activeFlag
      ? 'Operatsiya muvaffaqiyatli yakunlandi. Maqsadga erishildi.'
      : 'Kiber-operatsiya hozirda faol kechmoqda. Tahlil davom etmoqda.',
    stealth_score: Math.max(0, 100 - state.threat),
    time_taken: `${Math.floor((state.total_time - state.time_remaining) / 60)} daqiqa ${(state.total_time - state.time_remaining) % 60} soniya`,
    threat_peak: state.threat,
    trace_peak: state.trace,
    alerts_triggered: state.alerts.length,
    mitre_techniques: state.mitre_log,
    tactics_covered: Array.from(new Set(state.mitre_log.map((m) => m.tactic))),
    completed_at: new Date().toLocaleTimeString(),
  };

  return (
    <div ref={rootRef} className={`lab3d ${fullscreen ? 'is-fullscreen' : ''}`}>
      <div className="lab3d-stage">
        <CyberLabCanvas
          activeNode={node}
          onSelectNode={select}
          cameraPreset={camera}
          attack={attack}
          onAttackFinish={() => setBusy(false)}
          thermalMode={thermalMode}
          scenario={currentScenario}
        />
        <StageTopBar
          muted={muted}
          onToggleSound={toggleSound}
          fullscreen={fullscreen}
          onToggleFullscreen={toggleFullscreen}
          state={state}
          onSwitchMode={handleSwitchMode}
          onReset={handleReset}
          thermalMode={thermalMode}
          onToggleThermal={toggleThermal}
          onSwitchScenario={handleSwitchScenario}
          onOpenReport={handleOpenReport}
        />
        <div className="lab3d-inspector-slot">
          <NodeInspector id={node} state={state} />
        </div>
        <div className="lab3d-bottom">
          <ViewSwitcher value={camera} onChange={setCamera} />
        </div>

        {activeFlag && (
          <div className="lab3d-flag" role="status">
            <i className="fas fa-flag" aria-hidden="true"></i>
            <span>{state.mode === 'blue' ? 'Moviy jamoa flagi topildi' : 'Qizil jamoa flagi topildi'}</span>
            <code>{activeFlag}</code>
            <button type="button" className="lab3d-icon" onClick={copyFlag} aria-label="Flagdan nusxa olish">
              <i className={`fas ${copied ? 'fa-check' : 'fa-copy'}`} aria-hidden="true"></i>
            </button>
            <button
              type="button"
              className="lab3d-action is-info"
              onClick={handleOpenReport}
              style={{ marginLeft: '8px', padding: '3px 8px', fontSize: '11px' }}
            >
              <i className="fas fa-file-shield" aria-hidden="true"></i> Hisobot
            </button>
          </div>
        )}

        {state.is_blocked && (
          <div
            className="lab3d-flag"
            role="alert"
            style={{
              borderColor: 'var(--red)',
              background: 'rgba(255, 84, 112, 0.15)',
              boxShadow: '0 0 25px rgba(255, 84, 112, 0.35)',
              color: 'var(--red)',
              maxWidth: '92%',
            }}
          >
            <i className="fas fa-triangle-exclamation" aria-hidden="true" style={{ fontSize: '18px' }}></i>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'left' }}>
              <span style={{ fontWeight: 700, letterSpacing: '0.03em' }}>QO‘LGA TUSHINGIZ! HIMOYACHI SERVER SIZNI BLOKLADI</span>
              <span style={{ fontSize: '11px', color: 'var(--text)' }}>
                {state.block_reason || "IP manzilingiz firewall da to'liq to'sildi."}
              </span>
            </div>
            <button
              type="button"
              className="lab3d-action is-info"
              onClick={handleOpenReport}
              style={{ marginLeft: 'auto', padding: '4px 10px', fontSize: '11px', minHeight: '30px' }}
            >
              <i className="fas fa-file-shield" aria-hidden="true"></i> Hisobot
            </button>
            <button
              type="button"
              className="lab3d-action is-danger"
              onClick={handleReset}
              style={{ marginLeft: '6px', padding: '4px 12px', fontSize: '11px', minHeight: '30px' }}
            >
              <i className="fas fa-rotate-right" aria-hidden="true"></i>
              <span>Qayta boshlash</span>
            </button>
          </div>
        )}
      </div>

      <div className="lab3d-actions">
        <ol className="lab3d-steps" aria-label="Topshiriq qadamlari">
          {currentSteps.map((s, i) => (
            <li key={s.key} className={s.done(state) ? 'is-done' : i === doneSteps ? 'is-current' : ''}>
              <span>{s.done(state) ? <i className="fas fa-check" aria-hidden="true"></i> : i + 1}</span>
              {s.title}
            </li>
          ))}
        </ol>
        <div className="lab3d-action-btns" role="group" aria-label="Amallar">
          {currentActions.map((a) => (
            <button
              key={a.cmd}
              type="button"
              className={`lab3d-action is-${a.tone}`}
              onClick={() => run(a.cmd)}
              disabled={busy}
            >
              <i className={`fas ${a.icon}`} aria-hidden="true"></i>
              {a.label}
            </button>
          ))}
        </div>
      </div>

      <div className="lab3d-panels">
        <div className="lab3d-tabs-panel">
          <div className="lab3d-tabs" role="tablist" aria-label="Laboratoriya paneli">
            {(
              [
                ['terminal', 'Terminal', 'fa-terminal'],
                ['soc', `SOC & MITRE (${state.alerts.length})`, 'fa-shield-halved'],
                ['guide', "Qo'llanma", 'fa-book-open'],
                ['nodes', 'Tugunlar (6)', 'fa-network-wired'],
              ] as const
            ).map(([id, label, icon]) => (
              <button
                key={id}
                type="button"
                role="tab"
                id={`lab3d-tab-${id}`}
                aria-selected={tab === id}
                aria-controls={`lab3d-pane-${id}`}
                onClick={() => setTab(id)}
              >
                <i className={`fas ${icon}`} aria-hidden="true"></i> {label}
              </button>
            ))}
          </div>

          <div className="lab3d-pane" role="tabpanel" id={`lab3d-pane-${tab}`} aria-labelledby={`lab3d-tab-${tab}`}>
            {tab === 'terminal' && (
              <CyberTerminal
                lines={lines}
                onCommand={run}
                busy={busy}
                prompt={state.mode === 'blue' ? 'defender@soc:~$' : 'operator@kali:~$'}
              />
            )}

            {tab === 'soc' && (
              <div className="lab3d-guide" style={{ maxHeight: '320px', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h4 style={{ margin: 0 }}>SIEM Hodisalari & MITRE ATT&CK</h4>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span className={`lab3d-status ${state.is_blocked ? 'is-danger' : state.threat >= 70 ? 'is-danger' : state.threat >= 35 ? 'is-warn' : 'is-ok'}`}>
                      Shubha: {state.threat}%
                    </span>
                    <span className={`lab3d-status ${state.trace >= 60 ? 'is-danger' : state.trace >= 30 ? 'is-warn' : 'is-ok'}`}>
                      Trace: {state.trace}%
                    </span>
                    <button
                      type="button"
                      className="lab3d-action is-info"
                      style={{ padding: '2px 8px', fontSize: '11px', minHeight: '26px' }}
                      onClick={handleOpenReport}
                    >
                      <i className="fas fa-file-shield" aria-hidden="true"></i> Sud Hisoboti
                    </button>
                  </div>
                </div>

                {state.mitre_log.length > 0 && (
                  <div style={{ marginBottom: '12px', padding: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', border: '1px solid var(--line)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Aniqlangan MITRE ATT&CK texnikalari:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {state.mitre_log.map((m) => (
                        <span
                          key={m.id}
                          style={{
                            fontSize: '11px',
                            fontFamily: 'var(--font-mono)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: 'rgba(56, 189, 248, 0.15)',
                            border: '1px solid rgba(56, 189, 248, 0.4)',
                            color: 'var(--cyan)',
                          }}
                          title={`${m.tactic}: ${m.name}`}
                        >
                          <b>{m.id}</b> {m.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {state.alerts.length === 0 ? (
                  <p style={{ color: 'var(--muted)', fontSize: '13px' }}>
                    Hozircha hech qanday IDS/SIEM ogohlantirishi qayd etilmagan. SOC xotirjam holatda.
                  </p>
                ) : (
                  <ol className="lab3d-guide" style={{ padding: 0 }}>
                    {state.alerts.slice().reverse().map((a, idx) => (
                      <li key={idx} className="is-done" style={{ borderLeftColor: a.threat >= 70 ? 'var(--danger)' : 'var(--warn)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                          <span>[{a.timestamp}] {a.rule_id} {a.mitre_id ? `(${a.mitre_id})` : ''}</span>
                          <span style={{ color: a.threat >= 70 ? 'var(--danger)' : 'var(--warn)' }}>Xavf: {a.threat}%</span>
                        </div>
                        <h4 style={{ fontSize: '13px', margin: '3px 0' }}>{a.rule_name}</h4>
                        <p style={{ margin: 0, fontSize: '12.5px' }}>{a.reason}</p>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}

            {tab === 'guide' && (
              <ol className="lab3d-guide">
                {state.mode === 'red' ? (
                  currentScenario === 'web' ? (
                    <>
                      <li className={state.red.scanned ? 'is-done' : ''}>
                        <h4>1. Razvedka (Reconnaissance)</h4>
                        <p>
                          <code>scan</code> — tarmoq xaritasini ochadi. Nginx serverida <code>/api/v1/telemetry</code> va <code>/api/v1/search</code> topiladi. Har bir skanerlash SIEM shubha darajasini oshiradi (+15%).
                        </p>
                      </li>
                      <li className={state.red.token_acquired ? 'is-done' : ''}>
                        <h4>2. Sessiya tokeni</h4>
                        <p>
                          <code>recon</code> — <code>/api/v1/telemetry</code> endpointidan dinamik avtorizatsiya tokenini oladi. Bu tokensiz keyingi so&apos;rovlar rad etiladi.
                        </p>
                      </li>
                      <li className={state.red.waf_tested ? 'is-done' : ''}>
                        <h4>3. WAF tahlili</h4>
                        <p>
                          <code>waf test</code> — oddiy SQLi yuborib ModSecurity qoidasini aniqlaydi (403 Forbidden). Diqqat: takroriy urinishlar shubha darajasini ko&apos;taradi.
                        </p>
                      </li>
                      <li className={state.red.waf_bypassed ? 'is-done' : ''}>
                        <h4>4. WAF filtrini chetlab o&apos;tish</h4>
                        <p>
                          <code>waf bypass</code> — kalit so&apos;zlarni inline izoh (<code>/**/</code>) va aralash registr bilan bo&apos;lib, qoidani aylanib o&apos;tadi.
                        </p>
                      </li>
                      <li className={state.red.exploited ? 'is-done' : ''}>
                        <h4>5. Eksploitatsiya va Flag</h4>
                        <p>
                          <code>exploit</code> — serverda barcha qadamlar to&apos;g&apos;riligi tekshirilib, faqat sizning hisobingiz uchun dinamik flag taqdim etiladi.
                        </p>
                      </li>
                    </>
                  ) : currentScenario === 'ad' ? (
                    <>
                      <li className={state.red.scanned ? 'is-done' : ''}>
                        <h4>1. AD Domen Razvedkasi</h4>
                        <p>
                          <code>scan ad</code> — Korporativ domendagi <code>WIN-DC01</code> Domen Kontrollerini va ulangan ishchi stansiyalarni aniqlaydi.
                        </p>
                      </li>
                      <li className={state.red.token_acquired ? 'is-done' : ''}>
                        <h4>2. BloodHound Ingest</h4>
                        <p>
                          <code>bloodhound</code> — Domen ob&apos;ektlari, foydalanuvchilar va imtiyozlarni tahlil qilib, domen adminligiga eng qisqa hujum yo&apos;lini chizadi.
                        </p>
                      </li>
                      <li className={state.red.waf_tested ? 'is-done' : ''}>
                        <h4>3. Kerberoasting Hujumi</h4>
                        <p>
                          <code>kerberoast</code> — Xizmat hisobi (<code>svc_sql</code>) uchun TGS chiptasini so&apos;rab oladi va oflayn NTLM parolini ochadi.
                        </p>
                      </li>
                      <li className={state.red.waf_bypassed ? 'is-done' : ''}>
                        <h4>4. Pass-the-Hash (Lateral Movement)</h4>
                        <p>
                          <code>pass-the-hash</code> — Olingan hash orqali Domen Kontrolleriga (DC01) administrator sifatida kiradi.
                        </p>
                      </li>
                      <li className={state.red.exploited ? 'is-done' : ''}>
                        <h4>5. Domain Admin & NTDS.dit Eksfiltratsiyasi</h4>
                        <p>
                          <code>domain-admin</code> — NTDS.dit bazasidan ma&apos;lumotlarni chiqarib, shaxsiy AD bayrog&apos;ingizni taqdim etadi.
                        </p>
                      </li>
                    </>
                  ) : (
                    <>
                      <li className={state.red.scanned ? 'is-done' : ''}>
                        <h4>1. Ombor va Serverlarni Skanerlash</h4>
                        <p>
                          <code>scan</code> — Tarmoqdagi ulashilgan papkalar (SMB Shares) va korporativ omborlarni skanerlaydi.
                        </p>
                      </li>
                      <li className={state.red.token_acquired ? 'is-done' : ''}>
                        <h4>2. Shifrlash Agentini Tashlash</h4>
                        <p>
                          <code>drop payload</code> — C2 serveridan korporativ fayl serveriga <code>crypt_agent.exe</code> zararli dasturini yuklaydi.
                        </p>
                      </li>
                      <li className={state.red.waf_tested ? 'is-done' : ''}>
                        <h4>3. Zaxira Nusxalarini O&apos;chirish (VSS)</h4>
                        <p>
                          <code>disable-vss</code> — <code>vssadmin delete shadows</code> orqali administratorning tizimni tiklash imkoniyatini yo&apos;q qiladi.
                        </p>
                      </li>
                      <li className={state.red.waf_bypassed ? 'is-done' : ''}>
                        <h4>4. AES-256 Shifrlash</h4>
                        <p>
                          <code>encrypt-shares</code> — Ulashilgan tarmoq papkalaridagi barcha kritik biznes hujjatlarni bir zumda shifrlaydi.
                        </p>
                      </li>
                      <li className={state.red.exploited ? 'is-done' : ''}>
                        <h4>5. To&apos;lov Talabnomasi & Flag</h4>
                        <p>
                          <code>ransom-note</code> — Ish stollariga README xabarini yozib, serverdan dinamik Ransomware flagini chiqaradi.
                        </p>
                      </li>
                    </>
                  )
                ) : currentScenario === 'web' ? (
                  <>
                    <li className={state.blue.logs_viewed ? 'is-done' : ''}>
                      <h4>1. SOC monitoringi</h4>
                      <p>
                        <code>soc logs</code> — SIEM audit jurnalini tahlil qiling. G&apos;ayritabiiy so&apos;rov yuborayotgan tajovuzkor IP manzilini toping.
                      </p>
                    </li>
                    <li className={state.blue.target_identified ? 'is-done' : ''}>
                      <h4>2. IP tahlili</h4>
                      <p>
                        <code>investigate 198.51.100.42</code> — shubhali manzil faoliyatini tahlil qilib, hujum turini tasdiqlang.
                      </p>
                    </li>
                    <li className={state.blue.ip_blocked ? 'is-done' : ''}>
                      <h4>3. Firewall to&apos;sig&apos;i</h4>
                      <p>
                        <code>block 198.51.100.42</code> — tajovuzkorni tarmoq darajasida (iptables DROP) to&apos;liq to&apos;sing.
                      </p>
                    </li>
                    <li className={state.blue.patched ? 'is-done' : ''}>
                      <h4>4. Virtual Patch</h4>
                      <p>
                        <code>patch sql</code> — veb-serverdagi zaif qidiruv parametriga qat&apos;iy WAF filtri qo&apos;ying.
                      </p>
                    </li>
                    <li className={state.blue.verified ? 'is-done' : ''}>
                      <h4>5. Tizim yaxlitligi va Flag</h4>
                      <p>
                        <code>verify</code> — tarmoq xavfsizligini tekshirib, serverdan Moviy Jamoa (Blue Team) flagini oling.
                      </p>
                    </li>
                  </>
                ) : currentScenario === 'ad' ? (
                  <>
                    <li className={state.blue.logs_viewed ? 'is-done' : ''}>
                      <h4>1. Domen Hodisalari Auditi</h4>
                      <p>
                        <code>ad logs</code> — Event ID 4769 (Kerberos TGS so&apos;rovi) orqali Kerberoasting anomaliyasini aniqlang.
                      </p>
                    </li>
                    <li className={state.blue.target_identified ? 'is-done' : ''}>
                      <h4>2. Xost Tahlili</h4>
                      <p>
                        <code>investigate 172.16.10.15</code> — Zararlangan moliya xodimi kompyuteri faoliyatini tahlil qiling.
                      </p>
                    </li>
                    <li className={state.blue.ip_blocked ? 'is-done' : ''}>
                      <h4>3. Tarmoqdan Uzish (Host Isolation)</h4>
                      <p>
                        <code>isolate-pc 172.16.10.15</code> — Domen infektsiyasi tarqalmasligi uchun xostni VLAN dan uzib qo&apos;ying.
                      </p>
                    </li>
                    <li className={state.blue.patched ? 'is-done' : ''}>
                      <h4>4. KRBTGT Hisobini Yangilash</h4>
                      <p>
                        <code>reset-krbtgt</code> — Golden Ticket xavfini bartaraf etish uchun Domen KRBTGT hisobining parolini reset qiling.
                      </p>
                    </li>
                    <li className={state.blue.verified ? 'is-done' : ''}>
                      <h4>5. Domen Yaxlitligi va Flag</h4>
                      <p>
                        <code>verify</code> — Domen nazoratchisini to&apos;liq audit qilib, Moviy jamoa bayrog&apos;ini oling.
                      </p>
                    </li>
                  </>
                ) : (
                  <>
                    <li className={state.blue.logs_viewed ? 'is-done' : ''}>
                      <h4>1. C2 Oqimini Qidirish (Threat Hunting)</h4>
                      <p>
                        <code>hunt-beacon</code> — Tashqi C2 serverga ketayotgan davriy aloqa oqimini aniqlang.
                      </p>
                    </li>
                    <li className={state.blue.target_identified ? 'is-done' : ''}>
                      <h4>2. Zararli Jarayonni To&apos;xtatish</h4>
                      <p>
                        <code>kill-process crypt_agent.exe</code> — Shifrlash jarayonini xotiradan darhol to&apos;xtating.
                      </p>
                    </li>
                    <li className={state.blue.ip_blocked ? 'is-done' : ''}>
                      <h4>3. Zaxira Nusxalarini Tiklash</h4>
                      <p>
                        <code>vss-restore</code> — VSS (Volume Shadow Copy) orqali zaxira nusxalarini saqlab qoling va tiklang.
                      </p>
                    </li>
                    <li className={state.blue.patched ? 'is-done' : ''}>
                      <h4>4. RAM Xotiradan Kalitni Ajratib Olish</h4>
                      <p>
                        <code>extract-key</code> — Jarayon xotirasining RAM dampidan AES-256 shifrlash kalitini tiklab oling.
                      </p>
                    </li>
                    <li className={state.blue.verified ? 'is-done' : ''}>
                      <h4>5. Dekriptor va Moviy Flag</h4>
                      <p>
                        <code>verify</code> — Tiklangan kalit bilan fayllarni shifrdan chiqaring va Blue Team flagini oling.
                      </p>
                    </li>
                  </>
                )}
              </ol>
            )}

            {tab === 'nodes' && (
              <ul className="lab3d-nodes">
                {NODE_ORDER.map((id) => {
                  const st = nodeStatus(id, state);
                  const n = scenarioNodes[id] || scenarioNodes.web;
                  return (
                    <li key={id}>
                      <button type="button" aria-pressed={node === id} onClick={() => select(id)}>
                        <span className="mono">{n.ip}</span>
                        <b>{n.name}</b>
                        <span className={`lab3d-status is-${st.tone}`}>{st.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <aside className="lab3d-submit">
          <div className="lab3d-kicker">Masala #{String(challengeId).padStart(4, '0')} · {activeSc.network}</div>
          <h3>{activeSc.title} — {state.mode === 'blue' ? 'Moviy jamoa (Himoya)' : 'Qizil jamoa (Hujum)'}</h3>
          <p>
            {state.mode === 'blue'
              ? 'SOC loglarini tahlil qiling, tahdidni aniqlab tarmoqdan to‘sing va tizim yaxlitligini tiklang.'
              : 'Tizimni skanerlang, zaifliklarni zanjir bo‘yicha ekspluatatsiya qiling va himoyachiga tushmasdan flagni oling.'}
          </p>
          <div className="lab3d-progress" aria-label={`${doneSteps} / ${currentSteps.length} qadam bajarildi`}>
            <span style={{ width: `${(doneSteps / currentSteps.length) * 100}%` }}></span>
          </div>
          <ApiForm action={`/challenge/${challengeId}/`}>
            <label className="label" htmlFor="lab3d-flag">
              Flag
            </label>
            <input
              key={activeFlag ?? 'empty'}
              id="lab3d-flag"
              type="text"
              name="flag"
              className="input"
              defaultValue={activeFlag ?? ''}
              placeholder="WanNet{...}"
              required
              autoComplete="off"
            />
            <button type="submit" className="btn btn-solid btn-block mt-3">
              <i className="fas fa-paper-plane" aria-hidden="true"></i> Yuborish
            </button>
          </ApiForm>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
            <button
              type="button"
              className="lab3d-action is-info"
              onClick={handleOpenReport}
              style={{ fontSize: '11px', padding: '4px 10px' }}
            >
              <i className="fas fa-file-shield" aria-hidden="true"></i> Insident Hisoboti
            </button>
            <A href={`/challenge/${challengeId}/`} className="lab3d-link">
              Masala sahifasi <i className="fas fa-arrow-right" aria-hidden="true"></i>
            </A>
          </div>
        </aside>
      </div>

      {showReport && (
        <ForensicModal report={reportData} onClose={() => setShowReport(false)} />
      )}
    </div>
  );
}
