// HYPE RIOT progression: rank tiers + Hype Coins.
// Coins = floor(total / 100) + victory bonus + (first scored Daily of a
// date only) streak days x 15. Practice replays of a played Daily earn 0.

export type RankTier =
  | "ROOKIE SPECTATOR" | "MEME SCOUT" | "TRIVIA HUSTLER"
  | "COMBO STRIKER" | "ARENA HEADLINER" | "HYPE LEGEND";

export const TIERS: Array<{ tier: RankTier; xp: number }> = [
  { tier: "ROOKIE SPECTATOR", xp: 0 },
  { tier: "MEME SCOUT", xp: 5000 },
  { tier: "TRIVIA HUSTLER", xp: 15000 },
  { tier: "COMBO STRIKER", xp: 35000 },
  { tier: "ARENA HEADLINER", xp: 75000 },
  { tier: "HYPE LEGEND", xp: 150000 },
];

export function tierForXp(xp: number): RankTier {
  let current: RankTier = "ROOKIE SPECTATOR";
  for (const t of TIERS) if (xp >= t.xp) current = t.tier;
  return current;
}

/** Progress (0..1) toward the next tier, plus its name (null at the top). */
export function tierProgress(xp: number): { next: RankTier | null; progress: number } {
  for (let i = 1; i < TIERS.length; i++) {
    if (xp < TIERS[i].xp) {
      const lo = TIERS[i - 1].xp;
      return { next: TIERS[i].tier, progress: (xp - lo) / (TIERS[i].xp - lo) };
    }
  }
  return { next: null, progress: 1 };
}

export const QUICK_VICTORY_SCORE = 3500;
export const VICTORY_BONUS = 25;
export const STREAK_COINS_PER_DAY = 15;

export function hypeCoins(totalHype: number, streakBonusDays: number, victoryBonus = 0): number {
  return Math.floor(Math.max(0, totalHype) / 100) + streakBonusDays * STREAK_COINS_PER_DAY + victoryBonus;
}

/** Crowd bonus at the end of a match: 5 points per % of peak hype. */
export function crowdBonus(peakHype: number): number {
  return Math.round(Math.max(0, Math.min(100, peakHype)) * 5);
}
