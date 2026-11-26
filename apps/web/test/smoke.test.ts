// HYPE RIOT web integration tests against the real shipped dataset (jsdom).
// @vitest-environment jsdom
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { comboCoverage, crowdVariance } from "@hype-riot/riot-engine";
import type { ContentPack, DataManifest } from "@hype-riot/shared-types";
import { dailyFor } from "../src/data";
import { LocalSaveDB } from "../src/db/LocalSaveDB";
import { HypeMeter } from "../src/game/HypeMeter";
import { crowdBonus, hypeCoins, tierForXp } from "../src/game/Progression";
import { Round1Top5 } from "../src/game/Round1Top5";
import {
  REVEAL_MS, Round2FactOrCap, SECONDS_PER_CARD, clashWinner, streakMultiplier,
} from "../src/game/Round2FactOrCap";
import { Round3Pitch } from "../src/game/Round3Pitch";

const DATA = resolve(__dirname, "../../../public/data/v1");
const manifest = JSON.parse(readFileSync(resolve(DATA, "manifest.json"), "utf-8")) as DataManifest;
const packFiles = readdirSync(resolve(DATA, "packs")).filter((f) => /^pack_\d{3}\.json$/.test(f));
const packs = packFiles.map((f) => JSON.parse(readFileSync(resolve(DATA, "packs", f), "utf-8")) as ContentPack);
const pack = packs[0];

describe("dataset", () => {
  it("ships 120+ packs that match the manifest", () => {
    expect(packs.length).toBe(manifest.packs);
    expect(manifest.packs).toBeGreaterThanOrEqual(120);
  });

  it("every combo tag covers 20-40% of its answers (same evaluator as the game)", () => {
    for (const p of packs) {
      const cov = comboCoverage(p.round1.comboTag, p.round1.answers.map((a) => a.name));
      expect(cov, `${p.round1.id}: ${p.round1.comboTag.label}`).toBeGreaterThanOrEqual(0.2);
      expect(cov, `${p.round1.id}: ${p.round1.comboTag.label}`).toBeLessThanOrEqual(0.4);
    }
  });

  it("clash winners are spread over both sides", () => {
    const sides = packs.flatMap((p) => p.round2.filter((c) => c.type === "CLASH").map((c) => (c.type === "CLASH" ? clashWinner(c) : "A")));
    const aShare = sides.filter((s) => s === "A").length / sides.length;
    expect(aShare).toBeGreaterThan(0.3);
    expect(aShare).toBeLessThan(0.7);
  });
});

describe("daily schedule (matches pipeline/daily.py)", () => {
  it("agrees with the Python-computed check dates", () => {
    for (const [date, packId] of Object.entries(manifest.dailyCheck)) {
      expect(dailyFor(new Date(`${date}T12:00:00Z`), manifest).packId).toBe(packId);
    }
  });

  it("never repeats a pack within packCount consecutive days", () => {
    const seen = new Set<number>();
    for (let i = 0; i < manifest.packs; i++) {
      seen.add(dailyFor(new Date(Date.UTC(2026, 0, 1 + i)), manifest).packId);
    }
    expect(seen.size).toBe(manifest.packs);
    expect(dailyFor(new Date(Date.UTC(2026, 10, 26)), manifest).riotNumber).toBe(330);
  });
});

describe("round 1 with a real pack", () => {
  it("scores hits, flags duplicates, and ends on the wall clock", () => {
    const r1 = new Round1Top5(pack.round1, 0);
    const top = pack.round1.answers[0];
    const hit = r1.submit(top.name, 1000);
    expect(hit && hit !== "DUPLICATE" && hit.topTen).toBe(true);
    expect(r1.score).toBeGreaterThanOrEqual(150);
    expect(r1.submit(top.name.toUpperCase(), 1100)).toBe("DUPLICATE");
    expect(r1.submit("zzzz qqqq", 1200)).toBeNull();
    expect(r1.isOver(24_900)).toBe(false);
    expect(r1.isOver(25_000)).toBe(true);
    expect(r1.submit(pack.round1.answers[1].name, 25_001)).toBeNull();
  });
});

describe("round 2 streaks, reveal lock and timers", () => {
  const answerRight = (r2: Round2FactOrCap, now: number) => {
    const c = r2.current!;
    if (c.type === "CLAIM") return r2.answerClaim(c.isFact, now);
    if (c.type === "CLASH") return r2.answerClash(clashWinner(c), now);
    return r2.answerZoom(c.answer, now);
  };

  it("streak multipliers", () => {
    expect([0, 1, 2, 3, 4].map(streakMultiplier)).toEqual([1, 1, 1.5, 2, 2]);
  });

  it("four correct answers pay 400 + 600 + 800 + 800, with a locked reveal between cards", () => {
    const r2 = new Round2FactOrCap(pack.round2, 0);
    let now = 0;
    for (let i = 0; i < 4; i++) {
      expect(answerRight(r2, now)?.correct).toBe(true);
      expect(answerRight(r2, now + 10)).toBeNull(); // double tap during reveal is ignored
      now += REVEAL_MS;
      r2.update(now);
    }
    expect(r2.finished).toBe(true);
    expect(r2.score).toBe(2600);
  });

  it("a timeout counts as wrong, reveals, then moves on", () => {
    const r2 = new Round2FactOrCap(pack.round2, 0);
    const ev = r2.update(SECONDS_PER_CARD * 1000 + 1);
    expect(ev[0]?.kind).toBe("timeout");
    expect(r2.phase).toBe("reveal");
    r2.update(SECONDS_PER_CARD * 1000 + REVEAL_MS + 2);
    expect(r2.index).toBe(1);
    expect(r2.phase).toBe("ask");
  });

  it("a long hidden-tab gap times out every remaining card (no soft-lock)", () => {
    const r2 = new Round2FactOrCap(pack.round2, 0);
    r2.update(10 * 60 * 1000);
    expect(r2.finished).toBe(true);
    expect(r2.results.every((r) => r.timedOut)).toBe(true);
  });

  it("an empty card list finishes immediately", () => {
    expect(new Round2FactOrCap([], 0).finished).toBe(true);
  });
});

describe("round 3 pitch", () => {
  it("scores both wildcards + verb and substitutes the template", () => {
    const r3 = new Round3Pitch(pack.round3, 12345, 0);
    expect(r3.promptText).not.toContain("{A}");
    const text = `Racing ${pack.round3.wildcardA} crash into ${pack.round3.wildcardB} at midnight`;
    const res = r3.submit(text);
    expect(res.wildcard1 && res.wildcard2 && res.actionVerb).toBe(true);
    expect(res.total).toBe(650 + crowdVariance(12345, text));
  });
});

describe("progression + save", () => {
  it("coins, tiers and crowd bonus", () => {
    expect(hypeCoins(8450, 3, 25)).toBe(84 + 45 + 25);
    expect(hypeCoins(-50, 0, 0)).toBe(0);
    expect(tierForXp(4999)).toBe("ROOKIE SPECTATOR");
    expect(tierForXp(150000)).toBe("HYPE LEGEND");
    expect(crowdBonus(80)).toBe(400);
  });

  it("one scored Daily per date; streak counts consecutive days; stale streaks reset", () => {
    localStorage.clear();
    const db = new LocalSaveDB();
    expect(db.recordDaily("2026-11-26", 3000)).toBe(1);
    expect(db.recordDaily("2026-11-26", 9999)).toBeNull(); // replay = practice
    expect(db.get().dailyScores["2026-11-26"]).toBe(3000);
    expect(db.recordDaily("2026-11-27", 100)).toBe(2);
    expect(db.currentStreak("2026-11-28")).toBe(2);
    expect(db.currentStreak("2026-11-30")).toBe(0);
    expect(db.recordDaily("2026-11-30", 100)).toBe(1);
  });

  it("unlocks are slot-scoped", () => {
    localStorage.clear();
    const db = new LocalSaveDB();
    db.update({ unlocked: ["sneakers:neon"] });
    expect(db.isUnlocked("sneakers", "neon")).toBe(true);
    expect(db.isUnlocked("hoodie", "neon")).toBe(false);
  });

  it("hype meter clamps, tracks its peak and cools down", () => {
    const h = new HypeMeter();
    h.add(200);
    expect(h.value).toBe(100);
    h.update(5);
    expect(h.value).toBeLessThan(100);
    expect(h.peak).toBe(100);
  });
});
