// HYPE RIOT hype meter (0-100): rises with hits, combos and correct
// calls, drops on misses and timeouts, and slowly cools toward a resting
// level. It drives the crowd (cheer waves, glowsticks, boos) and its
// peak pays a crowd bonus at the end of the match.

export const HYPE_REST = 25;

export class HypeMeter {
  value = HYPE_REST;
  peak = HYPE_REST;

  reset(): void {
    this.value = HYPE_REST;
    this.peak = HYPE_REST;
  }

  add(delta: number): void {
    this.value = Math.max(0, Math.min(100, this.value + delta));
    this.peak = Math.max(this.peak, this.value);
  }

  /** Cools toward HYPE_REST at ~3 points/second. */
  update(dt: number): void {
    const step = 3 * dt;
    if (this.value > HYPE_REST) this.value = Math.max(HYPE_REST, this.value - step);
    else if (this.value < HYPE_REST) this.value = Math.min(HYPE_REST, this.value + step * 0.5);
  }

  /** 0..1 energy for the renderer. */
  get energy(): number {
    return this.value / 100;
  }
}
