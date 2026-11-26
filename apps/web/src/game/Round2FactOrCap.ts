// HYPE RIOT Round 2 — FACT OR CAP?! (Blueprint §2): 28 seconds,
// 4 questions x 7 seconds. Claim Smash (FACT/CAP), Stream/Stat Clash
// (pick the bigger number), Pixel Zoom-Out (sprite de-pixelates at
// 20%/second). Streak multipliers: 2 in a row = 1.5x, 3+ = 2.0x.
import type { FactOrCapCard } from "@hype-riot/shared-types";

export const ROUND2_SECONDS = 28;
export const SECONDS_PER_CARD = 7;
export const BASE_POINTS = 400;

export function streakMultiplier(streak: number): number {
  if (streak >= 3) return 2.0;
  if (streak === 2) return 1.5;
  return 1.0;
}

export interface CardResult {
  card: FactOrCapCard;
  correct: boolean;
  points: number;
  streakAfter: number;
}

export class Round2FactOrCap {
  readonly cards: FactOrCapCard[];
  index = 0;
  cardTimeLeft = SECONDS_PER_CARD;
  streak = 0;
  bestStreak = 0;
  score = 0;
  results: CardResult[] = [];
  finished = false;

  constructor(cards: FactOrCapCard[]) {
    this.cards = cards.slice(0, 4);
    if (this.cards.length < 4) this.finished = true;
  }

  get current(): FactOrCapCard | null {
    return this.finished ? null : this.cards[this.index];
  }

  /** Zoom reveal fraction for the current card (0 = fully pixelated). */
  get zoomReveal(): number {
    return 1 - this.cardTimeLeft / SECONDS_PER_CARD;
  }

  private resolve(correct: boolean): CardResult {
    const card = this.cards[this.index];
    this.streak = correct ? this.streak + 1 : 0;
    this.bestStreak = Math.max(this.bestStreak, this.streak);
    const points = correct
      ? Math.round(BASE_POINTS * streakMultiplier(this.streak))
      : 0;
    this.score += points;
    const result: CardResult = { card, correct, points, streakAfter: this.streak };
    this.results.push(result);
    this.index += 1;
    this.cardTimeLeft = SECONDS_PER_CARD;
    if (this.index >= this.cards.length) this.finished = true;
    return result;
  }

  /** Claim Smash answer: true = player tapped FACT. */
  answerClaim(saysFact: boolean): CardResult | null {
    const card = this.current;
    if (!card || card.type !== "CLAIM") return null;
    return this.resolve(saysFact === card.isFact);
  }

  /** Clash answer: "A" or "B". */
  answerClash(pick: "A" | "B"): CardResult | null {
    const card = this.current;
    if (!card || card.type !== "CLASH") return null;
    const correctPick = card.aValue >= card.bValue ? "A" : "B";
    return this.resolve(pick === correctPick);
  }

  /** Zoom answer: the tapped option string. */
  answerZoom(option: string): CardResult | null {
    const card = this.current;
    if (!card || card.type !== "ZOOM") return null;
    return this.resolve(option === card.answer);
  }

  tick(dt: number): CardResult | null {
    if (this.finished) return null;
    this.cardTimeLeft -= dt;
    if (this.cardTimeLeft <= 0) {
      // time out = wrong answer, streak resets
      return this.resolve(false);
    }
    return null;
  }
}
