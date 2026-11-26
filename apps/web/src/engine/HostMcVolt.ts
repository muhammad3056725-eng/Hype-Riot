// HYPE RIOT host MC VOLT: a smooth vector robot MC with a glowing
// monitor head. Expressions are drawn on the screen; arms, antenna and
// body are animated (bob, talk, cheer, panic, mic drop...). Transient
// moods fall back to IDLE_TALK after a moment.
import { glowSprite, withAlpha } from "./Shaders";

export type VoltState =
  | "IDLE_TALK" | "HYPER_MIC_DROP" | "MIND_BLOWN" | "SIDE_EYE"
  | "LAUGHING_FIT" | "PANIC_COUNTDOWN" | "FIRE_SUNGLASSES"
  | "CONFETTI_DANCE" | "WRONG_BUZZER" | "SLEEPING" | "VICTORY_SPIN";

const TRANSIENT: VoltState[] = ["HYPER_MIC_DROP", "MIND_BLOWN", "WRONG_BUZZER", "LAUGHING_FIT", "VICTORY_SPIN", "SIDE_EYE"];

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export class HostMcVolt {
  state: VoltState = "IDLE_TALK";
  private stateTime = 0;
  private time = 0;

  setState(state: VoltState): void {
    this.state = state;
    this.stateTime = 0;
  }

  update(dt: number): void {
    this.time += dt;
    this.stateTime += dt;
    if (TRANSIENT.includes(this.state) && this.stateTime > 1.6) this.setState("IDLE_TALK");
  }

  /** Draws Volt standing with feet at (x, floorY); `size` = total height in css px. */
  draw(ctx: CanvasRenderingContext2D, x: number, floorY: number, size: number, accent: string, reduced: boolean): void {
    const t = this.time;
    const s = size / 200; // design units: 200 tall
    const m = reduced ? 0.3 : 1;
    const st = this.state;
    const dancing = st === "CONFETTI_DANCE" || st === "VICTORY_SPIN";
    const bob = (dancing ? Math.sin(t * 9) * 6 : Math.sin(t * 2.2) * 2.5) * m;
    const lean = (dancing ? Math.sin(t * 4.5) * 0.12 : st === "SIDE_EYE" ? -0.06 : 0) * m;
    const shake = st === "WRONG_BUZZER" || st === "PANIC_COUNTDOWN" ? Math.sin(t * 50) * 2 * m : 0;

    ctx.save();
    ctx.translate(x + shake, floorY);
    ctx.scale(s, s);
    ctx.rotate(lean);

    // floor shadow + aura
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.beginPath();
    ctx.ellipse(0, 0, 52, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.5;
    ctx.drawImage(glowSprite(accent, 128), -110, -230 + bob, 220, 220);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    ctx.translate(0, bob);
    // legs
    ctx.fillStyle = "#1b1738";
    roundRect(ctx, -26, -58, 18, 58, 8); ctx.fill();
    roundRect(ctx, 8, -58, 18, 58, 8); ctx.fill();
    ctx.fillStyle = accent;
    roundRect(ctx, -32, -12, 28, 12, 6); ctx.fill();
    roundRect(ctx, 4, -12, 28, 12, 6); ctx.fill();

    // torso (jacket)
    const torso = ctx.createLinearGradient(0, -130, 0, -55);
    torso.addColorStop(0, "#3b2f7a");
    torso.addColorStop(1, "#1d1745");
    ctx.fillStyle = torso;
    roundRect(ctx, -40, -132, 80, 82, 22); ctx.fill();
    ctx.strokeStyle = withAlpha(accent, 0.9);
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, -128); ctx.lineTo(0, -56); ctx.stroke();
    // lightning badge
    ctx.fillStyle = "#ffe066";
    ctx.beginPath();
    ctx.moveTo(-20, -112); ctx.lineTo(-28, -96); ctx.lineTo(-21, -96); ctx.lineTo(-25, -84); ctx.lineTo(-13, -101); ctx.lineTo(-20, -101); ctx.closePath();
    ctx.fill();

    // arms
    const armUp = dancing || st === "MIND_BLOWN" || st === "HYPER_MIC_DROP";
    const panic = st === "PANIC_COUNTDOWN";
    const wave = Math.sin(t * (dancing ? 10 : 3)) * m;
    ctx.strokeStyle = "#2b2361";
    ctx.lineCap = "round";
    ctx.lineWidth = 14;
    // left arm
    ctx.beginPath();
    ctx.moveTo(-38, -120);
    if (armUp || panic) ctx.quadraticCurveTo(-70, -150, -58 + wave * 6, -190);
    else ctx.quadraticCurveTo(-62, -95, -54, -70 + wave * 2);
    ctx.stroke();
    // right arm holding the mic (unless it was dropped)
    const micDropped = st === "HYPER_MIC_DROP" && this.stateTime > 0.35;
    ctx.beginPath();
    ctx.moveTo(38, -120);
    const handX = armUp ? 62 - wave * 6 : 58;
    const handY = armUp ? -188 : -128 + Math.sin(t * 6) * 3 * m;
    ctx.quadraticCurveTo(66, -112, handX, handY);
    ctx.stroke();
    ctx.fillStyle = "#e9e6ff";
    ctx.beginPath(); ctx.arc(-58 + (armUp || panic ? wave * 6 : 4), armUp || panic ? -192 : -68, 8, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(handX, handY, 8, 0, Math.PI * 2); ctx.fill();
    if (!micDropped) {
      ctx.fillStyle = "#cfd3e6";
      roundRect(ctx, handX - 4, handY - 30, 8, 26, 3); ctx.fill();
      ctx.fillStyle = "#2a2a3a";
      ctx.beginPath(); ctx.arc(handX, handY - 34, 9, 0, Math.PI * 2); ctx.fill();
    } else {
      const fall = Math.min(1, (this.stateTime - 0.35) * 2.5);
      ctx.fillStyle = "#2a2a3a";
      ctx.beginPath(); ctx.arc(handX + 10 + fall * 14, handY + fall * (-10 - handY), 9, 0, Math.PI * 2); ctx.fill();
    }

    // neck + monitor head
    ctx.fillStyle = "#2b2361";
    roundRect(ctx, -10, -146, 20, 18, 5); ctx.fill();
    const headY = -212;
    ctx.fillStyle = "#231c52";
    roundRect(ctx, -54, headY, 108, 72, 18); ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.stroke();
    // antenna
    ctx.strokeStyle = "#8f86c9";
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, headY); ctx.lineTo(0, headY - 20); ctx.stroke();
    const blink = Math.sin(t * 5) > 0 ? "#ff2d95" : "#ffe066";
    ctx.globalCompositeOperation = "lighter";
    ctx.drawImage(glowSprite(blink, 64), -18, headY - 46, 36, 36);
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = blink;
    ctx.beginPath(); ctx.arc(0, headY - 28, 6, 0, Math.PI * 2); ctx.fill();

    // screen
    const sx = -44, sy = headY + 9, sw = 88, sh = 54;
    const scr = ctx.createLinearGradient(0, sy, 0, sy + sh);
    scr.addColorStop(0, "#29f0ff");
    scr.addColorStop(1, "#1c7cff");
    ctx.fillStyle = scr;
    roundRect(ctx, sx, sy, sw, sh, 10); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    roundRect(ctx, sx + 4, sy + 3, sw - 8, 12, 6); ctx.fill();
    this.drawFace(ctx, sx, sy, sw, sh, t, reduced);
    ctx.restore();
  }

  private drawFace(ctx: CanvasRenderingContext2D, sx: number, sy: number, sw: number, sh: number, t: number, reduced: boolean): void {
    const ink = "#081028";
    const cx = sx + sw / 2;
    const ey = sy + sh * 0.42;
    const blinkClosed = !reduced && (t % 3.7) < 0.12;
    const eye = (dx: number, w = 10, h = 14) => {
      ctx.fillStyle = ink;
      roundRect(ctx, cx + dx - w / 2, ey - (blinkClosed ? 1.5 : h / 2), w, blinkClosed ? 3 : h, 4);
      ctx.fill();
    };
    const mouth = (w: number, open: number, smile = true) => {
      ctx.fillStyle = ink;
      ctx.beginPath();
      const my = sy + sh * 0.72;
      if (smile) {
        ctx.moveTo(cx - w / 2, my);
        ctx.quadraticCurveTo(cx, my + open * 2, cx + w / 2, my);
        ctx.quadraticCurveTo(cx, my + open * 0.6, cx - w / 2, my);
      } else {
        ctx.moveTo(cx - w / 2, my + open);
        ctx.quadraticCurveTo(cx, my - open, cx + w / 2, my + open);
        ctx.lineTo(cx + w / 2, my + open + 3);
        ctx.quadraticCurveTo(cx, my - open + 3, cx - w / 2, my + open + 3);
      }
      ctx.closePath();
      ctx.fill();
    };
    const star = (dx: number, color: string) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? 9 : 4;
        const a = -Math.PI / 2 + (i * Math.PI) / 5 + t * 2;
        ctx.lineTo(cx + dx + Math.cos(a) * r, ey + Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
    };
    switch (this.state) {
      case "IDLE_TALK":
        eye(-18); eye(18);
        mouth(24, 4 + Math.abs(Math.sin(t * 7)) * 6);
        break;
      case "SIDE_EYE":
        eye(-10, 10, 8); eye(26, 10, 8);
        mouth(18, 0.5, false);
        break;
      case "MIND_BLOWN":
        ctx.strokeStyle = ink; ctx.lineWidth = 3;
        for (const dx of [-18, 18]) { ctx.beginPath(); ctx.arc(cx + dx, ey, 7 + Math.sin(t * 12) * 1.5, 0, Math.PI * 2); ctx.stroke(); }
        ctx.fillStyle = ink; ctx.beginPath(); ctx.ellipse(cx, sy + sh * 0.76, 7, 8, 0, 0, Math.PI * 2); ctx.fill();
        break;
      case "LAUGHING_FIT":
        ctx.strokeStyle = ink; ctx.lineWidth = 3.5; ctx.lineCap = "round";
        for (const dx of [-18, 18]) { ctx.beginPath(); ctx.arc(cx + dx, ey + 3, 7, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
        mouth(30, 10);
        break;
      case "PANIC_COUNTDOWN":
        eye(-18, 12, 16); eye(18, 12, 16);
        ctx.fillStyle = ink; ctx.beginPath(); ctx.ellipse(cx, sy + sh * 0.77, 6, 5 + Math.abs(Math.sin(t * 14)) * 3, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.beginPath(); ctx.ellipse(sx + sw - 10, sy + 14 + ((t * 30) % 20), 3, 5, 0, 0, Math.PI * 2); ctx.fill();
        break;
      case "FIRE_SUNGLASSES":
        ctx.fillStyle = ink;
        roundRect(ctx, cx - 34, ey - 9, 30, 16, 6); ctx.fill();
        roundRect(ctx, cx + 4, ey - 9, 30, 16, 6); ctx.fill();
        ctx.fillRect(cx - 6, ey - 6, 12, 4);
        mouth(22, 3);
        break;
      case "WRONG_BUZZER":
        ctx.strokeStyle = ink; ctx.lineWidth = 4; ctx.lineCap = "round";
        for (const dx of [-18, 18]) {
          ctx.beginPath(); ctx.moveTo(cx + dx - 6, ey - 6); ctx.lineTo(cx + dx + 6, ey + 6);
          ctx.moveTo(cx + dx + 6, ey - 6); ctx.lineTo(cx + dx - 6, ey + 6); ctx.stroke();
        }
        mouth(22, 4, false);
        break;
      case "SLEEPING":
        ctx.strokeStyle = ink; ctx.lineWidth = 3;
        for (const dx of [-18, 18]) { ctx.beginPath(); ctx.moveTo(cx + dx - 7, ey + 2); ctx.lineTo(cx + dx + 7, ey + 2); ctx.stroke(); }
        mouth(10, 2, false);
        break;
      case "CONFETTI_DANCE":
      case "VICTORY_SPIN":
      case "HYPER_MIC_DROP":
        star(-18, "#ffe066"); star(18, "#ff2d95");
        mouth(30, 9);
        break;
    }
  }
}
