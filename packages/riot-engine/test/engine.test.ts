import { describe, test, expect } from "vitest";
import {
  AnswerMatcher,
  normalize,
  evaluateComboTag,
  scorePitch,
  crowdVariance,
  encodeShare,
  decodeShare,
  renderTextCard,
  ACTION_VERBS,
} from "../src/index";
import { TAG } from "@hype-riot/shared-types";
import type { BrainstormAnswer } from "@hype-riot/shared-types";

const ANSWERS: BrainstormAnswer[] = [
  { entityId: 104052, name: "Minecraft", tier: "CROWD_PLEASER", aliases: ["mc"], eraDecade: 6, tagBitmask: 1 },
  { entityId: 104100, name: "Grand Theft Auto", tier: "CROWD_PLEASER", aliases: ["gta"], eraDecade: 5, tagBitmask: 1 },
  { entityId: 301210, name: "Spider-Man", tier: "CROWD_PLEASER", aliases: ["spidey", "spiderman"], eraDecade: 5, tagBitmask: 256 },
  { entityId: 104200, name: "Stardew Valley", tier: "DEEP_CUT", aliases: [], eraDecade: 6, tagBitmask: 1 },
  { entityId: 104201, name: "Star Wars: Battlefront", tier: "DEEP_CUT", aliases: ["battlefront"], eraDecade: 5, tagBitmask: 1 },
  { entityId: 602001, name: "McDonald's", tier: "CROWD_PLEASER", aliases: ["mcd", "maccies"], eraDecade: 4, tagBitmask: 32 },
];

describe("normalize", () => {
  test("lowercases, strips punctuation and leading 'the'", () => {
    expect(normalize("  The Spider-Man!! ")).toBe("spider man");
    expect(normalize("McDonald's")).toBe("mcdonald s");
  });
});

describe("AnswerMatcher", () => {
  test("slang aliases hit exactly (blueprint examples)", () => {
    const m = new AnswerMatcher(ANSWERS);
    expect(m.match("mc").status).toBe("hit");
    expect(m.match("gta").status).toBe("hit");
    expect(m.match("spidey").status).toBe("hit");
    expect(m.match("mcd").status).toBe("hit");
  });
  test("canonical names hit, case/punctuation-insensitive", () => {
    const m = new AnswerMatcher(ANSWERS);
    const r = m.match("MINECRAFT");
    expect(r.status).toBe("hit");
    if (r.status === "hit") expect(r.answer.name).toBe("Minecraft");
  });
  test("typos within tolerance hit", () => {
    const m = new AnswerMatcher(ANSWERS);
    expect(m.match("minecrft").status).toBe("hit"); // deletion
    expect(m.match("spidermna").status).toBe("hit"); // transposition
  });
  test("unique prefix hits; ambiguous prefix misses", () => {
    const m = new AnswerMatcher(ANSWERS);
    const r = m.match("stardew");
    expect(r.status).toBe("hit");
    if (r.status === "hit") expect(r.via).toBe("prefix");
    // "star" is a prefix of two different answers -> must NOT guess
    const m2 = new AnswerMatcher(ANSWERS);
    expect(m2.match("star").status).toBe("miss");
  });
  test("duplicates are reported, unknowns miss", () => {
    const m = new AnswerMatcher(ANSWERS);
    expect(m.match("mc").status).toBe("hit");
    expect(m.match("Minecraft").status).toBe("duplicate");
    expect(m.match("zelda breath of the wild").status).toBe("miss");
    expect(m.foundCount).toBe(1);
  });
});

describe("ComboTagEvaluator", () => {
  const mc = { name: "Minecraft", eraDecade: 6, tagBitmask: TAG.GAMING };
  test("STARTS_WITH", () => {
    expect(evaluateComboTag({ kind: "STARTS_WITH", param: "m", label: "Starts with M" }, mc)).toBe(true);
    expect(evaluateComboTag({ kind: "STARTS_WITH", param: "s", label: "Starts with S" }, mc)).toBe(false);
  });
  test("ERA_DECADE", () => {
    expect(evaluateComboTag({ kind: "ERA_DECADE", param: "6", label: "2010s Release" }, mc)).toBe(true);
    expect(evaluateComboTag({ kind: "ERA_DECADE", param: "7", label: "2020s Release" }, mc)).toBe(false);
  });
  test("HAS_TAG", () => {
    expect(evaluateComboTag({ kind: "HAS_TAG", param: "GAMING", label: "Gaming" }, mc)).toBe(true);
    expect(evaluateComboTag({ kind: "HAS_TAG", param: "ANIME", label: "Anime" }, mc)).toBe(false);
  });
});

describe("PitchScorer (blueprint formula)", () => {
  test("full house: both wildcards + verb + no penalty + variance", () => {
    const s = scorePitch(
      "Race sharks through a high school cafeteria at turbo speed!!",
      "Sharks",
      "High School Cafeteria",
      ACTION_VERBS,
      42
    );
    expect(s.wildcard1).toBe(true);
    expect(s.wildcard2).toBe(true);
    expect(s.actionVerb).toBe(true);
    expect(s.lengthPenalty).toBe(0); // >= 30 chars
    expect(s.crowdVariance).toBe(crowdVariance(42));
    expect(s.total).toBe(250 + 250 + 150 + 0 + crowdVariance(42));
  });
  test("prefix stemming detects wildcard ('skateboarding' for 'Skateboards')", () => {
    const s = scorePitch("skateboarding pizza party chaos", "Skateboards", "Pizza", ACTION_VERBS, 7);
    expect(s.wildcard1).toBe(true);
    expect(s.wildcard2).toBe(true);
  });
  test("length penalty = -5 per char under 30", () => {
    const s = scorePitch("pizza", "Pizza", undefined, ACTION_VERBS, 7);
    expect(s.lengthPenalty).toBe(-5 * 25);
    expect(s.wildcard2).toBe(false);
  });
  test("variance is deterministic and within [0,100]", () => {
    for (const seed of [0, 1, 42, 999999]) {
      const v = crowdVariance(seed);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
      expect(crowdVariance(seed)).toBe(v);
    }
  });
  test("verb dictionary has real size", () => {
    expect(ACTION_VERBS.size).toBeGreaterThan(500);
    expect(ACTION_VERBS.has("race")).toBe(true);
    expect(ACTION_VERBS.has("explode")).toBe(true);
  });
});

describe("ShareCardEncoder", () => {
  const data = {
    riotNumber: 42,
    totalScore: 8450,
    round1Score: 2400,
    round1Hits: 3,
    round1Slots: 5,
    round2Score: 3050,
    round2Correct: 4,
    round3Score: 3000,
    round3Crown: true,
    rankTitle: "Arena Headliner",
  };
  test("encode/decode round-trips", () => {
    const enc = encodeShare(data);
    const dec = decodeShare(enc);
    expect(dec).not.toBeNull();
    expect(dec!.totalScore).toBe(8450);
    expect(dec!.round2Correct).toBe(4);
    expect(dec!.round3Crown).toBe(true);
    expect(decodeShare("garbage")).toBeNull();
  });
  test("text card matches the blueprint layout", () => {
    const card = renderTextCard(data, "https://example.gg");
    expect(card).toContain("HYPE RIOT #042 - 8,450 PTS");
    expect(card).toContain("🟩🟩🟩🟨⬜ (+2,400)");
    expect(card).toContain("🔥 4/4 STREAK (+3,050)");
    expect(card).toContain("👑 CROWD FAVORITE (+3,000)");
    expect(card).toContain("Rank: ARENA HEADLINER ⚡");
    expect(card).toContain("https://example.gg/#seed-042-8450");
  });
});
