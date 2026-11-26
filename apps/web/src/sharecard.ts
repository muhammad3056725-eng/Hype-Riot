// HYPE RIOT sharecard PNG (Blueprint §2): 1200x630 pixel-styled card
// for Snapchat / Discord / X, drawn on canvas — no external assets.
import { renderTextCard, type ShareData } from "@hype-riot/riot-engine";

export function shareText(d: ShareData): string {
  return renderTextCard(d, location.href.split("#")[0]);
}

export function drawShareCardPng(d: ShareData): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 1200;
  c.height = 630;
  const ctx = c.getContext("2d");
  if (!ctx) return c;
  ctx.fillStyle = "#110E1B";
  ctx.fillRect(0, 0, 1200, 630);
  ctx.fillStyle = "#1E1735";
  ctx.fillRect(24, 24, 1152, 582);
  ctx.strokeStyle = "#FF2A85";
  ctx.lineWidth = 6;
  ctx.strokeRect(24, 24, 1152, 582);
  const font = (px: number) => `${px}px "Press Start 2P", monospace`;
  ctx.fillStyle = "#FEE440";
  ctx.font = font(44);
  ctx.fillText(`HYPE RIOT #${String(d.riotNumber).padStart(3, "0")}`, 64, 110);
  ctx.fillStyle = "#FFF8E7";
  ctx.font = font(30);
  ctx.fillText(`${d.totalScore.toLocaleString("en-US")} PTS`, 64, 175);
  ctx.font = font(20);
  ctx.fillStyle = "#00F5D4";
  ctx.fillText(`ROUND 1: TOP 5 RIOT  +${d.round1Score.toLocaleString("en-US")}  (${d.round1Hits} FOUND)`, 64, 255);
  ctx.fillStyle = "#FF70A6";
  ctx.fillText(`ROUND 2: FACT OR CAP  +${d.round2Score.toLocaleString("en-US")}  (${d.round2Correct}/4)`, 64, 325);
  ctx.fillStyle = "#A8FF35";
  ctx.fillText(`ROUND 3: THE PITCH  +${d.round3Score.toLocaleString("en-US")}${d.round3Crown ? "  CROWN!" : ""}`, 64, 395);
  ctx.fillStyle = "#FFD166";
  ctx.font = font(24);
  ctx.fillText(`RANK: ${d.rankTitle}`, 64, 485);
  ctx.fillStyle = "#8F79D2";
  ctx.font = font(16);
  ctx.fillText("THE 90-SECOND PIXEL GAME SHOW", 64, 555);
  // crowd strip
  const colors = ["#00F5D4", "#FF2A85", "#A8FF35", "#FEE440", "#00BBF9", "#F15BB5"];
  for (let i = 0; i < 48; i++) {
    ctx.fillStyle = colors[i % colors.length];
    const bounce = i % 3 === 0 ? -8 : 0;
    ctx.fillRect(64 + i * 23, 580 + bounce, 14, 26);
  }
  return c;
}

export function downloadShareCardPng(d: ShareData): void {
  const canvas = drawShareCardPng(d);
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hype-riot-${d.riotNumber}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }, "image/png");
}
