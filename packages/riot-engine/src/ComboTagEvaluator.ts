/**
 * HYPE RIOT — ComboTagEvaluator (Blueprint §2 Round 1).
 * Every Round 1 prompt carries a secondary "Wildcard Combo Tag"
 * condition; answers matching it score 2x HYPE COMBO.
 */
import type { ComboTag } from "@hype-riot/shared-types";
import { TAG } from "@hype-riot/shared-types";
import { normalize } from "./AnswerMatcher";

export interface ComboSubject {
  name: string;
  eraDecade: number;
  tagBitmask: number;
}

export function evaluateComboTag(tag: ComboTag, e: ComboSubject): boolean {
  switch (tag.kind) {
    case "STARTS_WITH": {
      const n = normalize(e.name);
      return n.startsWith(tag.param.toLowerCase());
    }
    case "ERA_DECADE":
      return e.eraDecade === Number(tag.param);
    case "HAS_TAG": {
      const bit = (TAG as Record<string, number>)[tag.param];
      return bit !== undefined && (e.tagBitmask & bit) !== 0;
    }
  }
}
