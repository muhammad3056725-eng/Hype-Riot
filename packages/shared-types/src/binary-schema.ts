/**
 * HYPE RIOT — entities.bin binary schema (Blueprint §4).
 *
 * File layout: 64-byte header, then N consecutive 18-byte records,
 * then a null-terminated UTF-8 string table.
 *   Header: Magic "HRD1" [4B] | Version uint16 [2B] | Entity Count uint32 [4B] | Reserved [54B]
 *   Record (18B, little-endian):
 *     entity_id           uint32
 *     category_id         uint8
 *     popularity_score    uint8  (0–255)
 *     era_decade          uint8  (decade offset from 1950: 0=1950s … 7=2020s)
 *     tag_bitmask         uint32
 *     primary_name_offset uint32 (offset into string table)
 *     cluster_id          uint16
 * NOTE the struct field order follows the blueprint's Stage-5 compiler
 * (struct "<IBBBIIH": id, category, popularity, era, tag_bitmask,
 * name_offset, cluster_id) — 4+1+1+1+4+4+2 = 17 bytes + 1 pad = 18 with
 * native alignment off ("<" = no alignment, so exactly 17... see the
 * parser: Python struct "<IBBBIIH" calcsize is 17. The blueprint text
 * says 18-byte records; the compiler it ships produces 17-byte records.
 * We follow the SHIPPED COMPILER (executable spec) and document the
 * discrepancy — RECORD_SIZE = 17. See README "Deviations".)
 */
export const BIN_MAGIC = "HRD1";
export const BIN_VERSION = 1;
export const HEADER_SIZE = 64;
export const RECORD_SIZE = 17; // struct "<IBBBIIH" — see note above

export interface EntityRecord {
  id: number;
  categoryId: number;
  popularity: number; // 0..255
  eraDecade: number; // offset from 1950
  tagBitmask: number;
  clusterId: number;
  name: string;
}

/** Tag bitmask flags (Blueprint §4: "Flags: Anime, Gaming, Meme, etc."). */
export const TAG = {
  GAMING: 1 << 0,
  ANIME: 1 << 1,
  MEME: 1 << 2,
  MUSIC: 1 << 3,
  SPORT: 1 << 4,
  FOOD: 1 << 5,
  SPACE: 1 << 6,
  HORROR: 1 << 7,
  SUPERHERO: 1 << 8,
  CLASSIC: 1 << 9, // pre-2000
} as const;

export const CATEGORIES: Record<number, string> = {
  1: "Video Games, Characters & Esports",
  2: "Music, Artists, Bands & Viral Tracks",
  3: "Movies, TV Shows & Anime",
  4: "Sports, Athletes & Teams",
  5: "Internet Culture, Creators & Memes",
  6: "Food, Snacks, Drinks & Fast Food",
  7: "Animals, Dinosaurs & Nature",
  8: "Science, Space, Tech & Gadgets",
  9: "Countries, Cities & Landmarks",
  10: "School, Everyday & Relatable",
};

export type Tier = "CROWD_PLEASER" | "DEEP_CUT";

/** The exact 32-color neon palette (Blueprint §3). */
export const NEON_PALETTE: string[] = [
  "#110E1B", "#1E1735", "#3A2F5B", "#5B4B8A", "#8F79D2", "#C3B2FF", "#FFF8E7", "#FFD166",
  "#F4A261", "#E76F51", "#E63946", "#D62828", "#900C3F", "#FF2A85", "#FF70A6", "#FF9770",
  "#00F5D4", "#00BBF9", "#0077B6", "#03045E", "#A8FF35", "#38B000", "#007200", "#70E000",
  "#9B5DE5", "#F15BB5", "#FEE440", "#31572C", "#4F772D", "#132A13", "#000000", "#FFFFFF",
];

/** Parse an entities.bin ArrayBuffer into records (Blueprint §4 layout). */
export function parseEntitiesBin(buf: ArrayBuffer): EntityRecord[] {
  const view = new DataView(buf);
  const magic = String.fromCharCode(
    view.getUint8(0),
    view.getUint8(1),
    view.getUint8(2),
    view.getUint8(3)
  );
  if (magic !== BIN_MAGIC) throw new Error(`Bad magic: ${magic}`);
  const version = view.getUint16(4, true);
  if (version !== BIN_VERSION) throw new Error(`Bad version: ${version}`);
  const count = view.getUint32(6, true);
  const decoder = new TextDecoder("utf-8");
  const bytes = new Uint8Array(buf);
  const recordsEnd = HEADER_SIZE + count * RECORD_SIZE;
  const readString = (offset: number): string => {
    let end = recordsEnd + offset;
    while (end < bytes.length && bytes[end] !== 0) end++;
    return decoder.decode(bytes.subarray(recordsEnd + offset, end));
  };
  const out: EntityRecord[] = [];
  for (let i = 0; i < count; i++) {
    const o = HEADER_SIZE + i * RECORD_SIZE;
    out.push({
      id: view.getUint32(o, true),
      categoryId: view.getUint8(o + 4),
      popularity: view.getUint8(o + 5),
      eraDecade: view.getUint8(o + 6),
      tagBitmask: view.getUint32(o + 7, true),
      name: readString(view.getUint32(o + 11, true)),
      clusterId: view.getUint16(o + 15, true),
    });
  }
  return out;
}

/** Trie shard file format (Blueprint §4, trie_shards/{prefix}.json). */
export interface TrieShard {
  prefix: string;
  alias_map: Record<string, number>;
  canonical: Record<
    string,
    { name: string; category: number; tier: Tier }
  >;
}

export interface DataManifest {
  version: string;
  generated: string;
  entities: number;
  shards: number;
  packs: number;
  files: Record<string, string>; // path -> sha256 (short)
}
