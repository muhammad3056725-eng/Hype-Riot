/**
 * HYPE RIOT — share text for a finished match, one layout per mode.
 * The PNG card (apps/web/src/sharecard.ts) uses the same ShareData.
 */
export type ShareMode = "daily" | "practice" | "quick" | "blitz";

export interface ShareData {
  mode: ShareMode;
  riotNumber: number; // Daily number (#331); informational for other modes
  promptText: string;
  totalScore: number;
  round1Score: number;
  round1Hits: number;
  round1Total: number;
  round2Score: number;
  round2Marks: boolean[]; // one per Fact-or-Cap card (empty in Blitz)
  round3Score: number;
  round3Crown: boolean;
  blitzTopFound: number; // Blitz only
  crowdBonus: number;
  hypePeak: number; // 0..100
  rankTitle: string;
}

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
export const pad3 = (n: number) => String(n).padStart(3, "0");

export function shareTitle(d: ShareData): string {
  switch (d.mode) {
    case "daily":
      return `HYPE RIOT #${pad3(d.riotNumber)}`;
    case "practice":
      return `HYPE RIOT #${pad3(d.riotNumber)} (practice)`;
    case "quick":
      return "HYPE RIOT Quick Arcade";
    case "blitz":
      return "HYPE RIOT Brainstorm Blitz";
  }
}

export function renderTextCard(d: ShareData, url: string): string {
  const squares =
    "🟩".repeat(Math.min(10, d.round1Hits)) +
    (d.round1Hits > 10 ? ` +${d.round1Hits - 10}` : "") +
    (d.round1Hits === 0 ? "⬜" : "");
  const lines = [`${shareTitle(d)} — ${fmt(d.totalScore)} pts`, ""];
  if (d.mode === "blitz") {
    lines.push(`“${d.promptText}”`);
    lines.push(`🔟 Top-10 found: ${d.blitzTopFound}/10`);
    lines.push(`${squares} ${d.round1Hits} answers (+${fmt(d.round1Score)})`);
  } else {
    lines.push(`Top 5 Riot   ${squares} (+${fmt(d.round1Score)})`);
    const marks = d.round2Marks.map((ok) => (ok ? "✅" : "❌")).join("");
    const correct = d.round2Marks.filter(Boolean).length;
    lines.push(`Fact or Cap  ${marks} ${correct}/${d.round2Marks.length} (+${fmt(d.round2Score)})`);
    lines.push(`The Pitch    ${d.round3Crown ? "👑 Crowd favorite" : "🎤"} (+${fmt(d.round3Score)})`);
  }
  if (d.crowdBonus > 0) lines.push(`Crowd bonus  🔥 peak hype ${Math.round(d.hypePeak)}% (+${fmt(d.crowdBonus)})`);
  lines.push("", `Rank: ${d.rankTitle.toUpperCase()} ⚡`, url);
  return lines.join("\n");
}
