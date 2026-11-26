// HYPE RIOT Round 1 — TOP 5 RIOT: 25 seconds (45 in Brainstorm Blitz)
// of rapid-fire answers against the prompt's 30-60 answer pool.
// Crowd Pleaser +150, Deep Cut +250, combo tag = 2x. Timers are
// wall-clock deadlines (performance.now() ms), so a hidden tab or a slow
// frame never stretches the round.
import { AnswerMatcher, displayName, evaluateComboTag, type MatchVia } from "@hype-riot/riot-engine";
import type { BrainstormAnswer, BrainstormPrompt, Tier } from "@hype-riot/shared-types";

export const ROUND1_SECONDS = 25;
export const BLITZ_SECONDS = 45;
export const HYPE_VALUES: Record<Tier, number> = { CROWD_PLEASER: 150, DEEP_CUT: 250 };
export const TOP_N = 10;

export interface HitEvent {
  answer: BrainstormAnswer;
  name: string; // display name
  points: number;
  tier: Tier;
  combo: boolean;
  via: MatchVia;
  topTen: boolean;
}

export class Round1Top5 {
  readonly prompt: BrainstormPrompt;
  readonly matcher: AnswerMatcher;
  readonly seconds: number;
  private readonly endsAt: number;
  private endedEarly = false;
  score = 0;
  hits: HitEvent[] = [];

  constructor(prompt: BrainstormPrompt, now: number, seconds = ROUND1_SECONDS) {
    this.prompt = prompt;
    this.matcher = new AnswerMatcher(prompt.answers);
    this.seconds = seconds;
    this.endsAt = now + seconds * 1000;
  }

  remaining(now: number): number {
    return this.endedEarly ? 0 : Math.max(0, (this.endsAt - now) / 1000);
  }

  isOver(now: number): boolean {
    return this.remaining(now) <= 0;
  }

  endNow(): void {
    this.endedEarly = true;
  }

  get topFound(): number {
    return this.hits.filter((h) => h.topTen).length;
  }

  /** Returns the hit, "DUPLICATE", or null for a miss / finished round. */
  submit(raw: string, now: number): HitEvent | "DUPLICATE" | null {
    if (this.isOver(now) || !raw.trim()) return null;
    const result = this.matcher.match(raw);
    if (result.status === "miss") return null;
    if (result.status === "duplicate") return "DUPLICATE";
    const a = result.answer;
    const combo = evaluateComboTag(this.prompt.comboTag, a.name);
    const points = HYPE_VALUES[a.tier] * (combo ? 2 : 1);
    const event: HitEvent = {
      answer: a,
      name: displayName(a.name),
      points,
      tier: a.tier,
      combo,
      via: result.via,
      topTen: a.rank < TOP_N,
    };
    this.score += points;
    this.hits.push(event);
    return event;
  }
}
