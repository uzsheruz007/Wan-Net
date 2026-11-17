/**
 * Web Audio API orqali dasturiy (procedural) tovushlar generatori.
 * Hech qanday tashqi audio fayl talab qilinmaydi — brauzerda to'g'ridan-to'g'ri sintezlanadi.
 */
class CyberAudioEngine {
  private ctx: AudioContext | null = null;
  private ambientGain: GainNode | null = null;
  private masterGain: GainNode | null = null;
  private isMuted: boolean = false;
  private isInitialized: boolean = false;

  private init() {
    if (this.isInitialized && this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.35, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
      this.isInitialized = true;
    } catch {
      // AudioContext ruxsati yoki brauzer cheklovi bo'lsa indamaydi
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(muted ? 0 : 0.35, this.ctx.currentTime);
    }
    if (this.ambientGain && this.ctx) {
      this.ambientGain.gain.setValueAtTime(muted ? 0 : 0.08, this.ctx.currentTime);
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  /** Server xonasi sovutgich va fon shovqini */
  public startAmbient() {
    this.init();
    if (!this.ctx || !this.masterGain || this.ambientGain) return;
    try {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }

      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.setValueAtTime(this.isMuted ? 0 : 0.07, this.ctx.currentTime);
      this.ambientGain.connect(this.masterGain);

      // Past chastotali asosiy server g'uvillashi (60Hz va 120Hz)
      const osc1 = this.ctx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(58, this.ctx.currentTime);

      const osc2 = this.ctx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(116, this.ctx.currentTime);

      // Server fan shovqini filtri
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(260, this.ctx.currentTime);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(this.ambientGain);

      osc1.start();
      osc2.start();
    } catch {
      // e'tiborsiz qoldirish
    }
  }

  /** Tugma / obyekt tanlanganda qisqa cyber-chirp */
  public click(freq = 880) {
    this.playClick(freq);
  }

  public playClick(freq = 880) {
    this.init();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, now + 0.06);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.07);
    } catch {
      // pass
    }
  }

  /** Radar / Sonar skanerlash tovushi */
  public playScan() {
    this.init();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(1400, now + 0.35);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.linearRampToValueAtTime(0.2, now + 0.2);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.4);
    } catch {
      // pass
    }
  }

  /** Lazer hujumi / exploit paketi tovushi */
  public playAttack() {
    this.init();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(950, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.25);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.26);
    } catch {
      // pass
    }
  }

  /** WAF xavfsizlik qalqoni to'sqinligi (deflection) */
  public playShieldDeflect() {
    this.init();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'square';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.linearRampToValueAtTime(80, now + 0.2);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(600, now);
      filter.Q.setValueAtTime(4, now);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.22);
    } catch {
      // pass
    }
  }

  /** Favqulodda signal / DDoS ogohlantirish sirena */
  public playAlarm() {
    this.init();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      for (let i = 0; i < 2; i++) {
        const offset = i * 0.3;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800, now + offset);
        osc.frequency.linearRampToValueAtTime(600, now + offset + 0.25);

        gain.gain.setValueAtTime(0.16, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.28);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now + offset);
        osc.stop(now + offset + 0.28);
      }
    } catch {
      // pass
    }
  }

  /** Flag qo'lga kiritilganda / g'alaba akkordi */
  public playVictory() {
    this.init();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const notes = [440, 554.37, 659.25, 880, 1108.73]; // A-dur arpeggio
      notes.forEach((freq, idx) => {
        if (!this.ctx || !this.masterGain) return;
        const noteStart = now + idx * 0.09;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, noteStart);

        gain.gain.setValueAtTime(0.18, noteStart);
        gain.gain.exponentialRampToValueAtTime(0.001, noteStart + 0.6);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(noteStart);
        osc.stop(noteStart + 0.65);
      });
    } catch {
      // pass
    }
  }

  private heartbeatTimer: number | null = null;

  /** Vaqt tugayotganda (kritik vaziyatda) sub-bas yurak urishi */
  public startHeartbeat(fast = false) {
    if (this.heartbeatTimer) return;
    const interval = fast ? 650 : 1000;
    const beat = () => {
      this.init();
      if (!this.ctx || !this.masterGain || this.isMuted) return;
      try {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(52, now);
        osc.frequency.exponentialRampToValueAtTime(26, now + 0.16);
        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.2);
      } catch {
        // pass
      }
    };
    beat();
    this.heartbeatTimer = window.setInterval(beat, interval);
  }

  public stopHeartbeat() {
    if (this.heartbeatTimer) {
      window.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}

export const cyberAudio = new CyberAudioEngine();
