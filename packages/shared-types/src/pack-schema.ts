/**
 * HYPE RIOT — content pack schema (one pack = one match of content).
 * Built by pipeline/stage3_expansion.py, published as
 * public/data/v1/packs/pack_NNN.json.
 */

export type Tier = "CROWD_PLEASER" | "DEEP_CUT";

export type ComboTagKind =
  | "STARTS_WITH" // param: letters, e.g. "st" = starts with S or T (raw name, "The" counts)
  | "ENDS_WITH" // param: letters
  | "CONTAINS" // param: one letter
  | "MULTI_WORD" // two or more words
  | "MAX_LETTERS" // param: n — n letters or fewer
  | "MIN_LETTERS" // param: n — n letters or more
  | "DOUBLE_LETTER"; // contains a doubled letter (ll, oo, ...)

export interface ComboTag {
  kind: ComboTagKind;
  param: string;
  label: string;
}

export interface BrainstormAnswer {
  /** 0 = most famous. Order drives tiers and the Blitz top 10. */
  rank: number;
  name: string;
  /** Extra accepted inputs (nicknames, abbreviations, regional names). */
  aliases: string[];
  tier: Tier;
}

export interface BrainstormPrompt {
  id: string;
  text: string;
  categoryId: number;
  comboTag: ComboTag;
  answers: BrainstormAnswer[]; // 30-60
}

export interface ClaimCard {
  type: "CLAIM";
  claim: string;
  isFact: boolean;
  category: string;
}

export interface ClashCard {
  type: "CLASH";
  /** "max": the bigger value wins; "min": the smaller value wins (e.g. earlier year). */
  mode: "max" | "min";
  question: string;
  a: string;
  b: string;
  aValue: number;
  bValue: number;
  unit: string;
}

export interface ZoomCard {
  type: "ZOOM";
  emoji: string;
  answer: string;
  options: string[]; // 4, includes answer
  /** Zoom focal point (0..1) inside the emoji. */
  focusX: number;
  focusY: number;
}

export type FactOrCapCard = ClaimCard | ClashCard | ZoomCard;

export interface PitchSetup {
  template: string; // contains {A} and {B}
  wildcardA: string;
  wildcardB: string;
}

export interface ContentPack {
  id: number;
  round1: BrainstormPrompt;
  round2: FactOrCapCard[]; // 4 cards
  round3: PitchSetup;
}

export interface PitchPool {
  templates: string[];
  wildcards: string[];
}
