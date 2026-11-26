/**
 * HYPE RIOT — ShareCardEncoder (Blueprint §2 sharecard, §6).
 * Encodes a match result into a compact URL-safe string and renders
 * the blueprint's text sharecard format.
 */
export interface ShareData {
  riotNumber: number;
  totalScore: number;
  round1Score: number;
  round1Hits: number; // answers found
  round1Slots: number; // squares shown (5)
  round2Score: number;
  round2Correct: number; // of 4
  round3Score: number;
  round3Crown: boolean; // crowd favorite (top pitch outcome)
  rankTitle: string;
}

/** Compact encode: HR.<riot>.<total>.<r1>.<hits>.<r2>.<correct>.<r3>.<crown> in base36. */
export function encodeShare(d: ShareData): string {
  const parts = [
    d.riotNumber,
    d.totalScore,
    d.round1Score,
    d.round1Hits,
    d.round2Score,
    d.round2Correct,
    d.round3Score,
    d.round3Crown ? 1 : 0,
  ];
  return "HR1-" + parts.map((n) => n.toString(36)).join(".");
}

export function decodeShare(s: string): Omit<ShareData, "rankTitle" | "round1Slots"> | null {
  if (!s.startsWith("HR1-")) return null;
  const nums = s
    .slice(4)
    .split(".")
    .map((p) => parseInt(p, 36));
  if (nums.length !== 8 || nums.some((n) => Number.isNaN(n))) return null;
  return {
    riotNumber: nums[0],
    totalScore: nums[1],
    round1Score: nums[2],
    round1Hits: nums[3],
    round2Score: nums[4],
    round2Correct: nums[5],
    round3Score: nums[6],
    round3Crown: nums[7] === 1,
  };
}

const fmt = (n: number) => n.toLocaleString("en-US");
const pad3 = (n: number) => String(n).padStart(3, "0");

/** Blueprint §2 text sharecard, verbatim layout. */
export function renderTextCard(d: ShareData, baseUrl: string): string {
  const squares = Array.from({ length: d.round1Slots }, (_, i) =>
    i < d.round1Hits ? "🟩" : i === d.round1Hits ? "🟨" : "⬜"
  ).join("");
  const r2 =
    d.round2Correct === 4
      ? `🔥 4/4 STREAK`
      : `${d.round2Correct}/4 CORRECT`;
  const r3 = d.round3Crown ? "👑 CROWD FAVORITE" : "THE PITCH";
  return [
    `HYPE RIOT #${pad3(d.riotNumber)} - ${fmt(d.totalScore)} PTS`,
    ``,
    `Round 1: [Top 5 Riot]   ${squares} (+${fmt(d.round1Score)})`,
    ``,
    `Round 2: [Fact or Cap]  ${r2} (+${fmt(d.round2Score)})`,
    ``,
    `Round 3: [The Pitch]   ${r3} (+${fmt(d.round3Score)})`,
    ``,
    `Rank: ${d.rankTitle.toUpperCase()} ⚡`,
    ``,
    `${baseUrl}/#seed-${pad3(d.riotNumber)}-${d.totalScore}`,
  ].join("\n");
}
