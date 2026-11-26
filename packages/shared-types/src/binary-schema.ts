/**
 * HYPE RIOT — dataset manifest + category catalog.
 *
 * (Historical file name: this module used to describe the retired
 * entities.bin format. The game now ships JSON packs only; the manifest
 * below is the single index the client loads at boot.)
 */

export interface DataManifest {
  version: string;
  contentHash: string;
  packs: number;
  /** Daily Riot schedule: packId = (offset + (riotNumber-1) * stride) % packs. */
  dailyStride: number;
  dailyOffset: number;
  counts: {
    prompts: number;
    answers: number;
    claims: number;
    clashes: number;
    zoom: number;
    templates: number;
    wildcards: number;
    verbs: number;
  };
  /** A few precomputed date -> packId pairs so tests can prove TS/Python parity. */
  dailyCheck: Record<string, number>;
  files: Record<string, string>; // path -> sha256 (12 chars)
}

export const CATEGORIES: Record<number, string> = {
  1: "Games",
  2: "Music",
  3: "Movies & TV",
  4: "Sports",
  5: "Internet",
  6: "Food & Drink",
  7: "Animals",
  8: "Science & Nature",
  9: "Places",
  10: "School & Everyday",
  11: "Brands",
  12: "Pop Culture",
};
