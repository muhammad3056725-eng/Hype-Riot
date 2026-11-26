// HYPE RIOT ChiptuneSynth (Blueprint §3): procedural Web Audio
// chiptune — zero external audio files. Square/sawtooth/triangle
// oscillators, gain 0.15 with exponential decay (blueprint sketch).
export class ChiptuneSynth {
  private ctx: AudioContext | null = null;
  enabled = true;

  private ensure(): AudioContext | null {
    if (!this.enabled) return null;
    try {
      if (!this.ctx) {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return null;
        this.ctx = new AC();
      }
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return this.ctx;
    } catch {
      return null;
    }
  }

  playTone(freq: number, type: OscillatorType, duration = 0.15, when = 0, vol = 0.15): void {
    const ctx = this.ensure();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t = ctx.currentTime + when;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + duration);
  }

  hit(deepCut = false): void {
    this.playTone(deepCut ? 880 : 660, "square", 0.12);
    this.playTone(deepCut ? 1320 : 990, "square", 0.1, 0.05);
  }

  combo(): void {
    this.playTone(523, "square", 0.1);
    this.playTone(784, "square", 0.1, 0.07);
    this.playTone(1046, "square", 0.16, 0.14);
  }

  wrong(): void {
    this.playTone(160, "sawtooth", 0.22, 0, 0.12);
    this.playTone(110, "sawtooth", 0.25, 0.08, 0.12);
  }

  correct(): void {
    this.playTone(740, "triangle", 0.12);
    this.playTone(1108, "triangle", 0.14, 0.06);
  }

  tick(): void {
    this.playTone(1200, "square", 0.04, 0, 0.06);
  }

  fanfare(): void {
    const notes = [523, 659, 784, 1046, 784, 1046, 1318];
    notes.forEach((n, i) => this.playTone(n, "square", 0.16, i * 0.09));
  }

  pitchReveal(): void {
    const notes = [392, 523, 659, 784];
    notes.forEach((n, i) => this.playTone(n, "triangle", 0.14, i * 0.08));
  }
}
