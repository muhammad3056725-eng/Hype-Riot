// HYPE RIOT share card: text (clipboard / native share) and a 1200x630
// PNG drawn on canvas with the same neon arena styling.
import { renderTextCard, shareTitle, type ShareData } from "@hype-riot/riot-engine";

/** Canonical page URL: origin + path, no hash/query (no double slashes). */
export function pageUrl(): string {
  return `${location.origin}${location.pathname}`;
}

export function shareText(d: ShareData): string {
  return renderTextCard(d, pageUrl());
}

export function drawShareCardPng(d: ShareData): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 1200;
  c.height = 630;
  const ctx = c.getContext("2d");
  if (!ctx) return c;
  const bg = ctx.createLinearGradient(0, 0, 1200, 630);
  bg.addColorStop(0, "#14072e");
  bg.addColorStop(0.55, "#2a0d52");
  bg.addColorStop(1, "#4a0f4f");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1200, 630);
  // beams
  ctx.globalCompositeOperation = "lighter";
  const beam = (x: number, color: string, tilt: number) => {
    const g = ctx.createLinearGradient(x, 0, x + tilt, 630);
    g.addColorStop(0, color + "88");
    g.addColorStop(1, color + "00");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - 6, 0);
    ctx.lineTo(x + 6, 0);
    ctx.lineTo(x + tilt + 120, 630);
    ctx.lineTo(x + tilt - 120, 630);
    ctx.closePath();
    ctx.fill();
  };
  beam(180, "#ff2d95", 160);
  beam(620, "#29f0ff", -60);
  beam(1040, "#9b5cff", -200);
  ctx.globalCompositeOperation = "source-over";

  const font = (weight: number, px: number) => `${weight} ${px}px system-ui, "Segoe UI", Roboto, sans-serif`;
  ctx.fillStyle = "#ffe066";
  ctx.font = font(900, 64);
  ctx.shadowColor = "#ff2d95";
  ctx.shadowBlur = 24;
  ctx.fillText(shareTitle(d).toUpperCase(), 64, 120);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#ffffff";
  ctx.font = font(900, 110);
  ctx.fillText(`${d.totalScore.toLocaleString("en-US")}`, 64, 250);
  ctx.font = font(700, 34);
  ctx.fillStyle = "#c9b8ff";
  ctx.fillText("HYPE POINTS", 70, 296);

  const rows: Array<[string, string, string]> =
    d.mode === "blitz"
      ? [
          ["#29f0ff", "Top-10 found", `${d.blitzTopFound}/10`],
          ["#ff9bd2", "Answers", `${d.round1Hits}`],
          ["#7dff6b", "Crowd bonus", `+${d.crowdBonus.toLocaleString("en-US")}`],
        ]
      : [
          ["#29f0ff", "Top 5 Riot", `${d.round1Hits} found · +${d.round1Score.toLocaleString("en-US")}`],
          ["#ff9bd2", "Fact or Cap", `${d.round2Marks.filter(Boolean).length}/${d.round2Marks.length} · +${d.round2Score.toLocaleString("en-US")}`],
          ["#7dff6b", "The Pitch", `${d.round3Crown ? "Crowd favorite · " : ""}+${d.round3Score.toLocaleString("en-US")}`],
        ];
  rows.forEach(([color, label, value], i) => {
    const y = 370 + i * 64;
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.beginPath();
    ctx.roundRect?.(64, y - 42, 660, 54, 14);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.font = font(800, 30);
    ctx.fillText(label, 88, y - 6);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "right";
    ctx.fillText(value, 700, y - 6);
    ctx.textAlign = "left";
  });
  ctx.fillStyle = "#ffe066";
  ctx.font = font(800, 30);
  ctx.fillText(`RANK: ${d.rankTitle}`, 64, 590);
  // lightning badge
  ctx.save();
  ctx.translate(930, 300);
  ctx.scale(4.2, 4.2);
  ctx.fillStyle = "#ff2d95";
  ctx.beginPath();
  ctx.moveTo(6, -30); ctx.lineTo(-16, 2); ctx.lineTo(-2, 2); ctx.lineTo(-8, 30); ctx.lineTo(18, -6); ctx.lineTo(4, -6); ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#ffe066";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
  return c;
}

export function downloadShareCardPng(d: ShareData): void {
  const canvas = drawShareCardPng(d);
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hype-riot-${d.mode}-${d.riotNumber}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }, "image/png");
}
