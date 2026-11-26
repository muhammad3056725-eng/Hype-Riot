// HYPE RIOT web smoke + integration tests (jsdom).
// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { dailyFor } from "../src/data";
import { Round1Top5 } from "../src/game/Round1Top5";
import { Round2FactOrCap, streakMultiplier } from "../src/game/Round2FactOrCap";
import { Round3Pitch } from "../src/game/Round3Pitch";
import { hypeCoins, tierForXp } from "../src/game/Progression";
import { LocalSaveDB } from "../src/db/LocalSaveDB";
import type { ContentPack } from "@hype-riot/shared-types";

const packPath = resolve(__dirname, "../../../public/data/v1/packs/pack_000.json");
const pack = JSON.parse(readFileSync(packPath, "utf-8")) as ContentPack;

describe("daily seed (matches pipeline/daily.py)", () => {
  it("computes riot number, pack and arena deterministically", () => {
    const d = dailyFor(new Date(Date.UTC(2026, 10, 26)), 30);
    expect(d.date).toBe("2026-11-26");
    expect(d.riotNumber).toBe(330);
    expect(d.packId).toBe(d.seed % 30);
    expect(d.arenaTheme).toBe(d.seed % 6);
    expect(dailyFor(new Date(Date.UTC(2026, 10, 26)), 30)).toEqual(d);
  });
});

describe("round 1 with the real shipped pack", () => {
  it("pack_000 is the blueprint's boss prompt with >= 25 answers", () => {
    expect(pack.round1.text).toContain("bosses");
    expect(pack.round1.answers.length).toBeGreaterThanOrEqual(25);
  });

  it("slang + typo hits score blueprint values", () => {
    const r1 = new Round1Top5(pack.round1);
    const hit = r1.submit("bowser");
    expect(hit && hit !== "DUPLICATE" && hit.name).toBe("Bowser");
    expect(r1.score).toBeGreaterThanOrEqual(150);
    const dup = r1.submit("Bowser");
    expect(dup).toBe("DUPLICATE");
    const miss = r1.submit("zzzz not a boss");
    expect(miss).toBeNull();
  });

  it("timer ends the round at 25s", () => {
    const r1 = new Round1Top5(pack.round1);
    r1.tick(24.9);
    expect(r1.finished).toBe(false);
    r1.tick(0.2);
    expect(r1.finished).toBe(true);
    expect(r1.timeLeft).toBe(0);
  });
});

describe("round 2 streaks and timers", () => {
  it("streak multiplier table matches the blueprint", () => {
    expect(streakMultiplier(0)).toBe(1.0);
    expect(streakMultiplier(1)).toBe(1.0);
    expect(streakMultiplier(2)).toBe(1.5);
    expect(streakMultiplier(3)).toBe(2.0);
    expect(streakMultiplier(4)).toBe(2.0);
  });

  it("four correct answers build the streak to 2.0x", () => {
    const r2 = new Round2FactOrCap(pack.round2);
    for (let i = 0; i < 4; i++) {
      const card = r2.current;
      if (!card) break;
      if (card.type === "CLAIM") r2.answerClaim(card.isFact);
      else if (card.type === "CLASH") r2.answerClash(card.aValue >= card.bValue ? "A" : "B");
      else r2.answerZoom(card.answer);
    }
    expect(r2.finished).toBe(true);
    expect(r2.bestStreak).toBe(4);
    // streak pays 400 (x1.0) + 600 (x1.5) + 800 (x2.0) + 800 (x2.0)
    expect(r2.score).toBe(2600);
  });

  it("a timeout counts as wrong and resets the streak", () => {
    const r2 = new Round2FactOrCap(pack.round2);
    const res = r2.tick(7.01);
    expect(res?.correct).toBe(false);
    expect(r2.streak).toBe(0);
    expect(r2.index).toBe(1);
  });

  it("zoom reveal grows over the card window", () => {
    const r2 = new Round2FactOrCap(pack.round2);
    while (r2.current?.type !== "ZOOM" && !r2.finished) {
      const c = r2.current;
      if (c?.type === "CLAIM") r2.answerClaim(true);
      else if (c?.type === "CLASH") r2.answerClash("A");
    }
    expect(r2.zoomReveal).toBe(0);
    r2.tick(3.5);
    expect(r2.zoomReveal).toBeCloseTo(0.5, 1);
  });
});

describe("round 3 pitch", () => {
  it("scores a full-marks pitch with the blueprint formula", () => {
    const r3 = new Round3Pitch(pack.round3, 12345);
    const text = `Race the ${pack.round3.wildcardA} into the ${pack.round3.wildcardB ?? "arena"} at midnight`;
    const res = r3.submit(text);
    expect(res.wildcard1).toBe(true);
    if (pack.round3.wildcardB) expect(res.wildcard2).toBe(true);
    expect(res.total).toBeGreaterThanOrEqual(500);
  });

  it("prompt text substitutes both wildcards", () => {
    const r3 = new Round3Pitch(pack.round3, 1);
    expect(r3.promptText).not.toContain("{A}");
    expect(r3.promptText).toContain(pack.round3.wildcardA);
  });
});

describe("progression + save", () => {
  it("coin formula: floor(hype/100) + streak x 15 + victory bonus", () => {
    expect(hypeCoins(8450, 3, 25)).toBe(84 + 45 + 25);
    expect(hypeCoins(99, 0, 0)).toBe(0);
  });

  it("tier thresholds match the blueprint table", () => {
    expect(tierForXp(0)).toBe("ROOKIE SPECTATOR");
    expect(tierForXp(4999)).toBe("ROOKIE SPECTATOR");
    expect(tierForXp(5000)).toBe("MEME SCOUT");
    expect(tierForXp(75000)).toBe("ARENA HEADLINER");
    expect(tierForXp(150000)).toBe("HYPE LEGEND");
  });

  it("daily streak increments on consecutive days only", () => {
    localStorage.clear();
    const db = new LocalSaveDB();
    expect(db.recordDaily("2026-11-26")).toBe(1);
    expect(db.recordDaily("2026-11-26")).toBe(1);
    expect(db.recordDaily("2026-11-27")).toBe(2);
    expect(db.recordDaily("2026-11-30")).toBe(1);
  });
});
