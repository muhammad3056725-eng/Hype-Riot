// HYPE RIOT CrowdSystem (Blueprint §3): the 64-character Pixel Crowd.
// Members bounce idly, jump on hits, wave glowsticks, hold score signs,
// gasp on near-misses and throw pixel tomatoes on wrong answers.
import type { Renderer } from "./Renderer";
import { PALETTE } from "./Renderer";

export type CrowdReaction = "jump" | "gasp" | "sign" | "tomato" | "glowstick";

interface Member {
  x: number; y: number; body: string; skin: string;
  phase: number; mode: CrowdReaction | "idle"; modeUntil: number;
  glow: string;
}

const SKIN_TONES = ["#FFD166", "#F4A261", "#C3B2FF", "#FFF8E7", "#E76F51"];
const GLOW_COLORS = ["#00F5D4", "#FF2A85", "#A8FF35", "#FEE440", "#00BBF9", "#F15BB5"];

export class CrowdSystem {
  readonly members: Member[] = [];
  /** 0..1 — drives jump height/frequency. */
  excitement = 0.15;
  private time = 0;

  constructor() {
    for (let i = 0; i < 64; i++) {
      const col = i % 16;
      const row = Math.floor(i / 16);
      this.members.push({
        x: 88 + col * 19 + (row % 2) * 5,
        y: 198 + row * 17,
        body: PALETTE[4 + ((i * 7) % 24)],
        skin: SKIN_TONES[i % SKIN_TONES.length],
        phase: (i * 0.37) % (Math.PI * 2),
        mode: "idle",
        modeUntil: 0,
        glow: GLOW_COLORS[i % GLOW_COLORS.length],
      });
    }
  }

  react(kind: CrowdReaction, fraction = 0.5): void {
    const count = Math.round(this.members.length * fraction);
    const shuffled = [...this.members].sort(() => Math.random() - 0.5);
    for (let i = 0; i < count; i++) {
      shuffled[i].mode = kind;
      shuffled[i].modeUntil = this.time + 0.7 + Math.random() * 0.6;
    }
    if (kind === "jump") this.excitement = Math.min(1, this.excitement + 0.25);
    if (kind === "tomato") this.excitement = Math.max(0.05, this.excitement - 0.2);
  }

  update(dt: number): void {
    this.time += dt;
    this.excitement = Math.max(0.12, this.excitement - dt * 0.05);
    for (const m of this.members) {
      if (m.mode !== "idle" && this.time > m.modeUntil) m.mode = "idle";
    }
  }

  draw(r: Renderer): void {
    for (const m of this.members) {
      const jumping = m.mode === "jump" || (m.mode === "idle" && this.excitement > 0.55);
      const bounce = jumping
        ? Math.abs(Math.sin(this.time * 6 + m.phase)) * (3 + this.excitement * 5)
        : Math.sin(this.time * 2 + m.phase) * 0.8;
      const y = m.y - bounce;
      // body 10x12, head 8x6 (16x24 sprite cell, drawn compact)
      r.rect(m.x + 2, y + 6, 8, 9, m.body);
      r.rect(m.x + 3, y, 6, 6, m.skin);
      r.rect(m.x + 4, y + 2, 1, 1, "#110E1B");
      r.rect(m.x + 7, y + 2, 1, 1, "#110E1B");
      if (m.mode === "gasp") {
        r.rect(m.x + 5, y + 4, 2, 2, "#110E1B");
      }
      if (m.mode === "glowstick" || m.mode === "jump") {
        const wave = Math.sin(this.time * 7 + m.phase) * 2;
        r.rect(m.x + 10, y + 2 + wave, 2, 5, m.glow);
        r.rect(m.x, y + 3 - wave, 2, 5, m.glow);
      }
      if (m.mode === "sign") {
        r.rect(m.x + 1, y - 7, 10, 6, "#FFF8E7");
        r.text("10", m.x + 3, y - 7, "#E63946", 5);
      }
      if (m.mode === "tomato") {
        r.rect(m.x + 11, y + 4, 3, 3, "#E63946");
        r.rect(m.x + 12, y + 3, 1, 1, "#38B000");
      }
    }
  }
}
