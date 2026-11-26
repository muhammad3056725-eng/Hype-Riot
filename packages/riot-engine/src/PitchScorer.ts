/**
 * HYPE RIOT — PitchScorer (Round 3, solo judge).
 *
 *   Pitch Score = 250 x wildcard A named + 250 x wildcard B named
 *               + 150 if an action verb is used (any inflection)
 *               - 5 x max(0, 30 - trimmed length)
 *               + crowd reaction 0-100 (hash of the day's seed + the pitch text)
 *   clamped to >= 0.
 *
 * Wildcards match whole words, singular/plural-insensitive and
 * spacing/hyphen-insensitive ("wifi" = "Wi-Fi", "cat" = "Cats"), so
 * "create" no longer counts as "Ice Cream".
 */
import { fnv1a, normalize, wordKey } from "./text";

export const PITCH_MAX_CHARS = 80;
export const CROWN_THRESHOLD = 600;

export interface PitchScoreBreakdown {
  wildcard1: boolean;
  wildcard2: boolean;
  actionVerb: boolean;
  actionVerbMatched: string | null;
  lengthPenalty: number;
  crowdVariance: number;
  total: number;
  crown: boolean;
}

const STOP = new Set(["a", "an", "and", "of", "the", "in", "on", "at", "to", "for", "with"]);

const IRREGULAR_PAST: Record<string, string> = {
  ran: "run", ate: "eat", flew: "fly", flown: "fly", threw: "throw", thrown: "throw",
  swam: "swim", sang: "sing", sung: "sing", built: "build", broke: "break", broken: "break",
  caught: "catch", fought: "fight", drove: "drive", driven: "drive", rode: "ride",
  stole: "steal", stolen: "steal", shot: "shoot", spun: "spin", won: "win", sold: "sell",
  found: "find", made: "make", took: "take", taken: "take", gave: "give", given: "give",
  went: "go", gone: "go", came: "come", saw: "see", seen: "see", began: "begin",
  drew: "draw", grew: "grow", blew: "blow", froze: "freeze", frozen: "freeze",
  wrote: "write", written: "write", bit: "bite", bitten: "bite", hid: "hide", hidden: "hide",
  slid: "slide", dug: "dig", stuck: "stick", swung: "swing", struck: "strike", sank: "sink",
  sprang: "spring", fell: "fall", fallen: "fall", felt: "feel", kept: "keep", left: "leave",
  met: "meet", paid: "pay", taught: "teach", thought: "think", brought: "bring",
  bought: "buy", sent: "send", spent: "spend", told: "tell", led: "lead",
  fed: "feed", fled: "flee", held: "hold", sat: "sit", stood: "stand", woke: "wake",
  wore: "wear", tore: "tear", shook: "shake", forgot: "forget", rang: "ring", rose: "rise",
  dove: "dive", dived: "dive", slept: "sleep", swept: "sweep", leapt: "leap", knelt: "kneel",
};

/** Candidate base forms for an inflected word (racing -> race, stopped -> stop, cries -> cry). */
export function verbLemmas(word: string): string[] {
  const w = word.toLowerCase();
  const out = new Set<string>([w]);
  if (IRREGULAR_PAST[w]) out.add(IRREGULAR_PAST[w]);
  const strip = (suffix: string) => (w.endsWith(suffix) ? w.slice(0, -suffix.length) : null);
  const undouble = (s: string) => (s.length >= 3 && s[s.length - 1] === s[s.length - 2] ? s.slice(0, -1) : s);
  for (const suffix of ["s", "es", "ed", "d", "ing"]) {
    const base = strip(suffix);
    if (!base || base.length < 2) continue;
    out.add(base);
    out.add(base + "e");
    out.add(undouble(base));
  }
  const ies = strip("ies");
  if (ies) out.add(ies + "y");
  const ied = strip("ied");
  if (ied) out.add(ied + "y");
  return [...out];
}

export function findActionVerb(pitch: string, verbs: ReadonlySet<string>): string | null {
  for (const raw of pitch.toLowerCase().split(/[^a-z]+/)) {
    if (raw.length < 2) continue;
    for (const lemma of verbLemmas(raw)) {
      if (verbs.has(lemma)) return raw;
    }
  }
  return null;
}

/** Whole-word, plural- and spacing-insensitive wildcard check. */
export function wildcardPresent(pitch: string, wildcard: string): boolean {
  const wKeys = normalize(wildcard).split(" ").filter((w) => w && !STOP.has(w)).map(wordKey);
  if (wKeys.length === 0) return false;
  const target = wKeys.join("");
  const tokens = normalize(pitch).split(" ").filter(Boolean).map(wordKey);
  for (let i = 0; i < tokens.length; i++) {
    let joined = "";
    for (let j = i; j < Math.min(tokens.length, i + 4); j++) {
      joined += tokens[j];
      if (joined === target) return true;
      if (joined.length > target.length) break;
    }
  }
  if (wKeys.length >= 2) {
    const set = new Set(tokens);
    if (wKeys.filter((k) => k.length >= 3).every((k) => set.has(k))) return true;
  }
  return false;
}

/** Crowd reaction 0..100 — differs per pitch text, stable for the same pitch and day. */
export function crowdVariance(seed: number, pitch = ""): number {
  return fnv1a(`${seed}|${normalize(pitch)}`) % 101;
}

export function scorePitch(
  pitch: string,
  wildcardA: string,
  wildcardB: string | undefined,
  actionVerbs: ReadonlySet<string>,
  seed: number,
): PitchScoreBreakdown {
  const text = pitch.replace(/\s+/g, " ").trim().slice(0, PITCH_MAX_CHARS);
  const w1 = text.length > 0 && wildcardPresent(text, wildcardA);
  const w2 = text.length > 0 && !!wildcardB && wildcardPresent(text, wildcardB);
  const verb = text.length > 0 ? findActionVerb(text, actionVerbs) : null;
  const lengthPenalty = -5 * Math.max(0, 30 - text.length) + 0; // +0 normalizes -0
  const variance = text.length > 0 ? crowdVariance(seed, text) : 0;
  const raw = (w1 ? 250 : 0) + (w2 ? 250 : 0) + (verb ? 150 : 0) + lengthPenalty + variance;
  const total = Math.max(0, raw);
  return {
    wildcard1: w1,
    wildcard2: w2,
    actionVerb: verb !== null,
    actionVerbMatched: verb,
    lengthPenalty,
    crowdVariance: variance,
    total,
    crown: total >= CROWN_THRESHOLD,
  };
}
