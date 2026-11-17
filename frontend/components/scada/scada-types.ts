export type ScadaScenarioId = 'water' | 'grid' | 'reactor';
export type ScadaDifficultyId = 'normal' | 'hard' | 'nightmare';

export interface ScadaDifficultyMeta {
  id: ScadaDifficultyId;
  label: string;
  tag: string;
  desc: string;
  time: number;
}

export const SCADA_DIFFICULTY_LIST: ScadaDifficultyMeta[] = [
  { id: 'normal', label: 'Normal', tag: 'OT-SOC: passiv', desc: "O'rganish rejimi: IDS kuzatadi, lekin aralashmaydi.", time: 360 },
  { id: 'hard', label: 'Qiyin', tag: 'OT-SOC: faol', desc: "Tizim beqaror: parametrlar o'z-o'zidan xavf tomon suriladi, vaqt kam.", time: 240 },
  { id: 'nightmare', label: 'Koshmar', tag: 'OT-SOC: avtomatik', desc: 'IDS avtomatik javob beradi: shubha oshsa, klapanlaringizni qaytaradi.', time: 180 },
];

export interface ScadaAlarm {
  code: string;
  severity: 'INFO' | 'WARN' | 'CRITICAL';
  message: string;
  time: string;
}

export interface ScadaScenarioMeta {
  id: ScadaScenarioId;
  title: string;
  subsystem: string;
  protocol: string;
  icon: string;
  red_goal: string;
  blue_goal: string;
  registers_doc: {
    coils: Record<number, string>;
    holding: Record<number, string>;
  };
}

export interface ScadaForensicReport {
  scenario: string;
  scenario_title: string;
  subsystem: string;
  protocol: string;
  mode: 'red' | 'blue';
  difficulty?: string;
  grade: 'S' | 'A' | 'B' | 'C' | 'F';
  verdict: string;
  threat_peak: number;
  time_taken: string;
  alarms_count: number;
  physical_summary: Record<string, number>;
  completed_at: string;
}

export interface ScadaState {
  scenario: ScadaScenarioId;
  mode: 'red' | 'blue';
  difficulty: ScadaDifficultyId;
  ids_active?: boolean;
  physical: Record<string, number>;
  coils: Record<number, number>;
  holding: Record<number, number>;
  threat: number;
  time_remaining: number;
  total_time: number;
  is_tripped: boolean;
  is_disaster: boolean;
  disaster_reason?: string | null;
  is_mitigated: boolean;
  replay_active: boolean;
  alarms: ScadaAlarm[];
  forensic_report?: ScadaForensicReport | null;
  red_flag?: string | null;
  blue_flag?: string | null;
  scenarios?: ScadaScenarioMeta[];
  difficulties?: ScadaDifficultyMeta[];
}

export interface ScadaLogLine {
  id: number;
  type: 'cmd' | 'info' | 'success' | 'warn' | 'danger';
  text: string;
}

export const SCADA_SCENARIO_LIST: { id: ScadaScenarioId; title: string; icon: string; tag: string }[] = [
  { id: 'water', title: 'AquaPure Suv Tozalash', icon: 'fa-faucet-drip', tag: 'PLC-01 // Modbus TCP' },
  { id: 'grid', title: '110kV Elektr Podstansiyasi', icon: 'fa-bolt', tag: 'Substation // DNP3' },
  { id: 'reactor', title: 'Kimyoviy Reaktor & Santrifuga', icon: 'fa-atom', tag: 'Siemens S7 // 102' },
];

export const INITIAL_SCADA_STATE: ScadaState = {
  scenario: 'water',
  mode: 'red',
  difficulty: 'normal',
  ids_active: false,
  physical: { level: 45, pressure: 3.2, ph: 7.4, chlorine: 1.5, inflow: 110, outflow: 100 },
  coils: { 1: 1, 2: 0, 3: 1, 4: 0 },
  holding: { 40001: 45, 40002: 32, 40003: 74, 40004: 15, 40005: 1 },
  threat: 0,
  time_remaining: 360,
  total_time: 360,
  is_tripped: false,
  is_disaster: false,
  disaster_reason: null,
  is_mitigated: false,
  replay_active: false,
  alarms: [],
  forensic_report: null,
  red_flag: null,
  blue_flag: null,
};

export async function fetchScadaState(): Promise<ScadaState | null> {
  try {
    const res = await fetch('/api/scada/?action=state');
    if (res.ok) {
      const data = await res.json();
      if (data.ok && data.state) return data.state as ScadaState;
    }
  } catch {
    // pass
  }
  return null;
}

export async function executeScadaCommand(
  rawCmd: string,
): Promise<{ ok: boolean; lines: { type: 'cmd' | 'info' | 'success' | 'warn' | 'danger'; text: string }[]; state?: ScadaState }> {
  try {
    const res = await fetch('/api/scada/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'command', command: rawCmd }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // pass
  }
  return {
    ok: false,
    lines: [
      { type: 'cmd', text: rawCmd },
      { type: 'danger', text: 'SCADA PLC serveriga ulanishda xatolik yuz berdi.' },
    ],
  };
}

export async function switchScadaScenario(scenario: ScadaScenarioId): Promise<ScadaState> {
  try {
    const res = await fetch('/api/scada/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'switch_scenario', scenario }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.ok && data.state) return data.state as ScadaState;
    }
  } catch {
    // pass
  }
  return { ...INITIAL_SCADA_STATE, scenario };
}

export async function switchScadaMode(mode: 'red' | 'blue'): Promise<ScadaState> {
  try {
    const res = await fetch('/api/scada/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'switch_mode', mode }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.ok && data.state) return data.state as ScadaState;
    }
  } catch {
    // pass
  }
  return { ...INITIAL_SCADA_STATE, mode };
}

export async function switchScadaDifficulty(difficulty: ScadaDifficultyId): Promise<ScadaState> {
  try {
    const res = await fetch('/api/scada/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'switch_difficulty', difficulty }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.ok && data.state) return data.state as ScadaState;
    }
  } catch {
    // pass
  }
  return { ...INITIAL_SCADA_STATE, difficulty };
}

export async function resetScadaState(mode: 'red' | 'blue' = 'red', scenario: ScadaScenarioId = 'water'): Promise<ScadaState> {
  try {
    const res = await fetch('/api/scada/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reset', mode, scenario }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.ok && data.state) return data.state as ScadaState;
    }
  } catch {
    // pass
  }
  return { ...INITIAL_SCADA_STATE, mode, scenario };
}
