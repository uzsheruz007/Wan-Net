'use client';

import { type ForensicReport } from './scenario';

interface Props {
  report: ForensicReport;
  onClose: () => void;
}

export function ForensicModal({ report, onClose }: Props) {
  const gradeColors: Record<string, { bg: string; border: string; text: string }> = {
    S: { bg: 'rgba(234, 179, 8, 0.15)', border: '#eab308', text: '#fde047' },
    A: { bg: 'rgba(52, 211, 153, 0.15)', border: '#34d399', text: '#6ee7b7' },
    B: { bg: 'rgba(56, 189, 248, 0.15)', border: '#38bdf8', text: '#7dd3fc' },
    C: { bg: 'rgba(251, 146, 60, 0.15)', border: '#fb923c', text: '#fdba74' },
    F: { bg: 'rgba(239, 68, 68, 0.15)', border: '#ef4444', text: '#fca5a5' },
  };

  const currentGrade = gradeColors[report.grade] || gradeColors.B;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(5, 9, 13, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#0a1118',
          border: '1px solid var(--line)',
          borderRadius: '12px',
          maxWidth: '680px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8)',
          color: 'var(--text)',
          fontFamily: 'inherit',
          padding: '24px',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px', borderBottom: '1px solid var(--line)', paddingBottom: '16px' }}>
          <div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: '4px' }}>
              <i className="fas fa-file-shield" style={{ marginRight: '6px', color: 'var(--cyan)' }}></i>
              Sud-Kiber-Ekspertiza Hisoboti (Forensics)
            </div>
            <h2 style={{ margin: 0, fontSize: '20px', color: 'var(--heading)' }}>
              {report.scenario_title || report.scenario.toUpperCase()} · Insident Tahlili
            </h2>
            <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>
              Yakunlangan vaqt: {report.completed_at} · Rejim: {report.mode === 'red' ? '🔴 Red Team (Hujum)' : '🔵 Blue Team (Himoya)'}
            </div>
          </div>
          <button
            type="button"
            className="lab3d-icon"
            onClick={onClose}
            aria-label="Yopish"
            style={{ minWidth: '32px', minHeight: '32px' }}
          >
            <i className="fas fa-xmark"></i>
          </button>
        </div>

        {/* Grade Banner */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '20px',
            background: currentGrade.bg,
            border: `1px solid ${currentGrade.border}`,
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '20px',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '8px',
              background: 'rgba(0, 0, 0, 0.4)',
              border: `2px solid ${currentGrade.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '32px',
              fontWeight: 900,
              color: currentGrade.text,
              fontFamily: 'var(--font-mono)',
            }}
          >
            {report.grade}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: currentGrade.text, fontWeight: 700 }}>
              Operatsiya Bahosi
            </div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--heading)', marginTop: '2px' }}>
              {report.verdict}
            </div>
          </div>
        </div>

        {/* KPI Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '24px' }}>
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--line)', borderRadius: '6px', padding: '10px' }}>
            <div style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase' }}>Yashirinlik (Stealth)</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: report.stealth_score >= 70 ? 'var(--green)' : 'var(--warn)', marginTop: '4px' }}>
              {report.stealth_score}%
            </div>
          </div>
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--line)', borderRadius: '6px', padding: '10px' }}>
            <div style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase' }}>Sarflangan Vaqt</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--heading)', marginTop: '4px' }}>
              {report.time_taken}
            </div>
          </div>
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--line)', borderRadius: '6px', padding: '10px' }}>
            <div style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase' }}>Maksimal Shubha</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: report.threat_peak >= 70 ? 'var(--red)' : 'var(--cyan)', marginTop: '4px' }}>
              {report.threat_peak}%
            </div>
          </div>
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--line)', borderRadius: '6px', padding: '10px' }}>
            <div style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase' }}>SOC Ogohlantirishlar</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--heading)', marginTop: '4px' }}>
              {report.alerts_triggered} ta
            </div>
          </div>
        </div>

        {/* MITRE ATT&CK Matrix Mapping */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <h3 style={{ margin: 0, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--heading)' }}>
              <i className="fas fa-cubes" style={{ marginRight: '6px', color: 'var(--cyan)' }}></i>
              Qo‘llanilgan MITRE ATT&CK® Texnikalari
            </h3>
            <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{report.mitre_techniques.length} ta aniqlangan</span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {report.mitre_techniques.map((m) => (
              <div
                key={m.id}
                style={{
                  background: 'rgba(56, 189, 248, 0.08)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  borderRadius: '6px',
                  padding: '6px 10px',
                  fontSize: '11px',
                }}
              >
                <div style={{ fontWeight: 700, color: 'var(--cyan)', fontFamily: 'var(--font-mono)' }}>{m.id}</div>
                <div style={{ color: 'var(--heading)', marginTop: '2px' }}>{m.name}</div>
                <div style={{ fontSize: '9px', color: 'var(--muted)', marginTop: '2px', textTransform: 'uppercase' }}>{m.tactic}</div>
              </div>
            ))}
            {report.mitre_techniques.length === 0 && (
              <div style={{ fontSize: '12px', color: 'var(--muted)', fontStyle: 'italic' }}>
                Hali MITRE texnikalari qayd etilmagan.
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid var(--line)', paddingTop: '16px' }}>
          <button
            type="button"
            className="lab3d-action is-info"
            onClick={() => window.print()}
            style={{ padding: '6px 14px', fontSize: '12px' }}
          >
            <i className="fas fa-print" aria-hidden="true"></i>
            <span>Chop etish / PDF saqlash</span>
          </button>
          <button
            type="button"
            className="lab3d-action"
            onClick={onClose}
            style={{ padding: '6px 14px', fontSize: '12px' }}
          >
            <span>Yopish</span>
          </button>
        </div>
      </div>
    </div>
  );
}
