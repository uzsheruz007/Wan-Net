'use client';

import { scadaAudio } from './ScadaAudio';
import type { ScadaState } from './scada-types';

interface Props {
  state: ScadaState;
  onCoilChange: (coilId: number, nextVal: number) => void;
}

export function ScadaGauges({ state, onCoilChange }: Props) {
  const sc = state.scenario;
  const phys = state.physical;
  const coils = state.coils;
  const holding = state.holding;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '14px',
      }}
    >
      {/* 1. ANALOG PRIBORLAR (Gauges) */}
      <div
        style={{
          background: '#09121a',
          border: '1px solid var(--line)',
          borderRadius: '10px',
          padding: '16px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)' }}>
            <i className="fas fa-gauge-high" style={{ marginRight: '6px', color: 'var(--cyan)' }}></i>
            Fizik Priborlar & Telemetriya
          </div>
          <span className="chip chip-muted" style={{ fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
            4-20mA Datchiklar
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px' }}>
          {sc === 'water' && (
            <>
              <DialGauge
                label="Quvur Bosimi"
                value={phys.pressure ?? 3.2}
                min={0}
                max={6}
                unit="Bar"
                warnThreshold={4.5}
                dangerThreshold={5.2}
              />
              <DialGauge
                label="Suv Sathi"
                value={phys.level ?? 45}
                min={0}
                max={100}
                unit="%"
                warnThreshold={85}
                dangerThreshold={95}
              />
              <DialGauge
                label="Suv pH"
                value={phys.ph ?? 7.4}
                min={0}
                max={14}
                unit="pH"
                warnThreshold={8.5}
                dangerThreshold={9.5}
              />
            </>
          )}

          {sc === 'grid' && (
            <>
              <DialGauge
                label="Tarmoq Chastotasi"
                value={phys.frequency ?? 50.0}
                min={47}
                max={53}
                unit="Hz"
                warnThreshold={50.8}
                dangerThreshold={51.5}
                decimals={2}
              />
              <DialGauge
                label="Transformator Moyi"
                value={phys.temp ?? 62}
                min={20}
                max={120}
                unit="°C"
                warnThreshold={85}
                dangerThreshold={95}
              />
              <DialGauge
                label="Shina Kuchlanishi"
                value={phys.voltage ?? 110}
                min={0}
                max={140}
                unit="kV"
                warnThreshold={125}
                dangerThreshold={132}
              />
            </>
          )}

          {sc === 'reactor' && (
            <>
              <DialGauge
                label="Santrifuga RPM"
                value={phys.rpm ?? 1400}
                min={0}
                max={3200}
                unit="RPM"
                warnThreshold={2400}
                dangerThreshold={2750}
                decimals={0}
              />
              <DialGauge
                label="Reaktor Harorati"
                value={phys.temp ?? 95}
                min={20}
                max={300}
                unit="°C"
                warnThreshold={180}
                dangerThreshold={230}
              />
              <DialGauge
                label="Qozon Bosimi"
                value={phys.pressure ?? 18}
                min={0}
                max={50}
                unit="Bar"
                warnThreshold={30}
                dangerThreshold={38}
              />
            </>
          )}
        </div>
      </div>

      {/* 2. RELE VA KLAPANLAR BOSHQARUVI (Coil Actuators) */}
      <div
        style={{
          background: '#09121a',
          border: '1px solid var(--line)',
          borderRadius: '10px',
          padding: '16px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)' }}>
            <i className="fas fa-toggle-on" style={{ marginRight: '6px', color: 'var(--acc)' }}></i>
            PLC Rele & Klapan Kalitlari (Coils)
          </div>
          <span className="chip chip-cyan" style={{ fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
            Modbus FC 05
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {sc === 'water' && (
            <>
              <CoilRow
                id={1}
                name="Nasos #1 (Inflow Pump)"
                val={coils[1] ?? 0}
                desc="Katta oqimli suv tortish agregati"
                onChange={(next) => onCoilChange(1, next)}
              />
              <CoilRow
                id={2}
                name="NaOH Ishqor Dozatori"
                val={coils[2] ?? 0}
                desc="Suv kislotaligini pasaytirish klapani"
                onChange={(next) => onCoilChange(2, next)}
              />
              <CoilRow
                id={3}
                name="Shaharga Chiqish Klapani"
                val={coils[3] ?? 0}
                desc="Aholi quvurlariga taqsimlash tarmog'i"
                onChange={(next) => onCoilChange(3, next)}
              />
              <CoilRow
                id={4}
                name="Avariya Drenaji"
                val={coils[4] ?? 0}
                desc="Zaharli yoki toshgan suvni chiqarib yuborish"
                onChange={(next) => onCoilChange(4, next)}
              />
            </>
          )}

          {sc === 'grid' && (
            <>
              <CoilRow
                id={1}
                name="Asosiy Kirish Uzgichi Q1"
                val={coils[1] ?? 0}
                desc="110kV magistral elektr kirish kontakti"
                onChange={(next) => onCoilChange(1, next)}
              />
              <CoilRow
                id={2}
                name="Shahar Shifoxonasi Q2"
                val={coils[2] ?? 0}
                desc="Kritik tibbiyot markazi fideri"
                onChange={(next) => onCoilChange(2, next)}
              />
              <CoilRow
                id={3}
                name="Sanoat Klasteri Q3"
                val={coils[3] ?? 0}
                desc="Yuqori quvvatli zavodlar fideri"
                onChange={(next) => onCoilChange(3, next)}
              />
              <CoilRow
                id={4}
                name="Aholi Turar-Joyi Q4"
                val={coils[4] ?? 0}
                desc="Shahar turar-joy massivlari fideri"
                onChange={(next) => onCoilChange(4, next)}
              />
            </>
          )}

          {sc === 'reactor' && (
            <>
              <CoilRow
                id={1}
                name="Sovutish Suvi Klapani"
                val={coils[1] ?? 0}
                desc="Reaktor ko'ylagi sovutish aylanishi"
                onChange={(next) => onCoilChange(1, next)}
              />
              <CoilRow
                id={2}
                name="Azot Avariya Purkash (N₂)"
                val={coils[2] ?? 0}
                desc="Portlash xavfini bostiruvchi inert gaz"
                onChange={(next) => onCoilChange(2, next)}
              />
              <CoilRow
                id={3}
                name="Xom-ashyo Dozalash"
                val={coils[3] ?? 0}
                desc="Polimerizatsiya reaktanti kiritish"
                onChange={(next) => onCoilChange(3, next)}
              />
              <CoilRow
                id={4}
                name="Bosim Chiqarish Klapani"
                val={coils[4] ?? 0}
                desc="Avariya holatida bug'ni havoga chiqarish"
                onChange={(next) => onCoilChange(4, next)}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ----------------- STRELKALI DIAL GAUGE KOMPONENTI -----------------
function DialGauge({
  label,
  value,
  min,
  max,
  unit,
  warnThreshold,
  dangerThreshold,
  decimals = 1,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  warnThreshold: number;
  dangerThreshold: number;
  decimals?: number;
}) {
  const clamped = Math.max(min, Math.min(max, value));
  const pct = (clamped - min) / (max - min);
  // Strelka burchagi: -120 gradusdan +120 gradusgacha (jami 240 gradus)
  const angle = -120 + pct * 240;

  const isDanger = value >= dangerThreshold;
  const isWarn = !isDanger && value >= warnThreshold;
  const valueColor = isDanger ? '#ef4444' : isWarn ? '#fbbf24' : 'var(--cyan)';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        background: '#04070a',
        border: '1px solid var(--line-soft)',
        borderRadius: '8px',
        padding: '10px 8px',
      }}
    >
      <svg width="100" height="75" viewBox="0 0 100 75">
        {/* Orqa fon doirasi */}
        <path d="M 15 65 A 40 40 0 1 1 85 65" fill="none" stroke="#1e293b" strokeWidth="6" strokeLinecap="round" />
        {/* Xavfli zona yoyi */}
        <path
          d="M 68 30 A 40 40 0 0 1 85 65"
          fill="none"
          stroke="#ef4444"
          strokeWidth="6"
          strokeLinecap="round"
          opacity="0.8"
        />
        {/* Strelka ignasi */}
        <g transform={`translate(50, 50) rotate(${angle})`}>
          <line x1="0" y1="0" x2="0" y2="-34" stroke={valueColor} strokeWidth="3" strokeLinecap="round" />
          <circle cx="0" cy="0" r="5" fill="#f8fafc" />
        </g>
      </svg>
      <div style={{ marginTop: '-4px', textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '15px', fontWeight: 700, color: valueColor }}>
          {value.toFixed(decimals)} <span style={{ fontSize: '10px', color: 'var(--muted)' }}>{unit}</span>
        </div>
        <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '2px' }}>{label}</div>
      </div>
    </div>
  );
}

// ----------------- TACTILE COIL SWITCH ROW -----------------
function CoilRow({
  id,
  name,
  val,
  desc,
  onChange,
}: {
  id: number;
  name: string;
  val: number;
  desc: string;
  onChange: (next: number) => void;
}) {
  const isOn = val === 1;

  const handleClick = () => {
    scadaAudio.click();
    onChange(isOn ? 0 : 1);
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        background: '#04070a',
        border: '1px solid var(--line-soft)',
        borderRadius: '6px',
        gap: '10px',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--heading)' }}>
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--muted)', marginRight: '6px', fontSize: '11px' }}>
            [{String(id).padStart(4, '0')}]
          </span>
          {name}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-dim)', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>
          {desc}
        </div>
      </div>

      <button
        type="button"
        onClick={handleClick}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 12px',
          borderRadius: '4px',
          border: '1px solid',
          borderColor: isOn ? 'rgba(52, 211, 153, 0.5)' : 'rgba(239, 68, 68, 0.4)',
          background: isOn ? 'rgba(52, 211, 153, 0.15)' : 'rgba(239, 68, 68, 0.12)',
          color: isOn ? '#34d399' : '#f87171',
          fontFamily: 'var(--font-mono)',
          fontSize: '11.5px',
          fontWeight: 700,
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'all 0.15s ease',
        }}
      >
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: isOn ? '#34d399' : '#ef4444',
            boxShadow: isOn ? '0 0 8px #34d399' : 'none',
          }}
        ></span>
        {isOn ? 'ON (1)' : 'OFF (0)'}
      </button>
    </div>
  );
}
