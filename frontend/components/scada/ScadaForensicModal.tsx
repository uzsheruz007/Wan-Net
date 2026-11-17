'use client';

import { scadaAudio } from './ScadaAudio';
import type { ScadaForensicReport } from './scada-types';

interface Props {
  report: ScadaForensicReport;
  onClose: () => void;
}

export function ScadaForensicModal({ report, onClose }: Props) {
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
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            marginBottom: '20px',
            borderBottom: '1px solid var(--line)',
            paddingBottom: '16px',
          }}
        >
          <div>
            <div
              style={{
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--muted)',
                marginBottom: '4px',
              }}
            >
              <i className="fas fa-industry" style={{ marginRight: '6px', color: 'var(--cyan)' }}></i>
              OT Sanoat Insidenti Tahlili (Root Cause Analysis)
            </div>
            <h2 style={{ margin: 0, fontSize: '20px', color: 'var(--heading)' }}>
              {report.scenario_title}
            </h2>
            <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '4px' }}>
              {report.subsystem} · Protokol: {report.protocol}
            </div>
          </div>

          {/* Grade Badge */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              width: '64px',
              height: '64px',
              borderRadius: '10px',
              background: currentGrade.bg,
              border: `2px solid ${currentGrade.border}`,
              color: currentGrade.text,
              fontFamily: 'var(--font-mono)',
              fontWeight: 800,
              fontSize: '26px',
              lineHeight: 1,
              boxShadow: `0 0 20px ${currentGrade.bg}`,
              flexShrink: 0,
            }}
          >
            <span>{report.grade}</span>
            <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.05em', marginTop: '2px' }}>BAHO</span>
          </div>
        </div>

        {/* Verdict Box */}
        <div
          style={{
            padding: '14px 16px',
            borderRadius: '8px',
            background: 'rgba(255, 255, 255, 0.03)',
            borderLeft: `4px solid ${currentGrade.border}`,
            marginBottom: '20px',
          }}
        >
          <div style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Ekspertiza Xulosasi:
          </div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff', marginTop: '4px', lineHeight: '1.5' }}>
            {report.verdict}
          </div>
        </div>

        {/* Metrikalar paneli */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '12px',
            marginBottom: '20px',
          }}
        >
          <div style={{ padding: '12px', borderRadius: '6px', background: '#05090d', border: '1px solid var(--line-soft)' }}>
            <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Sarflangan vaqt</div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--heading)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
              {report.time_taken}
            </div>
          </div>
          <div style={{ padding: '12px', borderRadius: '6px', background: '#05090d', border: '1px solid var(--line-soft)' }}>
            <div style={{ fontSize: '11px', color: 'var(--muted)' }}>OT Shubha Cho‘qqisi</div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: report.threat_peak > 50 ? '#ef4444' : '#34d399', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
              {report.threat_peak}%
            </div>
          </div>
          <div style={{ padding: '12px', borderRadius: '6px', background: '#05090d', border: '1px solid var(--line-soft)' }}>
            <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Avariyalar soni</div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--heading)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
              {report.alarms_count} ta
            </div>
          </div>
          <div style={{ padding: '12px', borderRadius: '6px', background: '#05090d', border: '1px solid var(--line-soft)' }}>
            <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Ishtirokchi roli</div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: report.mode === 'red' ? '#ef4444' : '#38bdf8', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
              {report.mode === 'red' ? 'Qizil jamoa' : 'Moviy jamoa'}
            </div>
          </div>
        </div>

        {/* Fizik parametrlar yakuniy tahlili */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--heading)', marginBottom: '8px' }}>
            Yakuniy Fizik Telemetriya Ko‘rsatkichlari:
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
            {Object.entries(report.physical_summary || {}).map(([k, v]) => (
              <div
                key={k}
                style={{
                  padding: '8px 10px',
                  borderRadius: '6px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--line-soft)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11.5px',
                }}
              >
                <span style={{ color: 'var(--muted)' }}>{k}: </span>
                <span style={{ color: 'var(--cyan)', fontWeight: 600 }}>{typeof v === 'number' ? v.toFixed(1) : v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Action footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: '1px solid var(--line)',
            paddingTop: '16px',
          }}
        >
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              scadaAudio.click();
              window.print();
            }}
          >
            <i className="fas fa-print mr-1"></i> Hisobotni chop etish (PDF)
          </button>
          <button
            type="button"
            className="btn btn-solid btn-sm"
            onClick={() => {
              scadaAudio.click();
              onClose();
            }}
          >
            Yopish
          </button>
        </div>
      </div>
    </div>
  );
}
