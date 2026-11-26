// HYPE RIOT crowd: rows of silhouettes in perspective (small and dim at
// the back, big at the front) with rim light, glowsticks and phone
// lights. Energy (the hype meter) drives bounce height and how many
// glowsticks are up; reactions trigger travelling cheer waves, gasps or
// boos. Drawing is batched: one silhouette path per row and one stroke
// per glowstick color per frame.
import { CONFETTI_COLORS } from "./Particles";
import { mix, withAlpha } from "./Shaders";

export type CrowdReaction = "cheer" | "wave" | "gasp" | "boo";

interface Member {
  x: number; // 0..1 across the row
  phase: number;
  speed: number;
  stick: number; // glowstick color index, or -1 for a phone light
  stickThreshold: number; // energy needed to raise it
  tone: number; // 0..1 silhouette shade variation
}

interface Row {
  depth: number; // 0 front .. 1 back
  members: Member[];
}

export class CrowdSystem {
  private rows: Row[] = [];
  private time = 0;
  private wave: { t: number; dir: number } | null = null;
  private gaspUntil = 0;
  private booUntil = 0;
  private cheerUntil = 0;

  layout(width: number, rowsCount: number): void {
    this.rows = [];
    let seed = 1337;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let r = rowsCount - 1; r >= 0; r--) {
      const depth = rowsCount === 1 ? 0 : r / (rowsCount - 1);
      const spacing = 34 - depth * 14; // px between heads (css px)
      const count = Math.max(8, Math.ceil(width / spacing) + 2);
      const members: Member[] = [];
      for (let i = 0; i < count; i++) {
        members.push({
          x: (i + 0.5 + (rand() - 0.5) * 0.5) / count,
          phase: rand() * Math.PI * 2,
          speed: 0.8 + rand() * 0.5,
          stick: rand() < 0.18 ? -1 : (rand() * CONFETTI_COLORS.length) | 0,
          stickThreshold: rand(),
          tone: rand(),
        });
      }
      this.rows.push({ depth, members });
    }
  }

  react(kind: CrowdReaction): void {
    if (kind === "cheer") {
      this.cheerUntil = this.time + 1.4;
      this.wave = { t: 0, dir: Math.random() < 0.5 ? 1 : -1 };
    } else if (kind === "wave") {
      this.wave = { t: 0, dir: 1 };
    } else if (kind === "gasp") {
      this.gaspUntil = this.time + 0.8;
    } else {
      this.booUntil = this.time + 1.5;
    }
  }

  update(dt: number): void {
    this.time += dt;
    if (this.wave) {
      this.wave.t += dt / 1.3;
      if (this.wave.t > 1.4) this.wave = null;
    }
  }

  /**
   * @param top     y (css px) of the back row's head line
   * @param bottom  bottom of the viewport
   * @param energy  0..1 hype
   * @param rim     rim-light color (theme accent)
   */
  draw(ctx: CanvasRenderingContext2D, width: number, top: number, bottom: number, energy: number, rim: string, reduced: boolean): void {
    const t = this.time;
    const booing = t < this.booUntil;
    const gasping = t < this.gaspUntil;
    const cheering = t < this.cheerUntil;
    const span = bottom - top;
    const motion = reduced ? 0.25 : 1;
    const stickColors = CONFETTI_COLORS;

    for (const row of this.rows) {
      const scale = 1.35 - row.depth * 0.75; // front rows bigger
      const baseY = top + span * (0.18 + (1 - row.depth) * 0.62);
      const headR = 9 * scale;
      const shoulder = 17 * scale;
      const bodyH = 46 * scale;
      const shade = mix("#0a0818", "#2a2050", (1 - row.depth) * 0.55);
      const glowSticks: Array<Path2D | null> = stickColors.map(() => null);
      let phones: Path2D | null = null;
      const body = new Path2D();
      const rimPath = new Path2D();

      for (const m of row.members) {
        const x = m.x * width;
        let bounce = Math.sin(t * (2.2 + energy * 5) * m.speed + m.phase);
        bounce = Math.max(0, bounce) * (2 + energy * 12) * scale * motion;
        if (this.wave) {
          const pos = this.wave.dir > 0 ? m.x : 1 - m.x;
          const d = (pos - (this.wave.t - 0.2)) / 0.09;
          bounce += Math.exp(-d * d) * 26 * scale * motion;
        }
        if (cheering) bounce += 6 * scale * motion * Math.abs(Math.sin(t * 9 + m.phase));
        if (booing) bounce = -4 * scale;
        if (gasping) bounce += 3 * scale * motion;
        const y = baseY - bounce;
        // silhouette: shoulders (rounded body) + head
        body.moveTo(x - shoulder, y + bodyH);
        body.quadraticCurveTo(x - shoulder, y + headR * 1.2, x, y + headR * 1.1);
        body.quadraticCurveTo(x + shoulder, y + headR * 1.2, x + shoulder, y + bodyH);
        body.closePath();
        body.moveTo(x + headR, y);
        body.arc(x, y, headR, 0, Math.PI * 2);
        // rim light on the top of heads
        rimPath.moveTo(x - headR * 0.8, y - headR * 0.35);
        rimPath.arc(x, y, headR, Math.PI * 1.15, Math.PI * 1.85);

        // raised arm with glowstick / phone light
        const raised = !booing && m.stickThreshold < energy * 0.95 + (cheering ? 0.3 : 0);
        if (raised) {
          const side = m.phase > Math.PI ? 1 : -1;
          const sway = reduced ? 0.2 : Math.sin(t * (3 + energy * 4) + m.phase) * 0.55;
          const ang = -Math.PI / 2 + side * 0.35 + sway;
          const hx = x + side * shoulder * 0.7;
          const hy = y + headR * 0.6;
          const len = 26 * scale;
          const ex = hx + Math.cos(ang) * len;
          const ey = hy + Math.sin(ang) * len;
          body.moveTo(hx - 2.6 * scale, hy);
          body.lineTo(ex - 2.6 * scale, ey);
          body.lineTo(ex + 2.6 * scale, ey);
          body.lineTo(hx + 2.6 * scale, hy);
          body.closePath();
          if (m.stick < 0) {
            phones ??= new Path2D();
            phones.moveTo(ex + 3 * scale, ey - 2 * scale);
            phones.arc(ex, ey - 2 * scale, 3 * scale, 0, Math.PI * 2);
          } else {
            const p = (glowSticks[m.stick] ??= new Path2D());
            const sl = 14 * scale;
            p.moveTo(ex, ey);
            p.lineTo(ex + Math.cos(ang) * sl, ey + Math.sin(ang) * sl);
          }
        }
      }

      ctx.fillStyle = shade;
      ctx.fill(body);
      ctx.strokeStyle = withAlpha(rim, 0.35 + (1 - row.depth) * 0.35);
      ctx.lineWidth = 1.6 * scale;
      ctx.stroke(rimPath);

      const prev = ctx.globalCompositeOperation;
      ctx.globalCompositeOperation = "lighter";
      ctx.lineCap = "round";
      for (let c = 0; c < glowSticks.length; c++) {
        const p = glowSticks[c];
        if (!p) continue;
        ctx.strokeStyle = withAlpha(stickColors[c], 0.25);
        ctx.lineWidth = 9 * scale;
        ctx.stroke(p);
        ctx.strokeStyle = stickColors[c];
        ctx.lineWidth = 3 * scale;
        ctx.stroke(p);
      }
      if (phones) {
        ctx.fillStyle = "rgba(255,250,220,0.9)";
        ctx.fill(phones);
      }
      ctx.globalCompositeOperation = prev;
    }
  }
}
