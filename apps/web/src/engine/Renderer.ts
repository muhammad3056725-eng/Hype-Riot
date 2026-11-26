// HYPE RIOT renderer (Blueprint §3): strict 480x270 logical canvas,
// integer-multiplier upscale, image-rendering: pixelated, 32-color
// neon palette, screen shake, hit-stop, particles, floating text.
import { NEON_PALETTE } from "@hype-riot/shared-types";

export const LOGICAL_W = 480;
export const LOGICAL_H = 270;
export const PALETTE = NEON_PALETTE;

export interface ArenaTheme {
  name: string;
  skyTop: string;
  skyBottom: string;
  stage: string;
  accent: string;
}

export const ARENA_THEMES: ArenaTheme[] = [
  { name: "Rooftop Skatepark Sunset", skyTop: "#F4A261", skyBottom: "#900C3F", stage: "#3A2F5B", accent: "#FFD166" },
  { name: "Tokyo Midnight Arcade", skyTop: "#03045E", skyBottom: "#1E1735", stage: "#110E1B", accent: "#FF2A85" },
  { name: "Neon Cyber-Gymnasium", skyTop: "#0077B6", skyBottom: "#110E1B", stage: "#1E1735", accent: "#00F5D4" },
  { name: "Retro Comic Book Studio", skyTop: "#FEE440", skyBottom: "#FF9770", stage: "#FFF8E7", accent: "#E63946" },
  { name: "Orbital Space Lounge", skyTop: "#110E1B", skyBottom: "#3A2F5B", stage: "#1E1735", accent: "#9B5DE5" },
  { name: "Boardwalk Carnival Night", skyTop: "#132A13", skyBottom: "#1E1735", stage: "#31572C", accent: "#FFD166" },
];

interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number }
interface FloatText { x: number; y: number; text: string; color: string; life: number }

const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private texts: FloatText[] = [];
  private shakeTime = 0;
  private shakeMag = 0;
  private hitStopUntil = 0;
  reducedMotion = false;
  /** Dither transition: 0 = old theme, 1 = new theme fully wiped in. */
  transition = 1;
  transitionColor = "#110E1B";

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    canvas.width = LOGICAL_W;
    canvas.height = LOGICAL_H;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2d context unavailable");
    this.ctx = ctx;
    ctx.imageSmoothingEnabled = false;
    this.fit();
  }

  /** Integer-multiplier upscale to fit the window (Blueprint §3). */
  fit(): void {
    const maxW = Math.min(window.innerWidth - 16, 960);
    const scale = Math.max(1, Math.min(4, Math.floor(maxW / LOGICAL_W)));
    this.canvas.style.width = `${LOGICAL_W * scale}px`;
    this.canvas.style.height = `${LOGICAL_H * scale}px`;
    this.canvas.style.imageRendering = "pixelated";
  }

  rect(x: number, y: number, w: number, h: number, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  gradient(top: string, bottom: string): void {
    const g = this.ctx.createLinearGradient(0, 0, 0, LOGICAL_H);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    this.ctx.fillStyle = g;
    this.ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  }

  text(str: string, x: number, y: number, color: string, size = 8, align: CanvasTextAlign = "left"): void {
    this.ctx.fillStyle = color;
    this.ctx.font = `${size}px "Press Start 2P", monospace`;
    this.ctx.textAlign = align;
    this.ctx.textBaseline = "top";
    this.ctx.fillText(str, Math.round(x), Math.round(y));
  }

  /** Blits a char-map sprite; `colors` maps chars to palette colors. */
  sprite(rows: string[], x: number, y: number, colors: Record<string, string>, scale = 1): void {
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      for (let c = 0; c < row.length; c++) {
        const color = colors[row[c]];
        if (color) this.rect(x + c * scale, y + r * scale, scale, scale, color);
      }
    }
  }

  burst(x: number, y: number, color: string, n = 14): void {
    if (this.reducedMotion) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 30 + Math.random() * 90;
      this.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40,
        life: 0.5 + Math.random() * 0.4, color, size: 2,
      });
    }
  }

  floatText(x: number, y: number, text: string, color: string): void {
    this.texts.push({ x, y, text, color, life: 1.1 });
  }

  shake(mag = 4, time = 0.18): void {
    if (this.reducedMotion) return;
    this.shakeMag = mag;
    this.shakeTime = time;
  }

  hitStop(ms = 30): void {
    if (this.reducedMotion) return;
    this.hitStopUntil = performance.now() + ms;
  }

  get frozen(): boolean {
    return performance.now() < this.hitStopUntil;
  }

  /** Call once per frame after the scene is drawn. */
  postFrame(dt: number): void {
    const ctx = this.ctx;
    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      const dx = (Math.random() - 0.5) * 2 * this.shakeMag;
      const dy = (Math.random() - 0.5) * 2 * this.shakeMag;
      const img = ctx.getImageData(0, 0, LOGICAL_W, LOGICAL_H);
      ctx.clearRect(0, 0, LOGICAL_W, LOGICAL_H);
      ctx.putImageData(img, Math.round(dx), Math.round(dy));
    }
    this.particles = this.particles.filter((p) => (p.life -= dt) > 0);
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 220 * dt;
      this.rect(p.x, p.y, p.size, p.size, p.color);
    }
    this.texts = this.texts.filter((t) => (t.life -= dt) > 0);
    for (const t of this.texts) {
      t.y -= 18 * dt;
      this.text(t.text, t.x, t.y, t.color, 8, "center");
    }
    if (this.transition < 1) {
      // GLSL-equivalent Bayer 4x4 dither wipe (canvas fallback path;
      // Shaders.ts carries the WebGL2 version of the same math).
      this.transition = Math.min(1, this.transition + dt * 1.6);
      const threshold = this.transition;
      ctx.fillStyle = this.transitionColor;
      for (let y = 0; y < LOGICAL_H; y += 4) {
        for (let x = 0; x < LOGICAL_W; x += 4) {
          if (BAYER4[(y / 4) % 4][(x / 4) % 4] / 16 < threshold) {
            ctx.fillRect(x, y, 4, 4);
          }
        }
      }
    }
  }

  startTransition(color: string): void {
    this.transitionColor = color;
    this.transition = 0;
  }
}
