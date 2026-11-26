/**
 * HYPE RIOT — AnswerMatcher (Blueprint §1, §4, §6).
 * Typo-tolerant prefix-trie matcher over a prompt's valid answer pool.
 *
 * Matching order (fast -> fuzzy):
 *  1. Exact normalized alias hit ("spidey" -> Spider-Man, "mc" -> Minecraft)
 *  2. Unique prefix hit on the trie (input len >= 4, prefix of aliases
 *     belonging to exactly ONE answer)
 *  3. Typo tolerance: Damerau-Levenshtein <= 1 (len 4..7) or <= 2 (len >= 8)
 *     against aliases of unfound answers; accepted only when unambiguous.
 * Already-found answers report "duplicate" so the UI can buzz them.
 */
import type { BrainstormAnswer } from "@hype-riot/shared-types";

export function normalize(input: string): string {
  let s = input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (s.startsWith("the ")) s = s.slice(4);
  return s;
}

/** Damerau-Levenshtein distance (optimal string alignment variant). */
export function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (Math.abs(m - n) > 2) return 99;
  const d: number[][] = Array.from({ length: m + 1 }, (_, i) => {
    const row = new Array<number>(n + 1).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + cost
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1); // transposition
      }
    }
  }
  return d[m][n];
}

class TrieNode {
  children = new Map<string, TrieNode>();
  answerIds = new Set<number>();
}

export type MatchResult =
  | { status: "hit"; answer: BrainstormAnswer; via: "exact" | "prefix" | "typo" }
  | { status: "duplicate"; answer: BrainstormAnswer }
  | { status: "miss" };

export class AnswerMatcher {
  private byAlias = new Map<string, BrainstormAnswer>();
  private trieRoot = new TrieNode();
  private found = new Set<number>();
  readonly total: number;

  constructor(answers: BrainstormAnswer[]) {
    this.total = answers.length;
    for (const ans of answers) {
      const forms = new Set<string>([normalize(ans.name)]);
      for (const a of ans.aliases) forms.add(normalize(a));
      for (const form of forms) {
        if (!form) continue;
        if (!this.byAlias.has(form)) this.byAlias.set(form, ans);
        let node = this.trieRoot;
        for (const ch of form) {
          let next = node.children.get(ch);
          if (!next) {
            next = new TrieNode();
            node.children.set(ch, next);
          }
          node = next;
          node.answerIds.add(ans.entityId);
        }
      }
    }
  }

  get foundCount(): number {
    return this.found.size;
  }

  reset(): void {
    this.found.clear();
  }

  match(rawInput: string): MatchResult {
    const input = normalize(rawInput);
    if (input.length < 2) return { status: "miss" };

    // 1. Exact alias
    const exact = this.byAlias.get(input);
    if (exact) return this.claim(exact, "exact");

    // 2. Unique prefix via trie
    if (input.length >= 4) {
      let node: TrieNode | undefined = this.trieRoot;
      for (const ch of input) {
        node = node.children.get(ch);
        if (!node) break;
      }
      if (node && node.answerIds.size === 1) {
        const id = [...node.answerIds][0];
        const ans = this.answerById(id);
        if (ans) return this.claim(ans, "prefix");
      }
    }

    // 3. Typo tolerance against unfound answers' aliases
    const maxDist = input.length >= 8 ? 2 : input.length >= 4 ? 1 : 0;
    if (maxDist > 0) {
      let best: BrainstormAnswer | null = null;
      let bestDist = maxDist + 1;
      let ambiguous = false;
      for (const [alias, ans] of this.byAlias) {
        if (Math.abs(alias.length - input.length) > maxDist) continue;
        const dist = editDistance(input, alias);
        if (dist < bestDist) {
          bestDist = dist;
          best = ans;
          ambiguous = false;
        } else if (dist === bestDist && best && ans.entityId !== best.entityId) {
          ambiguous = true;
        }
      }
      if (best && !ambiguous && bestDist <= maxDist) {
        return this.claim(best, "typo");
      }
    }
    return { status: "miss" };
  }

  private answerById(id: number): BrainstormAnswer | undefined {
    for (const ans of this.byAlias.values()) {
      if (ans.entityId === id) return ans;
    }
    return undefined;
  }

  private claim(ans: BrainstormAnswer, via: "exact" | "prefix" | "typo"): MatchResult {
    if (this.found.has(ans.entityId)) return { status: "duplicate", answer: ans };
    this.found.add(ans.entityId);
    return { status: "hit", answer: ans, via };
  }
}
