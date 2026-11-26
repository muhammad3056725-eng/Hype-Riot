/**
 * HYPE RIOT — AnswerMatcher: forgiving matching of typed answers against
 * a prompt's answer pool.
 *
 * Order (strict -> forgiving), never prefix-guessing into another word:
 *  1. exact: the spacing/plural-insensitive key of the input equals a
 *     name or alias key ("spiderman" = "Spider-Man", "berries" = "Berry",
 *     "mcdonalds" = "McDonald's", "the weekend"... see typo).
 *  2. word: a single typed word equals a significant word (4+ letters,
 *     not generic) of an answer's name ("messi" -> Lionel Messi, "whale"
 *     -> Blue Whale when "Whale" is not itself an answer). When several
 *     answers share the word, the best-known one not yet found wins.
 *  3. typo: inputs of 5+ letters within edit distance 1 (2 for 9+) of a
 *     name, alias or significant word, accepted only when unambiguous.
 * Already-found answers report "duplicate".
 */
import type { BrainstormAnswer } from "@hype-riot/shared-types";
import { compactKey, displayName, editDistance, normalize, wordKey } from "./text";

export type MatchVia = "exact" | "word" | "typo";

export type MatchResult =
  | { status: "hit"; answer: BrainstormAnswer; via: MatchVia }
  | { status: "duplicate"; answer: BrainstormAnswer }
  | { status: "miss" };

/** Words too generic to identify an answer on their own. */
const GENERIC = new Set([
  "with", "from", "into", "over", "your", "little", "great", "super", "mount",
  "lake", "river", "island", "city", "state", "united", "republic", "north",
  "south", "east", "west", "central", "saint", "world", "grand", "high", "game",
  "show", "series", "movie", "film", "club", "team", "park", "house", "kingdom",
  "empire", "national", "royal", "golden", "black", "white", "green", "blue",
  "brown", "pink", "yellow", "orange", "purple", "red", "new", "old", "big",
  "small", "year", "day", "night", "time", "part", "edition", "original",
  "classic", "real", "true", "best", "first", "last", "mini", "baby", "king",
  "queen", "lord", "lady", "prince", "princess", "doctor", "mister",
].map(wordKey));

export class AnswerMatcher {
  private readonly answers: BrainstormAnswer[];
  private readonly exact = new Map<string, number[]>();
  private readonly words = new Map<string, number[]>();
  private readonly found = new Set<number>();
  readonly total: number;

  constructor(answers: BrainstormAnswer[]) {
    this.answers = [...answers].sort((a, b) => a.rank - b.rank);
    this.total = answers.length;
    const add = (map: Map<string, number[]>, key: string, rank: number) => {
      if (!key) return;
      const list = map.get(key);
      if (!list) map.set(key, [rank]);
      else if (!list.includes(rank)) list.push(rank);
    };
    for (const a of this.answers) {
      for (const form of [a.name, displayName(a.name), ...a.aliases]) {
        add(this.exact, compactKey(form), a.rank);
      }
      for (const w of normalize(displayName(a.name)).split(" ")) {
        if (w.length < 4) continue;
        const k = wordKey(w);
        if (!GENERIC.has(k)) add(this.words, k, a.rank);
      }
    }
    for (const list of this.words.values()) list.sort((x, y) => x - y);
  }

  get foundCount(): number {
    return this.found.size;
  }

  isFound(rank: number): boolean {
    return this.found.has(rank);
  }

  /** Answers not yet found, most famous first (end-of-round reveal). */
  missed(): BrainstormAnswer[] {
    return this.answers.filter((a) => !this.found.has(a.rank));
  }

  match(rawInput: string): MatchResult {
    const norm = normalize(rawInput);
    const key = compactKey(rawInput);
    if (key.length < 2) return { status: "miss" };

    const exact = this.exact.get(key);
    if (exact) return this.claim(exact, "exact");

    const inputWords = norm.split(" ");
    if (inputWords.length === 1) {
      const byWord = this.words.get(key);
      if (byWord) return this.claim(byWord, "word");
    }

    if (key.length >= 5) {
      const maxDist = key.length >= 9 ? 2 : 1;
      let bestDist = maxDist + 1;
      let best: number[] | null = null;
      let ambiguous = false;
      const consider = (k: string, ranks: number[]) => {
        if (k.length < 4 || Math.abs(k.length - key.length) > maxDist) return;
        const dist = editDistance(key, k);
        if (dist < bestDist) {
          bestDist = dist;
          best = ranks;
          ambiguous = false;
        } else if (dist === bestDist && best && !sameSet(best, ranks)) {
          ambiguous = true;
        }
      };
      for (const [k, ranks] of this.exact) consider(k, ranks);
      if (inputWords.length === 1) for (const [k, ranks] of this.words) consider(k, ranks);
      if (best && !ambiguous && bestDist <= maxDist) return this.claim(best, "typo");
    }
    return { status: "miss" };
  }

  private claim(ranks: number[], via: MatchVia): MatchResult {
    const open = ranks.find((r) => !this.found.has(r));
    if (open === undefined) return { status: "duplicate", answer: this.answers.find((a) => a.rank === ranks[0])! };
    this.found.add(open);
    return { status: "hit", answer: this.answers.find((a) => a.rank === open)!, via };
  }
}

function sameSet(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((x) => b.includes(x));
}
