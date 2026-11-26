// HYPE RIOT particles: pooled struct-of-arrays (no per-particle objects),
// confetti drawn as rotated quads batched per color, sparks as additive
// glow sprites, tomatoes as small arcs.
import { glowSprite } from "./Shaders";

export const CONFETTI_COLORS = ["#ff2d95", "#ffe066", "#29f0ff", "#9b5cff", "#7dff6b", "#ff8a3d"];
const KIND_CONFETTI = 0;
const KIND_SPARK = 1;
const KIND_TOMATO = 2;

export class Particles {
  private max: number;
  private n = 0;
  private x: Float32Array;
  private y: Float32Array;
  private vx: Float32Array;
  private vy: Float32Array;
  private life: Float32Array;
  private ttl: Float32Array;
  private size: Float32Array;
  private rot: Float32Array;
  private vr: Float32Array;
  private color: Uint8Array;
  private kind: Uint8Array;

  constructor(max = 900) {
    this.max = max;
    this.x = new Float32Array(max);
    this.y = new Float32Array(max);
    this.vx = new Float32Array(max);
    this.vy = new Float32Array(max);
    this.life = new Float32Array(max);
    this.ttl = new Float32Array(max);
    this.size = new Float32Array(max);
    this.rot = new Float32Array(max);
    this.vr = new Float32Array(max);
    this.color = new Uint8Array(max);
    this.kind = new Uint8Array(max);
  }

  setBudget(max: number): void {
    this.max = Math.min(max, this.x.length);
    if (this.n > this.max) this.n = this.max;
  }

  get count(): number {
    return this.n;
  }

  private spawn(kind: number, x: number, y: number, vx: number, vy: number, ttl: number, size: number, color: number): void {
    if (this.n >= this.max) return;
    const i = this.n++;
    this.kind[i] = kind;
    this.x[i] = x;
    this.y[i] = y;
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.life[i] = ttl;
    this.ttl[i] = ttl;
    this.size[i] = size;
    this.rot[i] = Math.random() * Math.PI * 2;
    this.vr[i] = (Math.random() - 0.5) * 14;
    this.color[i] = color;
  }

  /** Confetti cannon from (x,y) spraying upward. */
  confetti(x: number, y: number, count: number, spread = 1): void {
    for (let i = 0; i < count; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6 * spread;
      const sp = 380 + Math.random() * 520;
      this.spawn(KIND_CONFETTI, x, y, Math.cos(a) * sp, Math.sin(a) * sp, 2.2 + Math.random() * 1.6,
        5 + Math.random() * 6, (Math.random() * CONFETTI_COLORS.length) | 0);
    }
  }

  /** Radial spark burst. */
  sparks(x: number, y: number, count: number, colorIndex: number): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 120 + Math.random() * 360;
      this.spawn(KIND_SPARK, x, y, Math.cos(a) * sp, Math.sin(a) * sp, 0.45 + Math.random() * 0.5,
        10 + Math.random() * 16, colorIndex);
    }
  }

  /** Tomatoes lobbed from the crowd toward the stage. */
  tomatoes(fromX: number, fromY: number, toX: number, toY: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const t = 0.9 + Math.random() * 0.3;
      const sx = fromX + (Math.random() - 0.5) * 300;
      const tx = toX + (Math.random() - 0.5) * 160;
      const vx = (tx - sx) / t;
      const vy = (toY - fromY - 0.5 * 900 * t * t) / t;
      this.spawn(KIND_TOMATO, sx, fromY, vx, vy, t, 7 + Math.random() * 4, 0);
    }
  }

  update(dt: number): void {
    let i = 0;
    while (i < this.n) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        const last = --this.n;
        if (i !== last) {
          this.kind[i] = this.kind[last]; this.x[i] = this.x[last]; this.y[i] = this.y[last];
          this.vx[i] = this.vx[last]; this.vy[i] = this.vy[last]; this.life[i] = this.life[last];
          this.ttl[i] = this.ttl[last]; this.size[i] = this.size[last]; this.rot[i] = this.rot[last];
          this.vr[i] = this.vr[last]; this.color[i] = this.color[last];
        }
        continue;
      }
      const k = this.kind[i];
      if (k === KIND_CONFETTI) {
        this.vx[i] *= 1 - 1.6 * dt;
        this.vy[i] = this.vy[i] * (1 - 1.6 * dt) + 520 * dt;
        this.x[i] += this.vx[i] * dt + Math.sin(this.rot[i] * 1.7) * 30 * dt;
      } else if (k === KIND_SPARK) {
        this.vx[i] *= 1 - 3 * dt;
        this.vy[i] = this.vy[i] * (1 - 3 * dt) + 140 * dt;
        this.x[i] += this.vx[i] * dt;
      } else {
        this.vy[i] += 900 * dt;
        this.x[i] += this.vx[i] * dt;
      }
      this.y[i] += this.vy[i] * dt;
      this.rot[i] += this.vr[i] * dt;
      i++;
    }
  }

  draw(ctx: CanvasRenderingContext2D, sparkColors: string[]): void {
    if (this.n === 0) return;
    // confetti: one path per color
    for (let c = 0; c < CONFETTI_COLORS.length; c++) {
      ctx.beginPath();
      let any = false;
      for (let i = 0; i < this.n; i++) {
        if (this.kind[i] !== KIND_CONFETTI || this.color[i] !== c) continue;
        any = true;
        const s = this.size[i];
        const flip = Math.abs(Math.cos(this.rot[i] * 0.7)); // 3D flutter
        const hw = s * 0.5;
        const hh = s * 0.32 * (0.25 + flip);
        const cs = Math.cos(this.rot[i]);
        const sn = Math.sin(this.rot[i]);
        const px = this.x[i];
        const py = this.y[i];
        ctx.moveTo(px + cs * hw - sn * hh, py + sn * hw + cs * hh);
        ctx.lineTo(px - cs * hw - sn * hh, py - sn * hw + cs * hh);
        ctx.lineTo(px - cs * hw + sn * hh, py - sn * hw - cs * hh);
        ctx.lineTo(px + cs * hw + sn * hh, py + sn * hw - cs * hh);
        ctx.closePath();
      }
      if (any) {
        ctx.fillStyle = CONFETTI_COLORS[c];
        ctx.fill();
      }
    }
    // tomatoes
    ctx.beginPath();
    let tom = false;
    for (let i = 0; i < this.n; i++) {
      if (this.kind[i] !== KIND_TOMATO) continue;
      tom = true;
      ctx.moveTo(this.x[i] + this.size[i], this.y[i]);
      ctx.arc(this.x[i], this.y[i], this.size[i], 0, Math.PI * 2);
    }
    if (tom) {
      ctx.fillStyle = "#e8323c";
      ctx.fill();
    }
    // sparks: additive glow sprites
    const prev = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < this.n; i++) {
      if (this.kind[i] !== KIND_SPARK) continue;
      const a = this.life[i] / this.ttl[i];
      const s = this.size[i] * (0.6 + a * 0.6);
      ctx.globalAlpha = a;
      ctx.drawImage(glowSprite(sparkColors[this.color[i] % sparkColors.length], 64, 0.12), this.x[i] - s / 2, this.y[i] - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = prev;
  }
}
