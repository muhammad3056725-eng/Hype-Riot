/**
 * HYPE RIOT — ComboTagEvaluator. Every Round 1 prompt carries a
 * "Wildcard Combo Tag"; answers matching it score 2x. The pipeline picks
 * tags so 20-40% of answers qualify (mirror: pipeline/corpus/text.py).
 * Letters come from the raw display name — a leading "The" counts.
 */
import type { ComboTag } from "@hype-riot/shared-types";
import { displayName, letters } from "./text";

export function evaluateComboTag(tag: ComboTag, name: string): boolean {
  const shown = displayName(name);
  const lt = letters(shown);
  switch (tag.kind) {
    case "STARTS_WITH":
      return lt.length > 0 && tag.param.includes(lt[0]);
    case "ENDS_WITH":
      return lt.length > 0 && tag.param.includes(lt[lt.length - 1]);
    case "CONTAINS":
      return lt.includes(tag.param);
    case "MULTI_WORD":
      return shown.split(/\s+/).filter(Boolean).length >= 2;
    case "MAX_LETTERS":
      return lt.length <= Number(tag.param);
    case "MIN_LETTERS":
      return lt.length >= Number(tag.param);
    case "DOUBLE_LETTER":
      return /([a-z])\1/.test(lt);
  }
}

/** Share of answers that satisfy the tag (0..1). */
export function comboCoverage(tag: ComboTag, names: string[]): number {
  if (names.length === 0) return 0;
  return names.filter((n) => evaluateComboTag(tag, n)).length / names.length;
}
