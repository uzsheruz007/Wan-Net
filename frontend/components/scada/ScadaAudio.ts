/**
 * SCADA & Sanoat Tizimlari Audio Sintezatori (Web Audio API)
 * - 50Hz sanoat g'uvillashi va nasos vibratsiyasi
 * - Rele va avtomatik uzgichlarning (Breaker) mexanik ovozi
 * - Pnevmatik bosim chiqishi / bug' shovqini
 * - Avariya sanoat sirenasi (Two-tone Industrial Alarm)
 */

class ScadaAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private sirenTimer: number | null = null;
  private isMuted = true;

  private init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.6, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    } catch {
      // Audio context brauzer cheklovi
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(muted ? 0 : 0.6, this.ctx.currentTime);
    }
    if (this.ambientGain && this.ctx) {
      this.ambientGain.gain.setValueAtTime(muted ? 0 : 0.08, this.ctx.currentTime);
    }
    if (muted) {
      this.stopSiren();
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public click() {
    this.init();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(750, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.05);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.06);
    } catch {
      // pass
    }
  }

  /** Sanoat foni: 50Hz tarmoq chastotasi g'uvillashi */
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

      // 50Hz asosiy transformator chastotasi
      const osc1 = this.ctx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(50, this.ctx.currentTime);

      // 100Hz 2-garmonika
      const osc2 = this.ctx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(100, this.ctx.currentTime);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(220, this.ctx.currentTime);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(this.ambientGain);

      osc1.start();
      osc2.start();
    } catch {
      // pass
    }
  }

  /** Mexanik rele / avtomatik uzgich (Breaker Q1-Q4) o'chirilishi ovozi */
  public playBreakerClick() {
    this.init();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(35, now + 0.12);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.14);
    } catch {
      // pass
    }
  }

  /** Pnevmatik klapan ochilishi va bosimli gaz/bug' chiqishi */
  public playPneumaticVent() {
    this.init();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const bufferSize = this.ctx.sampleRate * 0.35;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1800, now);
      filter.Q.setValueAtTime(3.0, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      noise.start(now);
    } catch {
      // pass
    }
  }

  /** Sanoat falokat sirenasi (Two-tone rotating alarm) */
  public startSiren() {
    if (this.sirenTimer || this.isMuted) return;
    let highTone = true;
    const tone = () => {
      this.init();
      if (!this.ctx || !this.masterGain || this.isMuted) return;
      try {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(highTone ? 880 : 660, now);
        osc.frequency.linearRampToValueAtTime(highTone ? 920 : 620, now + 0.38);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.linearRampToValueAtTime(0.15, now + 0.35);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.4);
        highTone = !highTone;
      } catch {
        // pass
      }
    };
    tone();
    this.sirenTimer = window.setInterval(tone, 450);
  }

  public stopSiren() {
    if (this.sirenTimer) {
      window.clearInterval(this.sirenTimer);
      this.sirenTimer = null;
    }
  }
}

export const scadaAudio = new ScadaAudioEngine();
