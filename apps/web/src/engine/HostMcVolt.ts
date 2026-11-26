// HYPE RIOT MC VOLT (Blueprint §3): the arcade-monitor-headed host,
// 48x48, 12 animation states. Drawn from code (no external assets).
import type { Renderer } from "./Renderer";

export type VoltState =
  | "IDLE_TALK" | "HYPER_MIC_DROP" | "MIND_BLOWN" | "SIDE_EYE"
  | "LAUGHING_FIT" | "PANIC_COUNTDOWN" | "FIRE_SUNGLASSES"
  | "CONFETTI_DANCE" | "WRONG_BUZZER" | "SHOCK_WAVE" | "SLEEPING"
  | "VICTORY_SPIN";

export const VOLT_STATES: VoltState[] = [
  "IDLE_TALK", "HYPER_MIC_DROP", "MIND_BLOWN", "SIDE_EYE",
  "LAUGHING_FIT", "PANIC_COUNTDOWN", "FIRE_SUNGLASSES",
  "CONFETTI_DANCE", "WRONG_BUZZER", "SHOCK_WAVE", "SLEEPING",
  "VICTORY_SPIN",
];

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
    // transient states fall back to idle talk
    const transient: VoltState[] = [
      "HYPER_MIC_DROP", "MIND_BLOWN", "WRONG_BUZZER", "SHOCK_WAVE", "VICTORY_SPIN",
    ];
    if (transient.includes(this.state) && this.stateTime > 1.2) {
      this.setState("IDLE_TALK");
    }
  }

  draw(r: Renderer, x: number, y: number): void {
    const t = this.time;
    const bob = this.state === "CONFETTI_DANCE"
      ? Math.sin(t * 8) * 3
      : Math.sin(t * 2) * 1;
    const tilt = this.state === "CONFETTI_DANCE" ? Math.sin(t * 8) * 2 : 0;
    const ox = x + tilt;
    const oy = y + bob;
    // antenna + blinking light
    r.rect(ox + 23, oy - 8, 2, 8, "#8F79D2");
    r.rect(ox + 21, oy - 11, 6, 4, Math.sin(t * 4) > 0 ? "#FF2A85" : "#FEE440");
    // monitor body
    r.rect(ox, oy, 48, 40, "#3A2F5B");
    r.rect(ox + 2, oy + 2, 44, 36, "#110E1B");
    // screen
    r.rect(ox + 6, oy + 6, 36, 28, "#00F5D4");
    r.rect(ox + 6, oy + 6, 36, 10, "#00BBF9");
    // neck + body
    r.rect(ox + 20, oy + 40, 8, 3, "#8F79D2");
    r.rect(ox + 12, oy + 43, 24, 5, "#FF2A85");
    // face per state (screen coords: sx=ox+6, sy=oy+6, 36x28)
    const sx = ox + 6;
    const sy = oy + 6;
    const eye = (ex: number, ey: number, w = 4, h = 6) => r.rect(sx + ex, sy + ey, w, h, "#110E1B");
    switch (this.state) {
      case "IDLE_TALK":
        eye(8, 8); eye(24, 8);
        r.rect(sx + 14, sy + 20, 8, Math.sin(t * 6) > 0 ? 4 : 1, "#110E1B");
        break;
      case "HYPER_MIC_DROP": {
        eye(8, 8); eye(24, 8);
        r.rect(sx + 13, sy + 19, 10, 5, "#110E1B");
        const drop = Math.min(10, this.stateTime * 30);
        r.rect(ox + 40, oy + 20 + drop, 3, 6, "#FFF8E7");
        break;
      }
      case "MIND_BLOWN":
        r.text("*", sx + 7, sy + 6, "#110E1B", 8);
        r.text("*", sx + 23, sy + 6, "#110E1B", 8);
        r.rect(sx + 14, sy + 20, 8, 4, "#110E1B");
        r.rect(sx + 2, sy + 2, 3, 3, "#FEE440");
        r.rect(sx + 31, sy + 3, 3, 3, "#FF2A85");
        break;
      case "SIDE_EYE":
        eye(12, 8); eye(28, 8);
        r.rect(sx + 14, sy + 21, 8, 2, "#110E1B");
        break;
      case "LAUGHING_FIT":
        r.rect(sx + 7, sy + 9, 6, 2, "#110E1B");
        r.rect(sx + 23, sy + 9, 6, 2, "#110E1B");
        r.rect(sx + 11, sy + 18, 14, 6, "#110E1B");
        r.rect(sx + 13, sy + 22, 10, 2, "#FF70A6");
        break;
      case "PANIC_COUNTDOWN":
        eye(8, 7, 5, 8); eye(23, 7, 5, 8);
        r.rect(sx + 15, sy + 19, 6, 6, "#110E1B");
        break;
      case "FIRE_SUNGLASSES":
        r.rect(sx + 5, sy + 8, 26, 7, "#110E1B");
        r.rect(sx + 12, sy + 20, 12, 3, "#110E1B");
        r.rect(sx + 28, sy + 1, 4, 6, "#E76F51");
        r.rect(sx + 29, sy - 1, 2, 3, "#FEE440");
        break;
      case "CONFETTI_DANCE":
        eye(8, 8); eye(24, 8);
        r.rect(sx + 13, sy + 19, 10, 4, "#110E1B");
        break;
      case "WRONG_BUZZER":
        r.text("X", sx + 7, sy + 6, "#110E1B", 8);
        r.text("X", sx + 23, sy + 6, "#110E1B", 8);
        r.rect(sx + 13, sy + 21, 10, 2, "#110E1B");
        break;
      case "SHOCK_WAVE":
        eye(8, 8); eye(24, 8);
        r.rect(sx + 15, sy + 19, 6, 5, "#110E1B");
        r.rect(ox - 4, oy + 14, 3, 12, "#00BBF9");
        r.rect(ox + 49, oy + 14, 3, 12, "#00BBF9");
        break;
      case "SLEEPING":
        r.rect(sx + 7, sy + 10, 6, 2, "#110E1B");
        r.rect(sx + 23, sy + 10, 6, 2, "#110E1B");
        r.rect(sx + 15, sy + 20, 5, 2, "#110E1B");
        r.text("Z", ox + 40, oy - 14 - Math.sin(t * 2) * 2, "#C3B2FF", 8);
        break;
      case "VICTORY_SPIN":
        r.text("*", sx + 7, sy + 6, "#FEE440", 8);
        r.text("*", sx + 23, sy + 6, "#FEE440", 8);
        r.rect(sx + 12, sy + 19, 12, 4, "#110E1B");
        break;
    }
    // microphone in hand (most states)
    if (this.state !== "HYPER_MIC_DROP" && this.state !== "SLEEPING") {
      r.rect(ox + 42, oy + 26, 3, 10, "#FFF8E7");
      r.rect(ox + 41, oy + 22, 5, 5, "#FFD166");
    }
  }
}
