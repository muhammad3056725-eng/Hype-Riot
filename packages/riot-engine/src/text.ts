/**
 * HYPE RIOT — text rules shared by matching, combos and pitch scoring.
 * Mirrored exactly by pipeline/corpus/text.py (the build validates packs
 * with the same functions the game uses).
 */

const IRREGULAR: Record<string, string> = {
  mice: "mouse", geese: "goose", teeth: "tooth", feet: "foot",
  children: "child", men: "man", women: "woman", people: "person",
  oxen: "ox", lice: "louse", dice: "die", cacti: "cactus",
  fungi: "fungus", octopi: "octopus", dwarves: "dwarf", elves: "elf",
};

/** Lowercase + strip diacritics. */
export function fold(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Removes "(...)" disambiguators: "Joker (film)" -> "Joker". */
export function displayName(s: string): string {
  return s.replace(/\s*\([^)]*\)/g, "").trim();
}

/** Lowercase, no accents, '&' -> and, apostrophes removed, punctuation -> space, no leading "the". */
export function normalize(input: string): string {
  let s = fold(input)
    .replace(/&/g, " and ")
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (s.startsWith("the ")) s = s.slice(4);
  return s;
}

/** Singular-ish stem so "berries"/"berry", "knives"/"knife", "shoes"/"shoe" meet. */
export function wordKey(word: string): string {
  let w = IRREGULAR[word] ?? word;
  const n = w.length;
  if (n > 4 && w.endsWith("ies")) w = w.slice(0, -3) + "y";
  else if (n > 4 && w.endsWith("ves")) w = w.slice(0, -3) + "f";
  else if (/(sses|xes|zes|ches|shes)$/.test(w)) w = w.slice(0, -2);
  else if (n > 3 && w.endsWith("s") && !/(ss|us|is)$/.test(w)) w = w.slice(0, -1);
  if (w.length > 3 && w.endsWith("ie")) w = w.slice(0, -2) + "y";
  if (w.length > 3 && w.endsWith("fe")) w = w.slice(0, -2) + "f";
  if (w.length > 3 && w.endsWith("e")) w = w.slice(0, -1);
  return w;
}

/** Word keys of a phrase. */
export function wordKeys(s: string): string[] {
  return normalize(s).split(" ").filter(Boolean).map(wordKey);
}

/** Spacing-insensitive key: "Spider-Man" == "spiderman" == "spider man". */
export function compactKey(s: string): string {
  return wordKeys(s).join("");
}

/** Letters/digits of the display name (for combo tags). */
export function letters(s: string): string {
  return fold(displayName(s)).replace(/[^a-z0-9]/g, "");
}

/** Damerau-Levenshtein (optimal string alignment); returns 99 when lengths differ by > 2. */
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
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[m][n];
}

/** 32-bit FNV-1a hash of a string. */
export function fnv1a(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
