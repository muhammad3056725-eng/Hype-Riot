// HYPE RIOT progression (Blueprint §2): XP tiers + Hype Coins.
// HC_earned = floor(Total Hype / 100) + (Streak_Days x 15) + Victory_Bonus

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

export function nextTier(xp: number): { tier: RankTier; xpNeeded: number } | null {
  for (const t of TIERS) if (xp < t.xp) return { tier: t.tier, xpNeeded: t.xp - xp };
  return null;
}

/** Coins for a finished match. victoryBonus: 25 for beating the Quick
 * Arcade threshold / a top Blitz clear, else 0. */
export function hypeCoins(totalHype: number, streakDays: number, victoryBonus = 0): number {
  return Math.floor(totalHype / 100) + streakDays * 15 + victoryBonus;
}
