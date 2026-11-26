import { describe, expect, test } from "vitest";
import type { BrainstormAnswer, ComboTag } from "@hype-riot/shared-types";
import {
  ACTION_VERBS,
  AnswerMatcher,
  compactKey,
  comboCoverage,
  crowdVariance,
  displayName,
  evaluateComboTag,
  findActionVerb,
  normalize,
  renderTextCard,
  scorePitch,
  wildcardPresent,
  type ShareData,
} from "../src/index";

const pool = (names: Array<string | [string, ...string[]]>): BrainstormAnswer[] =>
  names.map((n, rank) => {
    const [name, ...aliases] = Array.isArray(n) ? n : [n];
    return { rank, name, aliases, tier: rank < names.length * 0.55 ? "CROWD_PLEASER" : "DEEP_CUT" };
  });

describe("text rules", () => {
  test("normalize strips apostrophes, accents, punctuation and a leading 'the'", () => {
    expect(normalize("The McDonald's!")).toBe("mcdonalds");
    expect(normalize("Beyoncé")).toBe("beyonce");
    expect(normalize("AC/DC")).toBe("ac dc");
  });
  test("compact keys are spacing- and plural-insensitive", () => {
    expect(compactKey("Spider-Man")).toBe(compactKey("spiderman"));
    expect(compactKey("berries")).toBe(compactKey("Berry"));
    expect(compactKey("knives")).toBe(compactKey("knife"));
    expect(compactKey("shoes")).toBe(compactKey("shoe"));
    expect(compactKey("butterflies")).toBe(compactKey("Butterfly"));
    expect(compactKey("mice")).toBe(compactKey("mouse"));
  });
  test("display names drop disambiguators", () => {
    expect(displayName("Joker (film)")).toBe("Joker");
  });
});

describe("AnswerMatcher", () => {
  const ocean = pool(["Shark", "Blue Whale", "Humpback Whale", "Dolphin", ["Orca", "killer whale"], "Whale Shark", "Butterfly Fish", "Octopus"]);

  test("exact name, alias, plural and apostrophe forms hit", () => {
    const m = new AnswerMatcher(pool(["McDonald's", ["Chick-fil-A", "cfa"], "Lay's", "Butterfly"]));
    expect(m.match("mcdonalds").status).toBe("hit");
    expect(m.match("chickfila").status).toBe("hit");
    expect(m.match("LAYS").status).toBe("hit");
    expect(m.match("butterflies").status).toBe("hit");
  });

  test("a single significant word picks the best-known answer containing it", () => {
    const m = new AnswerMatcher(ocean);
    const r = m.match("whale");
    expect(r.status === "hit" && r.answer.name).toBe("Blue Whale");
    expect(r.status === "hit" && r.via).toBe("word");
    const r2 = m.match("whales");
    expect(r2.status === "hit" && r2.answer.name).toBe("Humpback Whale");
  });

  test("never prefix-guesses into another word", () => {
    const m = new AnswerMatcher(ocean);
    expect(m.match("wha").status).toBe("miss");
    expect(m.match("hump").status).toBe("miss");
    expect(m.match("octo").status).toBe("miss");
    expect(m.match("dolp").status).toBe("miss");
  });

  test("typos need 5+ letters and stay unambiguous", () => {
    const m = new AnswerMatcher(pool(["Bear", "Owl", "Cow", "Dolphin", "Elephant"]));
    expect(m.match("beer").status).toBe("miss"); // 4 letters: no typo tolerance
    expect(m.match("bowl").status).toBe("miss");
    expect(m.match("dolphn").status).toBe("hit");
    expect(m.match("elepahnt").status).toBe("hit"); // transposition
  });

  test("surnames resolve people; duplicates are reported", () => {
    const m = new AnswerMatcher(pool(["Lionel Messi", "Cristiano Ronaldo", "Kylian Mbappé"]));
    expect(m.match("messi").status).toBe("hit");
    expect(m.match("Lionel Messi").status).toBe("duplicate");
    expect(m.match("mbappe").status).toBe("hit");
    expect(m.foundCount).toBe(2);
    expect(m.missed().map((a) => a.name)).toEqual(["Cristiano Ronaldo"]);
  });

  test("generic words alone do not match", () => {
    const m = new AnswerMatcher(pool(["Great Wall of China", "Grand Canyon"]));
    expect(m.match("great").status).toBe("miss");
    expect(m.match("canyon").status).toBe("hit");
  });
});

describe("ComboTagEvaluator", () => {
  const tag = (kind: ComboTag["kind"], param = ""): ComboTag => ({ kind, param, label: kind });
  test("STARTS_WITH uses the raw name, so 'The' counts", () => {
    expect(evaluateComboTag(tag("STARTS_WITH", "t"), "The Weeknd")).toBe(true);
    expect(evaluateComboTag(tag("STARTS_WITH", "w"), "The Weeknd")).toBe(false);
  });
  test("other kinds", () => {
    expect(evaluateComboTag(tag("ENDS_WITH", "aeiou"), "Pizza")).toBe(true);
    expect(evaluateComboTag(tag("CONTAINS", "z"), "Pizza")).toBe(true);
    expect(evaluateComboTag(tag("MULTI_WORD"), "Ice Cream")).toBe(true);
    expect(evaluateComboTag(tag("MULTI_WORD"), "Spider-Man")).toBe(false);
    expect(evaluateComboTag(tag("MAX_LETTERS", "4"), "Kiwi")).toBe(true);
    expect(evaluateComboTag(tag("MIN_LETTERS", "9"), "Watermelon")).toBe(true);
    expect(evaluateComboTag(tag("DOUBLE_LETTER"), "Apple")).toBe(true);
    expect(comboCoverage(tag("DOUBLE_LETTER"), ["Apple", "Pear", "Kiwi", "Cherry"])).toBe(0.5);
  });
});

describe("PitchScorer", () => {
  test("whole-word wildcard matching: plurals, hyphens, no substring false positives", () => {
    expect(wildcardPresent("my cat runs the show", "Cats")).toBe(true);
    expect(wildcardPresent("free wifi everywhere", "Wi-Fi")).toBe(true);
    expect(wildcardPresent("free wi-fi everywhere", "Wifi")).toBe(true);
    expect(wildcardPresent("we create new worlds", "Ice Cream")).toBe(false);
    expect(wildcardPresent("start the party", "Stars")).toBe(false);
    expect(wildcardPresent("sharks invade the high school cafeteria", "High School Cafeteria")).toBe(true);
    expect(wildcardPresent("visit the moon", "The Moon")).toBe(true);
  });

  test("action verbs are matched in any inflection, nouns are not verbs", () => {
    expect(ACTION_VERBS.size).toBeGreaterThan(900);
    for (const w of ["run", "steal", "save", "race"]) expect(ACTION_VERBS.has(w)).toBe(true);
    expect(ACTION_VERBS.has("pizza")).toBe(false);
    expect(findActionVerb("sharks racing", ACTION_VERBS)).toBe("racing");
    expect(findActionVerb("they stopped it", ACTION_VERBS)).toBe("stopped");
    expect(findActionVerb("the dragon flew home", ACTION_VERBS)).toBe("flew");
    expect(findActionVerb("pizza and tacos", ACTION_VERBS)).toBeNull();
  });

  test("full marks: both wildcards + verb, variance depends on the pitch text", () => {
    const pitch = "Sharks race through the high school cafeteria at midnight";
    const s = scorePitch(pitch, "Sharks", "High School Cafeteria", ACTION_VERBS, 42);
    expect(s.wildcard1 && s.wildcard2 && s.actionVerb).toBe(true);
    expect(s.lengthPenalty).toBe(0);
    expect(s.crowdVariance).toBe(crowdVariance(42, pitch));
    expect(s.total).toBe(650 + s.crowdVariance);
    expect(s.crown).toBe(true);
    const variances = new Set(["a", "b", "c", "d", "e", "f"].map((x) => crowdVariance(42, `pitch ${x}`)));
    expect(variances.size).toBeGreaterThan(1);
  });

  test("length uses trimmed text, total never goes negative", () => {
    const padded = scorePitch("pizza" + " ".repeat(40), "Pizza", "Tacos", ACTION_VERBS, 7);
    expect(padded.lengthPenalty).toBe(-5 * 25);
    const empty = scorePitch("", "Pizza", "Tacos", ACTION_VERBS, 7);
    expect(empty.total).toBe(0);
    expect(empty.crowdVariance).toBe(0);
  });
});

describe("share text", () => {
  const base: ShareData = {
    mode: "daily", riotNumber: 42, promptText: "Fruits", totalScore: 8450,
    round1Score: 2400, round1Hits: 12, round1Total: 40, round2Score: 2600,
    round2Marks: [true, true, false, true], round3Score: 740, round3Crown: true,
    blitzTopFound: 0, crowdBonus: 300, hypePeak: 88, rankTitle: "Meme Scout",
  };
  test("daily card", () => {
    const t = renderTextCard(base, "https://example.gg/Hype-Riot/");
    expect(t).toContain("HYPE RIOT #042 — 8,450 pts");
    expect(t).toContain("🟩".repeat(10) + " +2");
    expect(t).toContain("✅✅❌✅ 3/4");
    expect(t).toContain("👑 Crowd favorite (+740)");
    expect(t.endsWith("https://example.gg/Hype-Riot/")).toBe(true);
    expect(t).not.toContain("//#");
  });
  test("quick and blitz cards are labelled by mode", () => {
    expect(renderTextCard({ ...base, mode: "quick" }, "u")).toContain("Quick Arcade");
    const blitz = renderTextCard({ ...base, mode: "blitz", blitzTopFound: 7 }, "u");
    expect(blitz).toContain("Brainstorm Blitz");
    expect(blitz).toContain("Top-10 found: 7/10");
    expect(blitz).not.toContain("Fact or Cap");
  });
});
