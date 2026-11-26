// HYPE RIOT Round 3 — THE ULTIMATE PITCH: combine two wildcards into one
// pitch line (80 chars, 30 seconds). Judged by riot-engine's PitchScorer;
// whatever is typed when the timer ends is submitted automatically.
import { ACTION_VERBS, PITCH_MAX_CHARS, scorePitch, type PitchScoreBreakdown } from "@hype-riot/riot-engine";
import type { PitchSetup } from "@hype-riot/shared-types";

export const ROUND3_SECONDS = 30;
export { PITCH_MAX_CHARS };

export class Round3Pitch {
  readonly setup: PitchSetup;
  readonly seed: number;
  private readonly endsAt: number;
  result: PitchScoreBreakdown | null = null;
  pitchText = "";

  constructor(setup: PitchSetup, seed: number, now: number) {
    this.setup = setup;
    this.seed = seed;
    this.endsAt = now + ROUND3_SECONDS * 1000;
  }

  get promptText(): string {
    return this.setup.template.replace("{A}", this.setup.wildcardA).replace("{B}", this.setup.wildcardB);
  }

  remaining(now: number): number {
    return this.result ? 0 : Math.max(0, (this.endsAt - now) / 1000);
  }

  isOver(now: number): boolean {
    return this.result !== null || now >= this.endsAt;
  }

  submit(pitch: string): PitchScoreBreakdown {
    if (this.result) return this.result;
    this.pitchText = pitch.replace(/\s+/g, " ").trim().slice(0, PITCH_MAX_CHARS);
    this.result = scorePitch(this.pitchText, this.setup.wildcardA, this.setup.wildcardB, ACTION_VERBS, this.seed);
    return this.result;
  }
}
