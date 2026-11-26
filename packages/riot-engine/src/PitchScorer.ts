/**
 * HYPE RIOT — PitchScorer (Blueprint §2 Round 3, Solo/Daily evaluator).
 *
 *   Pitch Score = (Wildcard1_Present x 250) + (Wildcard2_Present x 250)
 *               + (ActionVerb_Bonus x 150) + Length_Penalty
 *               + Random_Crowd_Variance
 *   Length_Penalty        = -5 x max(0, 30 - char_count)
 *   Random_Crowd_Variance = deterministic hash off daily seed in [0, 100]
 *   Wildcard_Present      = exact match OR prefix stemming
 *   ActionVerb_Bonus      = pitch contains a verb from the action/comedy
 *                           dictionary (data: ACTION_VERBS)
 */
import { normalize } from "./AnswerMatcher";

export interface PitchScoreBreakdown {
  wildcard1: boolean;
  wildcard2: boolean;
  actionVerb: boolean;
  actionVerbMatched: string | null;
  lengthPenalty: number;
  crowdVariance: number;
  total: number;
}

/** Deterministic 32-bit FNV-1a hash. */
export function hashSeed(seed: number): number {
  let h = 2166136261 >>> 0;
  const s = String(seed);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function crowdVariance(seed: number): number {
  return hashSeed(seed) % 101; // [0, 100]
}

function stemPresent(pitchNorm: string, wildcard: string): boolean {
  const w = normalize(wildcard);
  if (!w) return false;
  if (pitchNorm.includes(w)) return true;
  // Prefix stemming: any significant wildcard word shares a >=4-char
  // prefix with a pitch word (e.g. "skateboards" ~ "skateboarding").
  const pitchWords = pitchNorm.split(" ");
  for (const word of w.split(" ")) {
    if (word.length < 4) continue;
    const stem = word.slice(0, 4);
    if (pitchWords.some((p) => p.length >= 4 && p.startsWith(stem))) {
      return true;
    }
  }
  return false;
}

export function scorePitch(
  pitch: string,
  wildcardA: string,
  wildcardB: string | undefined,
  actionVerbs: ReadonlySet<string>,
  dailySeed: number
): PitchScoreBreakdown {
  const norm = normalize(pitch);
  const w1 = stemPresent(norm, wildcardA);
  const w2 = wildcardB ? stemPresent(norm, wildcardB) : false;
  let verbMatched: string | null = null;
  for (const word of norm.split(" ")) {
    if (actionVerbs.has(word)) {
      verbMatched = word;
      break;
    }
    // light stemming for verb forms (e.g. "racing" -> "race" handled by
    // dictionary containing both forms; also try dropping -ing/-ed/-s)
    const stemmed = word.replace(/(ing|ed|es|s)$/, "");
    if (stemmed.length >= 3 && actionVerbs.has(stemmed)) {
      verbMatched = stemmed;
      break;
    }
  }
  const lengthPenalty = -5 * Math.max(0, 30 - pitch.length) + 0; // +0 normalizes -0
  const variance = crowdVariance(dailySeed);
  const total =
    (w1 ? 250 : 0) +
    (w2 ? 250 : 0) +
    (verbMatched ? 150 : 0) +
    lengthPenalty +
    variance;
  return {
    wildcard1: w1,
    wildcard2: w2,
    actionVerb: verbMatched !== null,
    actionVerbMatched: verbMatched,
    lengthPenalty,
    crowdVariance: variance,
    total,
  };
}
