// HYPE RIOT procedural sound: Web Audio blips and stings plus a filtered
// noise "crowd roar" — zero audio files. The AudioContext is created on
// the first sound after a user gesture and suspended when the tab hides.
export class ChiptuneSynth {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  enabled = true;

  private ensure(): AudioContext | null {
    if (!this.enabled) return null;
    try {
      if (!this.ctx) {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return null;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.7;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return this.ctx;
    } catch {
      return null;
    }
  }

  suspend(): void {
    if (this.ctx && this.ctx.state === "running") void this.ctx.suspend();
  }

  private tone(freq: number, type: OscillatorType, duration = 0.15, when = 0, vol = 0.12, slideTo?: number): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t = ctx.currentTime + when;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + duration);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  /** Filtered noise burst — a crowd roar (cheer) or murmur (boo). */
  crowd(kind: "cheer" | "boo", strength = 1): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    if (!this.noise) {
      const len = ctx.sampleRate * 2;
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = kind === "cheer" ? 1400 : 320;
    filter.Q.value = kind === "cheer" ? 0.6 : 1.4;
    const gain = ctx.createGain();
    const t = ctx.currentTime;
    const dur = kind === "cheer" ? 1.4 : 1.1;
    const peak = 0.09 * strength;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  hit(deepCut = false): void {
    this.tone(deepCut ? 880 : 660, "square", 0.1, 0, 0.08);
    this.tone(deepCut ? 1320 : 990, "triangle", 0.14, 0.05, 0.1);
  }

  combo(): void {
    [523, 784, 1046, 1318].forEach((f, i) => this.tone(f, "square", 0.12, i * 0.06, 0.07));
  }

  miss(): void {
    this.tone(220, "triangle", 0.12, 0, 0.06, 180);
  }

  wrong(): void {
    this.tone(180, "sawtooth", 0.25, 0, 0.08, 90);
  }

  correct(): void {
    this.tone(740, "triangle", 0.1, 0, 0.1);
    this.tone(1108, "triangle", 0.16, 0.07, 0.1);
  }

  tick(): void {
    this.tone(1400, "square", 0.035, 0, 0.04);
  }

  whoosh(): void {
    this.tone(200, "sawtooth", 0.35, 0, 0.05, 1200);
  }

  fanfare(): void {
    [523, 659, 784, 1046, 784, 1046, 1318].forEach((n, i) => this.tone(n, "square", 0.16, i * 0.09, 0.07));
  }

  pitchReveal(): void {
    [392, 523, 659, 784].forEach((n, i) => this.tone(n, "triangle", 0.14, i * 0.08, 0.1));
  }
}
