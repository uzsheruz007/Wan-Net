'use client';

import {
  type CameraPreset,
  type LabState,
  getScenarioNodes,
  type NodeId,
  nodeStatus,
  type ScenarioId,
  SCENARIO_LIST,
} from './scenario';

const VIEWS: { id: CameraPreset; label: string; icon: string }[] = [
  { id: 'overview', label: 'Umumiy', icon: 'fa-expand' },
  { id: 'attacker', label: 'Hujumchi', icon: 'fa-user-secret' },
  { id: 'defender', label: 'Himoyachi', icon: 'fa-user-shield' },
  { id: 'waf', label: 'WAF/Host', icon: 'fa-shield-halved' },
  { id: 'web', label: 'Server/DC', icon: 'fa-server' },
  { id: 'db', label: 'Baza/SAN', icon: 'fa-database' },
  { id: 'map', label: 'Xarita', icon: 'fa-map' },
];

interface TopProps {
  muted: boolean;
  onToggleSound: () => void;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  state?: LabState;
  onSwitchMode?: () => void;
  onReset?: () => void;
  thermalMode?: boolean;
  onToggleThermal?: () => void;
  onSwitchScenario?: (s: ScenarioId) => void;
  onOpenReport?: () => void;
}

/** Sahna ustki chizig'i: nom, ssenariy, shubha, trace, taymer va boshqaruv */
export function StageTopBar({
  muted,
  onToggleSound,
  fullscreen,
  onToggleFullscreen,
  state,
  onSwitchMode,
  onReset,
  thermalMode,
  onToggleThermal,
  onSwitchScenario,
  onOpenReport,
}: TopProps) {
  const threat = state?.threat ?? 0;
  const trace = state?.trace ?? 0;
  const isBlocked = state?.is_blocked ?? false;
  const mode = state?.mode ?? 'red';
  const scenario = state?.scenario ?? 'web';
  const timeRemaining = state?.time_remaining ?? 300;
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const isTimeCritical = timeRemaining <= 60;
  const isTimeWarn = timeRemaining <= 120;
  const activeSc = SCENARIO_LIST.find((s) => s.id === scenario) || SCENARIO_LIST[0];

  return (
    <div className="lab3d-top">
      <div className="lab3d-title-wrap">
        <div className="lab3d-title">
          <span className="lab3d-dot" aria-hidden="true"></span>
          Kiber-poligon <span>{activeSc.network}</span>
        </div>
        <p className="lab3d-hint">{activeSc.title} · Sudrang — aylantirish · G‘ildirak — masshtab</p>
      </div>

      <div className="lab3d-tools" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Ssenariy tanlagich */}
        {onSwitchScenario && (
          <div style={{ display: 'inline-flex', alignItems: 'center', background: 'rgba(5,9,13,0.85)', borderRadius: '6px', border: '1px solid var(--line)', padding: '2px', gap: '2px' }}>
            {SCENARIO_LIST.map((sc) => (
              <button
                key={sc.id}
                type="button"
                className={`lab3d-action ${scenario === sc.id ? 'is-info' : ''}`}
                style={{
                  padding: '3px 8px',
                  fontSize: '11px',
                  minHeight: '28px',
                  border: 0,
                  background: scenario === sc.id ? 'rgba(56,189,248,0.2)' : 'transparent',
                  color: scenario === sc.id ? 'var(--heading)' : 'var(--muted)',
                }}
                onClick={() => onSwitchScenario(sc.id)}
                title={`${sc.title} (${sc.network})`}
              >
                <i className={`fas ${sc.icon}`} aria-hidden="true"></i>
                <span style={{ marginLeft: '4px' }}>{sc.id.toUpperCase()}</span>
              </button>
            ))}
          </div>
        )}

        {state && (
          <>
            {/* Taymer */}
            <div
              className={`lab3d-status ${isBlocked ? 'is-danger' : isTimeCritical ? 'is-danger' : isTimeWarn ? 'is-warn' : 'is-info'}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 9px',
                borderRadius: '6px',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
              }}
              title={mode === 'red' ? "SOC Navbatchilik vaqti (Tugasa IP bloklanadi)" : "Buzilishgacha qolgan vaqt"}
            >
              <i className={`fas ${isBlocked ? 'fa-lock' : 'fa-stopwatch'}`} aria-hidden="true"></i>
              <span>{isBlocked ? '00:00' : timeStr}</span>
            </div>

            {/* Trace / Threat */}
            <div
              className={`lab3d-status ${isBlocked ? 'is-danger' : threat >= 70 || trace >= 70 ? 'is-danger' : threat >= 35 ? 'is-warn' : 'is-ok'}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 9px', borderRadius: '6px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}
              title={isBlocked ? state.block_reason || "IP bloklangan" : `IDS Shubha: ${threat}% · SOC Trace: ${trace}%`}
            >
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'currentColor' }}></span>
              <span>{isBlocked ? 'BLOKLANDI' : mode === 'red' ? `TRACE: ${trace}%` : `SHUBHA: ${threat}%`}</span>
            </div>
          </>
        )}

        {/* Rol almashtirgich */}
        {onSwitchMode && (
          <div style={{ display: 'inline-flex', alignItems: 'center', background: 'rgba(5,9,13,0.85)', borderRadius: '6px', border: '1px solid var(--line)', padding: '2px', gap: '2px' }}>
            <button
              type="button"
              className={`lab3d-action ${mode === 'red' ? 'is-danger' : ''}`}
              style={{ padding: '3px 9px', fontSize: '11px', minHeight: '28px', border: 0, background: mode === 'red' ? 'rgba(255,84,112,0.2)' : 'transparent', color: mode === 'red' ? 'var(--heading)' : 'var(--muted)' }}
              onClick={mode === 'red' ? undefined : onSwitchMode}
              title="Qizil jamoa (Hujumchi) roli"
            >
              <i className="fas fa-user-secret" aria-hidden="true"></i>
              <span>Hujumchi</span>
            </button>
            <button
              type="button"
              className={`lab3d-action ${mode === 'blue' ? 'is-ok' : ''}`}
              style={{ padding: '3px 9px', fontSize: '11px', minHeight: '28px', border: 0, background: mode === 'blue' ? 'rgba(52,211,153,0.2)' : 'transparent', color: mode === 'blue' ? 'var(--heading)' : 'var(--muted)' }}
              onClick={mode === 'blue' ? undefined : onSwitchMode}
              title="Moviy jamoa (Himoyachi) roli"
            >
              <i className="fas fa-user-shield" aria-hidden="true"></i>
              <span>Himoyachi</span>
            </button>
          </div>
        )}

        {/* Termal / Infrared ko'rinish tugmasi */}
        {onToggleThermal && (
          <button
            type="button"
            className="lab3d-icon"
            onClick={onToggleThermal}
            aria-pressed={thermalMode}
            title={thermalMode ? "Termal rejimni o'chirish" : "Termal / Infrared issiqlik rejimini yoqish"}
            style={{ color: thermalMode ? '#f59e0b' : 'inherit' }}
          >
            <i className="fas fa-fire-flame-curved" aria-hidden="true"></i>
          </button>
        )}

        {/* Sud-tahlil hisoboti tugmasi */}
        {onOpenReport && (
          <button
            type="button"
            className="lab3d-icon"
            onClick={onOpenReport}
            title="Sud-kiber-ekspertiza hisoboti (MITRE ATT&CK & Forensic Report)"
          >
            <i className="fas fa-file-shield" aria-hidden="true"></i>
          </button>
        )}

        {onReset && (
          <button
            type="button"
            className="lab3d-icon"
            onClick={onReset}
            aria-label="Sessiyani qayta tiklash"
            title="Sessiyani qayta tiklash (Reset)"
          >
            <i className="fas fa-rotate-right" aria-hidden="true"></i>
          </button>
        )}

        <button type="button" className="lab3d-icon" onClick={onToggleSound} aria-pressed={!muted} aria-label={muted ? 'Ovozni yoqish' : "Ovozni o'chirish"} title={muted ? 'Ovozni yoqish' : "Ovozni o'chirish"}>
          <i className={`fas ${muted ? 'fa-volume-xmark' : 'fa-volume-high'}`} aria-hidden="true"></i>
        </button>
        <button type="button" className="lab3d-icon" onClick={onToggleFullscreen} aria-label={fullscreen ? "To'liq ekrandan chiqish" : "To'liq ekran"} title={fullscreen ? "To'liq ekrandan chiqish (Esc)" : "To'liq ekran"}>
          <i className={`fas ${fullscreen ? 'fa-compress' : 'fa-expand'}`} aria-hidden="true"></i>
        </button>
      </div>
    </div>
  );
}

/** Kamera ko'rinishlari: bitta qator segmentli tugmalar */
export function ViewSwitcher({ value, onChange }: { value: CameraPreset; onChange: (v: CameraPreset) => void }) {
  return (
    <div className="lab3d-views" role="group" aria-label="Kamera ko'rinishi">
      {VIEWS.map((v) => (
        <button key={v.id} type="button" aria-pressed={value === v.id} onClick={() => onChange(v.id)}>
          <i className={`fas ${v.icon}`} aria-hidden="true"></i>
          <span>{v.label}</span>
        </button>
      ))}
    </div>
  );
}

/** Tanlangan tugun kartasi */
export function NodeInspector({ id, state }: { id: NodeId; state: LabState }) {
  const nodes = getScenarioNodes(state.scenario || 'web');
  const node = nodes[id] || nodes.web;
  const status = nodeStatus(id, state);
  return (
    <section className="lab3d-inspector" aria-live="polite" aria-label="Tanlangan tugun">
      <div className="lab3d-inspector-head">
        <div>
          <div className="lab3d-kicker">Tanlangan tugun</div>
          <h3>{node.name}</h3>
        </div>
        <span className={`lab3d-status is-${status.tone}`}>{status.label}</span>
      </div>
      <dl>
        <div>
          <dt>IP</dt>
          <dd className="mono">{node.ip}</dd>
        </div>
        <div>
          <dt>Vazifasi</dt>
          <dd>{node.role}</dd>
        </div>
        <div>
          <dt>Xizmatlar</dt>
          <dd className="mono">{node.services}</dd>
        </div>
      </dl>
    </section>
  );
}
