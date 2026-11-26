// HYPE RIOT Round 3 — THE ULTIMATE PITCH (Blueprint §2): combine the
// pack's two wildcard items into one 80-char pitch line. Solo/Daily
// judging uses the blueprint's Keyword-Synergy & Punchiness formula
// (packages/riot-engine PitchScorer). Party mode replaces this with
// peer voting once the relay backend exists.
import {
  ACTION_VERBS,
  scorePitch,
  type PitchScoreBreakdown,
} from "@hype-riot/riot-engine";
import type { PitchSetup } from "@hype-riot/shared-types";

export const ROUND3_SECONDS = 30;
export const PITCH_MAX_CHARS = 80;

export class Round3Pitch {
  readonly setup: PitchSetup;
  readonly seed: number;
  timeLeft = ROUND3_SECONDS;
  finished = false;
  result: PitchScoreBreakdown | null = null;

  constructor(setup: PitchSetup, seed: number) {
    this.setup = setup;
    this.seed = seed;
  }

  get promptText(): string {
    return this.setup.template
      .replace("{A}", this.setup.wildcardA)
      .replace("{B}", this.setup.wildcardB ?? "");
  }

  submit(pitch: string): PitchScoreBreakdown {
    const trimmed = pitch.slice(0, PITCH_MAX_CHARS);
    this.result = scorePitch(
      trimmed,
      this.setup.wildcardA,
      this.setup.wildcardB,
      ACTION_VERBS,
      this.seed,
    );
    this.finished = true;
    return this.result;
  }

  tick(dt: number): void {
    if (this.finished) return;
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.finished = true;
    }
  }
}
