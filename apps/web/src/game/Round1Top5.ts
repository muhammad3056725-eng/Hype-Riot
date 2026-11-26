// HYPE RIOT Round 1 — TOP 5 RIOT (Blueprint §2): 25 seconds of
// rapid-fire brainstorming against the pack's full answer pool.
// Crowd Pleaser +150, Deep Cut +250, Wildcard Combo Tag = 2x HYPE.
import { AnswerMatcher, evaluateComboTag } from "@hype-riot/riot-engine";
import type { BrainstormPrompt, ComboTag } from "@hype-riot/shared-types";

export const ROUND1_SECONDS = 25;
export const HYPE_VALUES = { CROWD_PLEASER: 150, DEEP_CUT: 250 } as const;

export interface HitEvent {
  name: string;
  points: number;
  tier: "CROWD_PLEASER" | "DEEP_CUT";
  combo: boolean;
  via: "exact" | "prefix" | "typo";
}

export class Round1Top5 {
  readonly matcher: AnswerMatcher;
  readonly comboTag: ComboTag;
  score = 0;
  hits: HitEvent[] = [];
  timeLeft = ROUND1_SECONDS;
  finished = false;

  constructor(prompt: BrainstormPrompt) {
    this.matcher = new AnswerMatcher(prompt.answers);
    this.comboTag = prompt.comboTag;
  }

  /** Returns the hit event, "DUPLICATE", or null for a miss. */
  submit(raw: string): HitEvent | "DUPLICATE" | null {
    if (this.finished || !raw.trim()) return null;
    const result = this.matcher.match(raw);
    if (result.status === "miss") return null;
    if (result.status === "duplicate") return "DUPLICATE";
    const combo = evaluateComboTag(this.comboTag, result.answer);
    const points = HYPE_VALUES[result.answer.tier] * (combo ? 2 : 1);
    const event: HitEvent = {
      name: result.answer.name,
      points,
      tier: result.answer.tier,
      combo,
      via: result.via,
    };
    this.score += points;
    this.hits.push(event);
    return event;
  }

  tick(dt: number): void {
    if (this.finished) return;
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.finished = true;
    }
  }

  get foundCount(): number {
    return this.matcher.foundCount;
  }
}
