/**
 * HYPE RIOT — content pack schemas (Blueprint §2, §4, §6).
 * A pack is one pre-compiled match worth of content: one Round 1
 * brainstorm prompt, four Round 2 cards, one Round 3 pitch setup.
 */
import type { Tier } from "./binary-schema";

export type ComboTagKind =
  | "STARTS_WITH" // param: letter
  | "ERA_DECADE" // param: decade offset from 1950 (e.g. 7 = 2020s)
  | "HAS_TAG"; // param: tag bitmask bit index name

export interface ComboTag {
  kind: ComboTagKind;
  param: string;
  label: string; // e.g. "2020s Release", "Starts with S"
}

export interface BrainstormAnswer {
  entityId: number;
  name: string;
  tier: Tier;
  /** All accepted inputs for this answer (canonical name + slang aliases), normalized at load. */
  aliases: string[];
  eraDecade: number;
  tagBitmask: number;
}

export interface BrainstormPrompt {
  id: string;
  text: string;
  categoryId: number;
  comboTag: ComboTag;
  answers: BrainstormAnswer[]; // >= 25 (Stage 3 coverage rule)
}

export type FactOrCapCard =
  | { type: "CLAIM"; claim: string; isFact: boolean; category: string }
  | {
      type: "CLASH";
      question: string; // "Which has MORE monthly Spotify listeners?"
      a: string;
      b: string;
      aValue: number;
      bValue: number;
      unit: string;
    }
  | {
      type: "ZOOM";
      /** 16 rows of 16 chars; each char indexes ZOOM_PALETTE. */
      bitmap: string[];
      answer: string;
      options: string[]; // 4 tap options incl. answer
      category: string;
    };

export interface PitchSetup {
  template: string; // contains {A} and optionally {B}
  wildcardA: string;
  wildcardB?: string;
}

export interface ContentPack {
  id: number;
  round1: BrainstormPrompt;
  round2: FactOrCapCard[]; // exactly 4
  round3: PitchSetup;
}

export interface DailyFile {
  date: string; // YYYY-MM-DD (UTC)
  seed: number;
  riotNumber: number; // e.g. 42 -> "HYPE RIOT #042"
  packId: number;
  arenaTheme: number; // 0..5
}
