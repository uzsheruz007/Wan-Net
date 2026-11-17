/**
 * 3D poligon ssenariysi va holat boshqaruvi:
 * - 3 ta ssenariy: Web DMZ & SQLi, Active Directory & Lateral Movement, Ransomware Favqulodda
 * - MITRE ATT&CK Matrix integratsiyasi va sud-tahliliy insident hisoboti (Forensics)
 * - Server tomonda tekshiriladigan dinamik flaglar va real IDS/SIEM ogohlantirishlari
 */

export type ScenarioId = 'web' | 'ad' | 'ransomware';
export type NodeId = 'attacker' | 'defender' | 'gateway' | 'waf' | 'web' | 'db';
export type CameraPreset = 'overview' | 'attacker' | 'defender' | 'waf' | 'web' | 'db' | 'map';
export type AttackKind = 'scan' | 'waf_block' | 'exploit' | 'ddos' | 'mitigate' | 'counter_block';
export type LineType = 'cmd' | 'info' | 'success' | 'warn' | 'danger';

export interface LogLine {
  id: number;
  type: LineType;
  text: string;
}

export interface MitreTechnique {
  id: string;
  name: string;
  tactic: string;
}

export interface AlertItem {
  timestamp: string;
  threat: number;
  trace?: number;
  rule_id: string;
  rule_name: string;
  reason: string;
  mitre_id?: string;
}

export interface ForensicReport {
  scenario: string;
  scenario_title: string;
  mode: 'red' | 'blue';
  grade: 'S' | 'A' | 'B' | 'C' | 'F';
  verdict: string;
  stealth_score: number;
  time_taken: string;
  threat_peak: number;
  trace_peak: number;
  alerts_triggered: number;
  mitre_techniques: MitreTechnique[];
  tactics_covered: string[];
  completed_at: string;
}

export interface ScenarioMeta {
  id: ScenarioId;
  title: string;
  network: string;
  icon: string;
  description: string;
}

export const SCENARIO_LIST: ScenarioMeta[] = [
  { id: 'web', title: 'Veb DMZ & SQLi', network: '10.0.8.0/24', icon: 'fa-globe', description: 'WAF aylanib o‘tish va ma’lumotlar bazasi eksfiltratsiyasi' },
  { id: 'ad', title: 'Active Directory', network: '172.16.10.0/24', icon: 'fa-sitemap', description: 'Kerberoasting va Pass-the-Hash orqali Domen Admin huquqi' },
  { id: 'ransomware', title: 'Ransomware Favqulodda', network: '192.168.40.0/24', icon: 'fa-biohazard', description: 'Kripto-hujumni to‘xtatish va xotiradan kalitni tiklash' },
];

export interface LabState {
  scenario: ScenarioId;
  mode: 'red' | 'blue';
  threat: number; // 0 - 100%
  trace: number; // 0 - 100% (SOC triangulation)
  time_remaining: number; // soniyalarda (masalan, 300)
  total_time: number; // 300
  is_blocked: boolean;
  block_reason?: string | null;
  alerts: AlertItem[];
  mitre_log: MitreTechnique[];
  forensic_report?: ForensicReport | null;
  scenarios?: ScenarioMeta[];
  red: {
    scanned: boolean;
    token_acquired: boolean;
    waf_tested: boolean;
    waf_bypassed: boolean;
    exploited: boolean;
    flag: string | null;
  };
  blue: {
    logs_viewed: boolean;
    target_identified: boolean;
    ip_blocked: boolean;
    patched: boolean;
    verified: boolean;
    flag: string | null;
  };
}

export const INITIAL_STATE: LabState = {
  scenario: 'web',
  mode: 'red',
  threat: 0,
  trace: 0,
  time_remaining: 300,
  total_time: 300,
  is_blocked: false,
  block_reason: null,
  alerts: [],
  mitre_log: [],
  forensic_report: null,
  red: {
    scanned: false,
    token_acquired: false,
    waf_tested: false,
    waf_bypassed: false,
    exploited: false,
    flag: null,
  },
  blue: {
    logs_viewed: false,
    target_identified: false,
    ip_blocked: false,
    patched: false,
    verified: false,
    flag: null,
  },
};

export interface NodeInfo {
  id: NodeId;
  name: string;
  ip: string;
  role: string;
  services: string;
  camera: CameraPreset;
}

export const SCENARIO_NODES: Record<ScenarioId, Record<NodeId, NodeInfo>> = {
  web: {
    attacker: { id: 'attacker', name: 'Hujumchi (Kali)', ip: '10.0.8.100', role: 'Qizil jamoa ishtirokchisi', services: 'Kali Linux · nmap · sqlmap · curl', camera: 'attacker' },
    defender: { id: 'defender', name: 'SOC Analitik (SIEM)', ip: '10.0.8.200', role: 'Moviy jamoa ishtirokchisi', services: 'SOC SIEM · Suricata IDS · iptables', camera: 'defender' },
    gateway: { id: 'gateway', name: 'Chegara routeri', ip: '10.0.8.1', role: 'WAN ↔ DMZ marshrutlash', services: '53/dns · 80/http', camera: 'overview' },
    waf: { id: 'waf', name: 'ModSecurity WAF', ip: '10.0.8.5', role: "Veb-so'rovlarni filtrlash", services: '443/https · ModSecurity CRS', camera: 'waf' },
    web: { id: 'web', name: 'Veb-server (DMZ)', ip: '10.0.8.10', role: 'Nginx + Flask ilova', services: '80/http · 8080/api', camera: 'web' },
    db: { id: 'db', name: "Ma'lumotlar bazasi", ip: '10.0.8.50', role: 'Ichki tarmoq, faqat vebdan ochiq', services: '3306/mysql · vault.users', camera: 'db' },
  },
  ad: {
    attacker: { id: 'attacker', name: 'Hujumchi (Kali AD)', ip: '172.16.10.100', role: 'Qizil jamoa (AD PenTester)', services: 'Kali · BloodHound · Impacket · Rubeus', camera: 'attacker' },
    defender: { id: 'defender', name: 'Domen Xavfsizligi', ip: '172.16.10.200', role: 'Moviy jamoa (AD SOC)', services: 'Windows Event Forwarding · Sysmon', camera: 'defender' },
    gateway: { id: 'gateway', name: 'Domen Shlyuzi', ip: '172.16.10.1', role: 'Korporativ VLAN Marshrutizator', services: 'DNS · DHCP · NAT', camera: 'overview' },
    waf: { id: 'waf', name: 'Ishchi Stansiya (FIN)', ip: '172.16.10.15', role: 'Zararlangan moliya xodimi (WKSTN-FIN01)', services: 'SMBv2 · Kerberos Ticket Cache', camera: 'waf' },
    web: { id: 'web', name: 'Domen Kontrolleri', ip: '172.16.10.5', role: 'Active Directory Domain Services (DC01)', services: '88/kerberos · 389/ldap · 445/smb', camera: 'web' },
    db: { id: 'db', name: 'Zaxira Serveri (Backup)', ip: '172.16.10.50', role: 'NTDS.dit va domen sirlari ombori', services: 'VSS · Active Directory Replica', camera: 'db' },
  },
  ransomware: {
    attacker: { id: 'attacker', name: 'Ransomware C2', ip: '192.168.40.100', role: 'Qizil jamoa (Tahdid guruhi)', services: 'C2 Server · AES Encryptor · PrivEsc', camera: 'attacker' },
    defender: { id: 'defender', name: 'Kiber-Ekspertiza (DFIR)', ip: '192.168.40.200', role: 'Moviy jamoa (Insident guruhi)', services: 'EDR Agent · Volatility Memory Forensics', camera: 'defender' },
    gateway: { id: 'gateway', name: 'Perimetr Switch', ip: '192.168.40.1', role: 'L3 Tarmoq kommutatori', services: 'VLAN Izolyatsiyasi · Flow Monitor', camera: 'overview' },
    waf: { id: 'waf', name: 'Korporativ Fayl Server', ip: '192.168.40.10', role: 'SMB Papkalar (Share-SRV01)', services: '445/smb · VSS Shadow Copies', camera: 'waf' },
    web: { id: 'web', name: 'Ilovalar Klasteri', ip: '192.168.40.20', role: 'Biznes-kritik xizmatlar klasteri', services: '8080/http · Microservices', camera: 'web' },
    db: { id: 'db', name: 'Kritik Ma’lumot Ombori', ip: '192.168.40.100', role: 'Barcha asosiy bazalar saqlanadigan xotira', services: 'SAN Storage · Shifrlash nishoni', camera: 'db' },
  },
};

export const NODES = SCENARIO_NODES.web;
export const NODE_ORDER: NodeId[] = ['attacker', 'defender', 'gateway', 'waf', 'web', 'db'];

export type Tone = 'ok' | 'info' | 'warn' | 'danger';

export function getScenarioNodes(scenario: ScenarioId): Record<NodeId, NodeInfo> {
  return SCENARIO_NODES[scenario] || SCENARIO_NODES.web;
}

/** Tugunning joriy holati (inspektor va tugunlar ro'yxati uchun) */
export function nodeStatus(id: NodeId, s: LabState): { label: string; tone: Tone } {
  if (s.is_blocked) {
    if (id === 'attacker') return { label: 'IP Bloklangan', tone: 'danger' };
    if (id === 'defender') return { label: 'Lockdown o‘rnatdi', tone: 'ok' };
    return { label: 'Himoyalangan (Lockdown)', tone: 'danger' };
  }

  if (s.mode === 'blue') {
    switch (id) {
      case 'attacker':
        return s.blue.ip_blocked ? { label: 'Bloklangan tajovuzkor', tone: 'ok' } : { label: 'Faol hujumchi', tone: 'danger' };
      case 'defender':
        return s.blue.verified ? { label: 'Tizim to‘liq himoyada', tone: 'ok' } : { label: 'Siz (SOC Analitik)', tone: 'info' };
      case 'gateway':
        return s.blue.ip_blocked ? { label: 'Hujum to‘silgan', tone: 'ok' } : { label: 'Hujum ostida', tone: 'danger' };
      case 'waf':
        return s.blue.patched ? { label: 'Zaiflik to‘silgan', tone: 'ok' } : { label: 'Filtr / Manba', tone: 'warn' };
      case 'web':
        return s.blue.patched ? { label: 'Himoyalangan', tone: 'ok' } : { label: 'Zaif tugun', tone: 'warn' };
      case 'db':
        return s.blue.verified ? { label: 'Xavfsiz', tone: 'ok' } : { label: 'Himoyalangan', tone: 'info' };
    }
  }

  // Red Team
  switch (id) {
    case 'attacker':
      return s.red.flag ? { label: 'Flag olindi', tone: 'ok' } : { label: 'Siz (Hujumchi)', tone: 'info' };
    case 'defender':
      return s.trace >= 60 ? { label: `SOC Trace: ${s.trace}%`, tone: 'danger' } : { label: 'SOC: Tinch', tone: 'ok' };
    case 'gateway':
      return s.threat >= 60 ? { label: `SIEM xavf: ${s.threat}%`, tone: 'danger' } : { label: 'Normal', tone: 'ok' };
    case 'waf':
      return s.red.waf_bypassed ? { label: 'Aylanib o‘tilgan', tone: 'warn' } : { label: 'Faol filtr', tone: 'info' };
    case 'web':
      return s.red.scanned ? { label: 'Nishon aniqlandi', tone: 'danger' } : { label: "Noma'lum", tone: 'info' };
    case 'db':
      return s.red.flag ? { label: "Ma'lumot chiqarildi", tone: 'danger' } : { label: 'Shifrlangan', tone: 'ok' };
  }
}

export interface StepItem {
  key: string;
  title: string;
  cmd: string;
  done: (s: LabState) => boolean;
}

export const RED_STEPS_BY_SCENARIO: Record<ScenarioId, StepItem[]> = {
  web: [
    { key: 'scan', title: 'Razvedka (Nmap)', cmd: 'scan', done: (s) => s.red.scanned },
    { key: 'token', title: 'Token olish', cmd: 'recon', done: (s) => s.red.token_acquired },
    { key: 'waf_test', title: 'WAF tahlili', cmd: 'waf test', done: (s) => s.red.waf_tested },
    { key: 'bypass', title: "WAF'ni aylanib o'tish", cmd: 'waf bypass', done: (s) => s.red.waf_bypassed },
    { key: 'exploit', title: 'SQLi & DB Flag', cmd: 'exploit', done: (s) => !!s.red.flag },
  ],
  ad: [
    { key: 'scan', title: 'AD Razvedka', cmd: 'scan ad', done: (s) => s.red.scanned },
    { key: 'bloodhound', title: 'BloodHound Ingest', cmd: 'bloodhound', done: (s) => s.red.token_acquired },
    { key: 'kerberoast', title: 'Kerberoast (TGS)', cmd: 'kerberoast', done: (s) => s.red.waf_tested },
    { key: 'pth', title: 'Pass-the-Hash DC', cmd: 'pass-the-hash', done: (s) => s.red.waf_bypassed },
    { key: 'domain_admin', title: 'Domain Admin & Flag', cmd: 'domain-admin', done: (s) => !!s.red.flag },
  ],
  ransomware: [
    { key: 'scan', title: 'Omborni skanerlash', cmd: 'scan', done: (s) => s.red.scanned },
    { key: 'payload', title: 'Payload yuklash', cmd: 'drop payload', done: (s) => s.red.token_acquired },
    { key: 'vss', title: 'Zaxirani o‘chirish (VSS)', cmd: 'disable-vss', done: (s) => s.red.waf_tested },
    { key: 'encrypt', title: 'AES Shifrlash', cmd: 'encrypt-shares', done: (s) => s.red.waf_bypassed },
    { key: 'ransom_note', title: 'To‘lov talabnomasi & Flag', cmd: 'ransom-note', done: (s) => !!s.red.flag },
  ],
};

export const BLUE_STEPS_BY_SCENARIO: Record<ScenarioId, StepItem[]> = {
  web: [
    { key: 'logs', title: 'Hodisalar jurnali', cmd: 'soc logs', done: (s) => s.blue.logs_viewed },
    { key: 'investigate', title: 'IP tahlili', cmd: 'investigate 198.51.100.42', done: (s) => s.blue.target_identified },
    { key: 'block', title: 'Firewall bloklash', cmd: 'block 198.51.100.42', done: (s) => s.blue.ip_blocked },
    { key: 'patch', title: 'Virtual Patch', cmd: 'patch sql', done: (s) => s.blue.patched },
    { key: 'verify', title: 'Yaxlitlik va Flag', cmd: 'verify', done: (s) => !!s.blue.flag },
  ],
  ad: [
    { key: 'logs', title: 'Event ID 4769 Auditi', cmd: 'ad logs', done: (s) => s.blue.logs_viewed },
    { key: 'investigate', title: 'Kompyuter tahlili', cmd: 'investigate 172.16.10.15', done: (s) => s.blue.target_identified },
    { key: 'isolate', title: 'Hostni uzish (Isolate)', cmd: 'isolate-pc 172.16.10.15', done: (s) => s.blue.ip_blocked },
    { key: 'krbtgt', title: 'KRBTGT Reset', cmd: 'reset-krbtgt', done: (s) => s.blue.patched },
    { key: 'verify', title: 'Domen audit & Flag', cmd: 'verify', done: (s) => !!s.blue.flag },
  ],
  ransomware: [
    { key: 'beacon', title: 'C2 Oqimini qidirish', cmd: 'hunt-beacon', done: (s) => s.blue.logs_viewed },
    { key: 'kill', title: 'Jarayonni to‘xtatish', cmd: 'kill-process crypt_agent.exe', done: (s) => s.blue.target_identified },
    { key: 'restore', title: 'Snapshot tiklash', cmd: 'vss-restore', done: (s) => s.blue.ip_blocked },
    { key: 'key', title: 'RAM Kalit qidirish', cmd: 'extract-key', done: (s) => s.blue.patched },
    { key: 'verify', title: 'Fayllarni ochish & Flag', cmd: 'verify', done: (s) => !!s.blue.flag },
  ],
};

export const RED_STEPS = RED_STEPS_BY_SCENARIO.web;
export const BLUE_STEPS = BLUE_STEPS_BY_SCENARIO.web;
export const STEPS = RED_STEPS;

export interface ActionButton {
  cmd: string;
  label: string;
  icon: string;
  tone: string;
}

export const RED_ACTIONS_BY_SCENARIO: Record<ScenarioId, ActionButton[]> = {
  web: [
    { cmd: 'scan', label: 'Skanerlash', icon: 'fa-satellite-dish', tone: 'info' },
    { cmd: 'recon', label: 'Token olish', icon: 'fa-key', tone: 'info' },
    { cmd: 'waf test', label: 'WAF sinovi', icon: 'fa-shield-halved', tone: 'warn' },
    { cmd: 'waf bypass', label: "Aylanib o'tish", icon: 'fa-code', tone: 'warn' },
    { cmd: 'stealth', label: 'Izlarni tozalash', icon: 'fa-user-ninja', tone: 'info' },
    { cmd: 'exploit', label: 'Exploit', icon: 'fa-bolt', tone: 'danger' },
    { cmd: 'ddos', label: 'DDoS (xavfli)', icon: 'fa-burst', tone: 'danger' },
  ],
  ad: [
    { cmd: 'scan ad', label: 'AD Skaner', icon: 'fa-network-wired', tone: 'info' },
    { cmd: 'bloodhound', label: 'BloodHound', icon: 'fa-diagram-project', tone: 'info' },
    { cmd: 'kerberoast', label: 'Kerberoast', icon: 'fa-ticket', tone: 'warn' },
    { cmd: 'pass-the-hash', label: 'Pass-The-Hash', icon: 'fa-key', tone: 'warn' },
    { cmd: 'stealth', label: 'Izlarni tozalash', icon: 'fa-user-ninja', tone: 'info' },
    { cmd: 'domain-admin', label: 'Domain Admin', icon: 'fa-crown', tone: 'danger' },
  ],
  ransomware: [
    { cmd: 'scan', label: 'Ombor skan', icon: 'fa-magnifying-glass', tone: 'info' },
    { cmd: 'drop payload', label: 'Payload yuklash', icon: 'fa-file-arrow-down', tone: 'warn' },
    { cmd: 'disable-vss', label: 'Zaxirani o‘chirish', icon: 'fa-trash-can', tone: 'danger' },
    { cmd: 'encrypt-shares', label: 'AES Shifrlash', icon: 'fa-lock', tone: 'danger' },
    { cmd: 'stealth', label: 'Izlarni tozalash', icon: 'fa-user-ninja', tone: 'info' },
    { cmd: 'ransom-note', label: 'To‘lov xati & Flag', icon: 'fa-skull', tone: 'danger' },
  ],
};

export const BLUE_ACTIONS_BY_SCENARIO: Record<ScenarioId, ActionButton[]> = {
  web: [
    { cmd: 'soc logs', label: 'Hodisalar jurnali', icon: 'fa-list-check', tone: 'info' },
    { cmd: 'investigate 198.51.100.42', label: 'IP tahlil', icon: 'fa-magnifying-glass', tone: 'warn' },
    { cmd: 'block 198.51.100.42', label: 'Bloklash', icon: 'fa-ban', tone: 'danger' },
    { cmd: 'patch sql', label: 'Virtual patch', icon: 'fa-wrench', tone: 'ok' },
    { cmd: 'verify', label: 'Tasdiqlash', icon: 'fa-circle-check', tone: 'ok' },
  ],
  ad: [
    { cmd: 'ad logs', label: 'Kerberos auditi', icon: 'fa-clipboard-list', tone: 'info' },
    { cmd: 'investigate 172.16.10.15', label: 'Xost tahlili', icon: 'fa-computer', tone: 'warn' },
    { cmd: 'isolate-pc 172.16.10.15', label: 'Tarmoqdan uzish', icon: 'fa-scissors', tone: 'danger' },
    { cmd: 'reset-krbtgt', label: 'KRBTGT Reset', icon: 'fa-arrows-rotate', tone: 'ok' },
    { cmd: 'verify', label: 'Tasdiqlash', icon: 'fa-shield-halved', tone: 'ok' },
  ],
  ransomware: [
    { cmd: 'hunt-beacon', label: 'C2 Oqimini izlash', icon: 'fa-radar', tone: 'warn' },
    { cmd: 'kill-process crypt_agent.exe', label: 'Jarayonni to‘xtatish', icon: 'fa-power-off', tone: 'danger' },
    { cmd: 'vss-restore', label: 'Zaxirani tiklash', icon: 'fa-clock-rotate-left', tone: 'ok' },
    { cmd: 'extract-key', label: 'RAM kalit qidiruv', icon: 'fa-microchip', tone: 'info' },
    { cmd: 'verify', label: 'Dekriptor ishga tushir', icon: 'fa-lock-open', tone: 'ok' },
  ],
};

type Out = Omit<LogLine, 'id'>;

export interface CommandResult {
  state: LabState;
  lines: Out[];
  later?: { delay: number; lines: Out[]; state?: LabState };
  attack?: AttackKind;
  focus?: NodeId;
  camera?: CameraPreset;
  clear?: boolean;
}

const info = (text: string): Out => ({ type: 'info', text });
const bad = (text: string): Out => ({ type: 'danger', text });

export const WELCOME: Out[] = [
  info('Wan-Net 3D Kiber-poligon · Next-Gen [IDS/SIEM & MITRE ATT&CK faol]'),
  info("🔴 Red Team: Zaiflikni toping, izlarni yashiring va himoyachi aniqlamasdan flagni oling."),
  info("🔵 Blue Team: 'mode blue' buyrug'i orqali himoyachi roliga o'tishingiz mumkin."),
  info("Ssenariyni o'zgartirish: 'scenario web', 'scenario ad', 'scenario ransomware'."),
  info("Boshlash uchun 'help' yoki 'scan' deb yozing."),
];

/** Server bilan aloqa: Django API orqali buyruqni bajarish */
export async function executeServerCommand(raw: string, fallbackState: LabState): Promise<CommandResult> {
  const text = raw.trim();
  const echo: Out = {
    type: 'cmd',
    text: fallbackState.mode === 'blue' ? `defender@soc-center:~$ ${text}` : `operator@kali:~$ ${text}`,
  };

  if (text.toLowerCase() === 'clear') {
    return { state: fallbackState, lines: [], clear: true };
  }

  try {
    const res = await fetch('/api/lab3d/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'command', command: text }),
    });

    if (res.ok) {
      const data = await res.json();
      const updatedState = data.state as LabState;
      const lines = [echo, ...(data.lines || [])];
      return {
        state: updatedState,
        lines,
        attack: data.attack,
        focus: data.focus,
        camera: data.camera,
        later: data.later,
      };
    }
  } catch {
    // pass
  }

  return runCommandLocal(raw, fallbackState);
}

/** Holatni serverdan olish */
export async function fetchServerState(): Promise<LabState | null> {
  try {
    const res = await fetch('/api/lab3d/?action=state');
    if (res.ok) {
      const data = await res.json();
      if (data.ok && data.state) return data.state as LabState;
    }
  } catch {
    // pass
  }
  return null;
}

/** Ssenariyni serverda almashtirish */
export async function switchServerScenario(scenario: ScenarioId): Promise<LabState> {
  try {
    const res = await fetch('/api/lab3d/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'switch_scenario', scenario }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.state) return data.state as LabState;
    }
  } catch {
    // pass
  }
  return { ...INITIAL_STATE, scenario };
}

/** Serverda holatni qayta tiklash (Reset) */
export async function resetServerState(mode: 'red' | 'blue' = 'red', scenario: ScenarioId = 'web'): Promise<LabState> {
  try {
    const res = await fetch('/api/lab3d/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reset', mode, scenario }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.state) return data.state as LabState;
    }
  } catch {
    // pass
  }
  return { ...INITIAL_STATE, mode, scenario };
}

/** Serverda rejimni almashtirish */
export async function switchServerMode(mode: 'red' | 'blue'): Promise<LabState> {
  try {
    const res = await fetch('/api/lab3d/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'switch_mode', mode }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.state) return data.state as LabState;
    }
  } catch {
    // pass
  }
  return INITIAL_STATE;
}

/** Zaxira lokal bajaruvchi (server uzilib qolsa) */
function runCommandLocal(raw: string, s: LabState): CommandResult {
  const text = raw.trim();
  const echo: Out = { type: 'cmd', text: `operator@kali:~$ ${text}` };
  return {
    state: s,
    lines: [echo, bad("Server bilan aloqa uzildi. Iltimos, qayta urinib ko'ring.")],
  };
}

export function runCommand(raw: string, s: LabState): CommandResult {
  return runCommandLocal(raw, s);
}
