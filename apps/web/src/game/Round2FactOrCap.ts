// HYPE RIOT Round 2 — FACT OR CAP?!: 4 cards x 7 seconds. Claim (FACT /
// CAP), Clash (pick A or B — "max" or "min" questions), Zoom-in mystery
// (emoji pulls back from extreme close-up). Streak: 2 in a row = 1.5x,
// 3+ = 2x. After every answer or timeout a short reveal shows the right
// answer (input is locked, so a double-tap can't answer the next card).
import type { ClashCard, FactOrCapCard } from "@hype-riot/shared-types";

export const SECONDS_PER_CARD = 7;
export const REVEAL_MS = 1300;
export const BASE_POINTS = 400;

export function streakMultiplier(streak: number): number {
  if (streak >= 3) return 2.0;
  if (streak === 2) return 1.5;
  return 1.0;
}

export function clashWinner(card: ClashCard): "A" | "B" {
  const aWins = card.mode === "max" ? card.aValue > card.bValue : card.aValue < card.bValue;
  return aWins ? "A" : "B";
}

/** The correct option, as display text. */
export function correctAnswerText(card: FactOrCapCard): string {
  if (card.type === "CLAIM") return card.isFact ? "FACT" : "CAP";
  if (card.type === "CLASH") return clashWinner(card) === "A" ? card.a : card.b;
  return card.answer;
}

export interface CardResult {
  card: FactOrCapCard;
  correct: boolean;
  timedOut: boolean;
  picked: string | null;
  points: number;
  streakAfter: number;
}

export type Round2Phase = "ask" | "reveal" | "done";

export class Round2FactOrCap {
  readonly cards: FactOrCapCard[];
  index = 0;
  phase: Round2Phase = "ask";
  streak = 0;
  bestStreak = 0;
  score = 0;
  results: CardResult[] = [];
  private deadline: number;
  private revealUntil = 0;
  private cardStart: number;

  constructor(cards: FactOrCapCard[], now: number) {
    this.cards = cards.slice(0, 4);
    this.cardStart = now;
    this.deadline = now + SECONDS_PER_CARD * 1000;
    if (this.cards.length === 0) this.phase = "done";
  }

  get finished(): boolean {
    return this.phase === "done";
  }

  get current(): FactOrCapCard | null {
    return this.phase === "done" ? null : this.cards[this.index];
  }

  get lastResult(): CardResult | null {
    return this.results[this.results.length - 1] ?? null;
  }

  cardRemaining(now: number): number {
    return this.phase === "ask" ? Math.max(0, (this.deadline - now) / 1000) : 0;
  }

  /** 0 = fully zoomed/blurred, 1 = fully revealed. */
  zoomReveal(now: number): number {
    if (this.phase !== "ask") return 1;
    return Math.min(1, Math.max(0, (now - this.cardStart) / (SECONDS_PER_CARD * 1000)));
  }

  private resolve(correct: boolean, picked: string | null, now: number, timedOut = false): CardResult {
    const card = this.cards[this.index];
    this.streak = correct ? this.streak + 1 : 0;
    this.bestStreak = Math.max(this.bestStreak, this.streak);
    const points = correct ? Math.round(BASE_POINTS * streakMultiplier(this.streak)) : 0;
    this.score += points;
    const result: CardResult = { card, correct, timedOut, picked, points, streakAfter: this.streak };
    this.results.push(result);
    this.phase = "reveal";
    this.revealUntil = now + REVEAL_MS;
    return result;
  }

  answerClaim(saysFact: boolean, now: number): CardResult | null {
    const card = this.current;
    if (this.phase !== "ask" || !card || card.type !== "CLAIM") return null;
    return this.resolve(saysFact === card.isFact, saysFact ? "FACT" : "CAP", now);
  }

  answerClash(pick: "A" | "B", now: number): CardResult | null {
    const card = this.current;
    if (this.phase !== "ask" || !card || card.type !== "CLASH") return null;
    return this.resolve(pick === clashWinner(card), pick === "A" ? card.a : card.b, now);
  }

  answerZoom(option: string, now: number): CardResult | null {
    const card = this.current;
    if (this.phase !== "ask" || !card || card.type !== "ZOOM") return null;
    return this.resolve(option === card.answer, option, now);
  }

  /**
   * Advances wall-clock state. Returns what happened, in order: timeouts
   * ("timeout" results) and card changes ("next"). Long gaps (a hidden
   * tab) are processed card by card.
   */
  update(now: number): Array<{ kind: "timeout"; result: CardResult } | { kind: "next" }> {
    const events: Array<{ kind: "timeout"; result: CardResult } | { kind: "next" }> = [];
    for (let guard = 0; guard < 16 && this.phase !== "done"; guard++) {
      if (this.phase === "ask" && now >= this.deadline) {
        events.push({ kind: "timeout", result: this.resolve(false, null, this.deadline, true) });
        continue;
      }
      if (this.phase === "reveal" && now >= this.revealUntil) {
        this.index += 1;
        if (this.index >= this.cards.length) {
          this.phase = "done";
        } else {
          this.phase = "ask";
          this.cardStart = this.revealUntil;
          this.deadline = this.revealUntil + SECONDS_PER_CARD * 1000;
        }
        events.push({ kind: "next" });
        continue;
      }
      break;
    }
    return events;
  }
}
