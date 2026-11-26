// HYPE RIOT arena renderer: a full-screen, hi-DPI Canvas2D concert stage
// behind the DOM HUD. Layers: themed sky + arena bowl (cached), LED
// jumbotron with glow and equalizer, sweeping volumetric spotlights
// (additive gradients), glossy perspective stage with light pools, host
// MC VOLT, the player's podium avatar, the perspective crowd, particles,
// flashes and a vignette. Adaptive quality lowers resolution and detail
// when frames run slow; reduced motion freezes sweeps, shake and flashes.
import { AvatarBuilder } from "./AvatarBuilder";
import { CrowdSystem, type CrowdReaction } from "./CrowdSystem";
import { HostMcVolt } from "./HostMcVolt";
import { CONFETTI_COLORS, Particles } from "./Particles";
import { clearSizedCaches, glowSprite, ledPanel, mix, vignette, withAlpha } from "./Shaders";
import type { Equipped, QualitySetting } from "../db/LocalSaveDB";

export interface ArenaTheme {
  name: string;
  skyTop: string;
  skyBottom: string;
  floor: string;
  accent: string;
  accent2: string;
  beams: string[];
}

export const ARENA_THEMES: ArenaTheme[] = [
  { name: "Neon Rooftop", skyTop: "#14072e", skyBottom: "#4a0f4f", floor: "#1a1035", accent: "#ff2d95", accent2: "#ffb347", beams: ["#ff2d95", "#ffb347", "#9b5cff"] },
  { name: "Tokyo Midnight", skyTop: "#050b2b", skyBottom: "#16164a", floor: "#0d0f2e", accent: "#29f0ff", accent2: "#ff2d95", beams: ["#29f0ff", "#ff2d95", "#7b6cff"] },
  { name: "Cyber Gym", skyTop: "#021a24", skyBottom: "#073b46", floor: "#04202a", accent: "#2dffc4", accent2: "#29f0ff", beams: ["#2dffc4", "#29f0ff", "#ffe066"] },
  { name: "Comic Studio", skyTop: "#2a0a12", skyBottom: "#5c1a1a", floor: "#2b0f17", accent: "#ffe066", accent2: "#ff5a3d", beams: ["#ffe066", "#ff5a3d", "#ff9bd2"] },
  { name: "Orbital Lounge", skyTop: "#03020c", skyBottom: "#1a1240", floor: "#0b0920", accent: "#9b5cff", accent2: "#29f0ff", beams: ["#9b5cff", "#29f0ff", "#ff2d95"] },
  { name: "Carnival Night", skyTop: "#0b1a0f", skyBottom: "#2b1546", floor: "#141030", accent: "#7dff6b", accent2: "#ffe066", beams: ["#7dff6b", "#ffe066", "#ff2d95"] },
];

export interface ArenaFrame {
  energy: number; // 0..1 hype
  jumboTitle: string;
  jumboSub: string;
  equipped: Equipped;
  celebrate: number; // seconds of avatar celebration left
}

interface Beam {
  x: number; // 0..1 origin across the truss
  phase: number;
  speed: number;
  color: number;
}

const QUALITY_SCALE = [0.6, 0.85, 1];
const CROWD_ROWS = [3, 4, 5];
const PARTICLE_BUDGET = [260, 520, 900];

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  readonly crowd = new CrowdSystem();
  readonly volt = new HostMcVolt();
  readonly particles = new Particles();
  private avatar = new AvatarBuilder();
  private beams: Beam[] = [];
  private bg: HTMLCanvasElement | null = null;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private time = 0;
  private shakeMag = 0;
  private shakeTime = 0;
  private flashColor = "#ffffff";
  private flashAlpha = 0;
  private transition = 1;
  private transitionColor = "#000000";
  theme: ArenaTheme = ARENA_THEMES[0];
  /** Where the HUD leaves room for the jumbotron (css px); null hides it. */
  jumboBox: { top: number; maxH: number } | null = null;
  reducedMotion = false;
  /** 0 low, 1 medium, 2 high. */
  quality = 2;
  qualitySetting: QualitySetting = "auto";
  private slowFor = 0;
  private fastFor = 0;
  private frameAvg = 16;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("2d context unavailable");
    this.ctx = ctx;
    for (let i = 0; i < 6; i++) {
      this.beams.push({ x: 0.1 + (i / 5) * 0.8, phase: i * 1.7, speed: 0.35 + (i % 3) * 0.12, color: i % 3 });
    }
    this.resize();
  }

  setTheme(index: number): void {
    this.theme = ARENA_THEMES[((index % ARENA_THEMES.length) + ARENA_THEMES.length) % ARENA_THEMES.length];
    this.bg = null;
  }

  setQualitySetting(q: QualitySetting): void {
    this.qualitySetting = q;
    const target = q === "low" ? 0 : 2;
    if (this.quality !== target) {
      this.quality = target;
      this.resize();
    }
  }

  /** Call on window resize / orientation change. */
  resize(): void {
    const cssW = Math.max(1, window.innerWidth);
    const cssH = Math.max(1, window.innerHeight);
    const dpr = Math.min(2, window.devicePixelRatio || 1) * QUALITY_SCALE[this.quality];
    this.w = cssW;
    this.h = cssH;
    this.dpr = Math.max(0.5, dpr);
    this.canvas.width = Math.round(cssW * this.dpr);
    this.canvas.height = Math.round(cssH * this.dpr);
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    clearSizedCaches();
    this.bg = null;
    this.crowd.layout(cssW, CROWD_ROWS[this.quality]);
    this.particles.setBudget(PARTICLE_BUDGET[this.quality]);
  }

  // ----- effects -----

  shake(mag = 8, time = 0.25): void {
    if (this.reducedMotion) return;
    this.shakeMag = Math.max(this.shakeMag, mag);
    this.shakeTime = Math.max(this.shakeTime, time);
  }

  flash(color: string, alpha = 0.35): void {
    if (this.reducedMotion) return;
    this.flashColor = color;
    this.flashAlpha = Math.max(this.flashAlpha, alpha);
  }

  /** Fade from a solid color into the scene (theme/round changes). */
  fadeIn(color = "#000000"): void {
    this.transitionColor = color;
    this.transition = this.reducedMotion ? 1 : 0;
  }

  confetti(amount = 1): void {
    const n = Math.round((this.reducedMotion ? 30 : 120) * amount);
    this.particles.confetti(this.w * 0.15, this.h * 0.92, n / 2, 0.8);
    this.particles.confetti(this.w * 0.85, this.h * 0.92, n / 2, 0.8);
  }

  sparks(xFrac: number, yFrac: number, count = 26, colorIndex = 0): void {
    this.particles.sparks(this.w * xFrac, this.h * yFrac, this.reducedMotion ? Math.ceil(count / 3) : count, colorIndex);
  }

  tomatoes(count = 6): void {
    if (this.reducedMotion) return;
    this.particles.tomatoes(this.w * 0.5, this.h, this.w * 0.2, this.h * 0.6, count);
  }

  crowdReact(kind: CrowdReaction): void {
    this.crowd.react(kind);
  }

  // ----- frame -----

  /** Adaptive quality: feed real frame times (ms). */
  private adapt(frameMs: number, dt: number): void {
    this.frameAvg = this.frameAvg * 0.92 + frameMs * 0.08;
    if (this.qualitySetting !== "auto") return;
    if (this.frameAvg > 24) {
      this.slowFor += dt;
      this.fastFor = 0;
      if (this.slowFor > 2 && this.quality > 0) {
        this.quality--;
        this.slowFor = 0;
        this.resize();
      }
    } else if (this.frameAvg < 15) {
      this.fastFor += dt;
      this.slowFor = 0;
      if (this.fastFor > 8 && this.quality < 2) {
        this.quality++;
        this.fastFor = 0;
        this.resize();
      }
    } else {
      this.slowFor = 0;
      this.fastFor = 0;
    }
  }

  frame(dt: number, frameMs: number, f: ArenaFrame): void {
    this.adapt(frameMs, dt);
    this.time += dt;
    const ctx = this.ctx;
    const { w, h } = this;
    const th = this.theme;
    const reduced = this.reducedMotion;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    if (!this.bg) this.bg = this.buildBackground();
    ctx.drawImage(this.bg, 0, 0, w, h);

    let sx = 0;
    let sy = 0;
    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      const k = Math.max(0, this.shakeTime) * 4;
      sx = (Math.random() - 0.5) * this.shakeMag * Math.min(1, k);
      sy = (Math.random() - 0.5) * this.shakeMag * Math.min(1, k);
      if (this.shakeTime <= 0) this.shakeMag = 0;
    }
    ctx.save();
    ctx.translate(sx, sy);

    const horizon = h * 0.6;
    this.drawBeams(ctx, horizon, f.energy, reduced);
    if (this.jumboBox && this.jumboBox.maxH >= 48) this.drawJumbotron(ctx, f, reduced, this.jumboBox);

    // host + avatar on stage
    const charSize = Math.min(h * 0.26, w * 0.32, 260);
    const floorY = horizon + (h - horizon) * 0.22;
    this.volt.update(dt);
    this.volt.draw(ctx, Math.max(charSize * 0.42, w * 0.16), floorY, charSize, th.accent, reduced);
    this.avatar.draw(ctx, Math.min(w - charSize * 0.42, w * 0.84), floorY, charSize * 0.8, f.equipped, this.time, f.celebrate, reduced);

    // crowd in front
    this.crowd.update(dt);
    this.crowd.draw(ctx, w, h * 0.7, h, f.energy, th.accent, reduced);

    this.particles.update(dt);
    this.particles.draw(ctx, CONFETTI_COLORS);
    ctx.restore();

    ctx.drawImage(vignette(Math.round(w), Math.round(h)), 0, 0, w, h);
    if (this.flashAlpha > 0.01) {
      ctx.fillStyle = withAlpha(this.flashColor, this.flashAlpha);
      ctx.fillRect(0, 0, w, h);
      this.flashAlpha *= Math.pow(0.02, dt);
    }
    if (this.transition < 1) {
      this.transition = Math.min(1, this.transition + dt * 2.2);
      ctx.fillStyle = withAlpha(this.transitionColor, 1 - this.transition);
      ctx.fillRect(0, 0, w, h);
    }
  }

  private buildBackground(): HTMLCanvasElement {
    const { w, h } = this;
    const th = this.theme;
    const c = document.createElement("canvas");
    c.width = Math.round(w * this.dpr);
    c.height = Math.round(h * this.dpr);
    const g = c.getContext("2d")!;
    g.scale(this.dpr, this.dpr);
    const horizon = h * 0.6;
    const sky = g.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, th.skyTop);
    sky.addColorStop(1, th.skyBottom);
    g.fillStyle = sky;
    g.fillRect(0, 0, w, horizon);
    // stars / city specks
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < Math.round((w * horizon) / 5000); i++) {
      g.fillStyle = `rgba(255,255,255,${0.15 + rnd() * 0.5})`;
      const r = rnd() * 1.3 + 0.3;
      g.beginPath();
      g.arc(rnd() * w, rnd() * horizon * 0.7, r, 0, Math.PI * 2);
      g.fill();
    }
    // arena bowl: tiers of seats with tiny lights
    for (let tier = 0; tier < 4; tier++) {
      const y = horizon * (0.52 + tier * 0.12);
      g.fillStyle = mix(th.skyBottom, "#000000", 0.35 + tier * 0.12);
      g.beginPath();
      g.moveTo(0, y + 30);
      g.quadraticCurveTo(w / 2, y - 40, w, y + 30);
      g.lineTo(w, horizon);
      g.lineTo(0, horizon);
      g.closePath();
      g.fill();
      for (let i = 0; i < 60; i++) {
        const x = rnd() * w;
        const yy = y + 8 + Math.pow((x - w / 2) / (w / 2), 2) * 30 + rnd() * 12;
        g.fillStyle = withAlpha([th.accent, th.accent2, "#ffffff"][i % 3], 0.25 + rnd() * 0.4);
        g.fillRect(x, yy, 1.6, 1.6);
      }
    }
    // truss bar
    g.fillStyle = "#08061a";
    g.fillRect(0, 0, w, Math.max(10, h * 0.025));
    g.strokeStyle = withAlpha(th.accent, 0.5);
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(0, Math.max(10, h * 0.025));
    g.lineTo(w, Math.max(10, h * 0.025));
    g.stroke();
    // glossy stage floor with perspective lines
    const floor = g.createLinearGradient(0, horizon, 0, h);
    floor.addColorStop(0, mix(th.floor, "#ffffff", 0.08));
    floor.addColorStop(0.3, th.floor);
    floor.addColorStop(1, "#020108");
    g.fillStyle = floor;
    g.fillRect(0, horizon, w, h - horizon);
    g.strokeStyle = withAlpha(th.accent, 0.12);
    for (let i = -10; i <= 10; i++) {
      g.beginPath();
      g.moveTo(w / 2 + i * w * 0.04, horizon);
      g.lineTo(w / 2 + i * w * 0.2, h);
      g.stroke();
    }
    for (let i = 1; i < 6; i++) {
      const y = horizon + (h - horizon) * Math.pow(i / 6, 1.8);
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y);
      g.stroke();
    }
    // stage lip glow line
    const lip = g.createLinearGradient(0, 0, w, 0);
    lip.addColorStop(0, withAlpha(th.accent, 0));
    lip.addColorStop(0.5, withAlpha(th.accent, 0.9));
    lip.addColorStop(1, withAlpha(th.accent, 0));
    g.fillStyle = lip;
    g.fillRect(0, horizon - 1, w, 3);
    return c;
  }

  private drawBeams(ctx: CanvasRenderingContext2D, horizon: number, energy: number, reduced: boolean): void {
    const { w, h } = this;
    const th = this.theme;
    const t = this.time;
    const count = this.quality === 0 ? 3 : this.beams.length;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const top = Math.max(10, h * 0.025);
    for (let i = 0; i < count; i++) {
      const b = this.beams[this.quality === 0 ? i * 2 : i];
      const ox = b.x * w;
      const swing = reduced ? Math.sin(b.phase) * 0.25 : Math.sin(t * b.speed * (1 + energy * 1.8) + b.phase) * (0.35 + energy * 0.25);
      const len = h * 0.95;
      const angle = Math.PI / 2 + swing;
      const ex = ox + Math.cos(angle) * len;
      const ey = top + Math.sin(angle) * len;
      const spread = w * 0.055 + energy * w * 0.02;
      const color = th.beams[b.color % th.beams.length];
      const grad = ctx.createLinearGradient(ox, top, ex, ey);
      grad.addColorStop(0, withAlpha(color, 0.38 + energy * 0.2));
      grad.addColorStop(0.6, withAlpha(color, 0.08 + energy * 0.06));
      grad.addColorStop(1, withAlpha(color, 0));
      ctx.fillStyle = grad;
      const nx = -Math.sin(angle);
      const ny = Math.cos(angle);
      ctx.beginPath();
      ctx.moveTo(ox - nx * 4, top - ny * 4);
      ctx.lineTo(ox + nx * 4, top + ny * 4);
      ctx.lineTo(ex + nx * spread, ey + ny * spread);
      ctx.lineTo(ex - nx * spread, ey - ny * spread);
      ctx.closePath();
      ctx.fill();
      // light pool where the beam meets the floor
      if (ey > horizon) {
        const k = (horizon + (h - horizon) * 0.3 - top) / (ey - top);
        const px = ox + (ex - ox) * Math.min(1, Math.max(0, k));
        const py = horizon + (h - horizon) * 0.3;
        ctx.globalAlpha = 0.35 + energy * 0.3;
        ctx.drawImage(glowSprite(color, 128, 0.05), px - spread * 1.6, py - spread * 0.4, spread * 3.2, spread * 0.8);
        ctx.globalAlpha = 1;
      }
      // lamp head
      ctx.drawImage(glowSprite(color, 64), ox - 14, top - 10, 28, 28);
    }
    ctx.restore();
  }

  private drawJumbotron(ctx: CanvasRenderingContext2D, f: ArenaFrame, reduced: boolean, box: { top: number; maxH: number }): void {
    const { w, h } = this;
    const th = this.theme;
    const jh = Math.min(h * 0.16, box.maxH - 12, 170);
    const jw = Math.min(w * 0.7, 620, jh * 3.6);
    const jx = (w - jw) / 2;
    const jy = box.top + 6;
    // glow behind
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.45 + f.energy * 0.35;
    ctx.drawImage(glowSprite(th.accent, 128, 0.05), jx - jw * 0.15, jy - jh * 0.6, jw * 1.3, jh * 2.2);
    ctx.restore();
    // frame + LED glass
    ctx.fillStyle = "#06040f";
    ctx.fillRect(jx - 6, jy - 6, jw + 12, jh + 12);
    const pitch = Math.max(3, Math.round(jh / 26));
    ctx.drawImage(ledPanel(Math.round(jw), Math.round(jh), pitch, th.accent), jx, jy, jw, jh);
    ctx.strokeStyle = withAlpha(th.accent, 0.9);
    ctx.lineWidth = 2;
    ctx.strokeRect(jx - 3, jy - 3, jw + 6, jh + 6);
    // equalizer bars along the bottom
    const bars = 24;
    const bw = jw / bars;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < bars; i++) {
      const v = reduced
        ? 0.25 + 0.1 * Math.sin(i)
        : 0.15 + (0.25 + f.energy * 0.6) * Math.abs(Math.sin(this.time * (3 + (i % 5)) + i * 1.3));
      const bh = jh * 0.32 * v;
      ctx.fillStyle = withAlpha(i % 2 ? th.accent : th.accent2, 0.55);
      ctx.fillRect(jx + i * bw + 1, jy + jh - bh - 2, bw - 2, bh);
    }
    ctx.restore();
    // text
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const titleSize = Math.round(jh * 0.3);
    ctx.font = `800 ${titleSize}px system-ui, "Segoe UI", Roboto, sans-serif`;
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = th.accent;
    ctx.shadowBlur = this.quality > 0 ? 14 : 0;
    ctx.fillText(f.jumboTitle, w / 2, jy + jh * 0.36, jw * 0.92);
    ctx.shadowBlur = 0;
    ctx.font = `600 ${Math.round(jh * 0.17)}px system-ui, "Segoe UI", Roboto, sans-serif`;
    ctx.fillStyle = withAlpha(th.accent2, 0.95);
    ctx.fillText(f.jumboSub, w / 2, jy + jh * 0.64, jw * 0.9);
  }
}
