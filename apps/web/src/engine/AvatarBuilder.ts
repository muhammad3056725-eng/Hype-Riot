// HYPE RIOT player avatar: a vector contestant standing at the podium,
// dressed in cosmetics bought with Hype Coins (100% cosmetic, zero
// pay-to-win). Unlocks are stored as "slot:id".
import type { Equipped } from "../db/LocalSaveDB";
import { glowSprite } from "./Shaders";

export type CosmeticSlot = keyof Equipped;

export interface Cosmetic {
  id: string;
  slot: CosmeticSlot;
  name: string;
  cost: number; // Hype Coins; 0 = owned by default
  color?: string;
}

export const COSMETICS: Cosmetic[] = [
  { id: "default", slot: "hoodie", name: "Starter Hoodie", cost: 0, color: "#5b4bd6" },
  { id: "neon-pink", slot: "hoodie", name: "Neon Pink Hoodie", cost: 25, color: "#ff2d95" },
  { id: "volt-teal", slot: "hoodie", name: "Volt Teal Hoodie", cost: 25, color: "#14c9e6" },
  { id: "lime", slot: "hoodie", name: "Acid Lime Hoodie", cost: 40, color: "#7ed321" },
  { id: "gold", slot: "hoodie", name: "Champion Gold Hoodie", cost: 90, color: "#ffc93c" },
  { id: "none", slot: "visor", name: "No Visor", cost: 0 },
  { id: "cyber", slot: "visor", name: "Cyber Visor", cost: 30, color: "#29f0ff" },
  { id: "shades", slot: "visor", name: "Fire Shades", cost: 45, color: "#ff6b3d" },
  { id: "default", slot: "sneakers", name: "Canvas Sneakers", cost: 0, color: "#f4f1ff" },
  { id: "neon", slot: "sneakers", name: "Neon Sneakers", cost: 35, color: "#7dff6b" },
  { id: "rocket", slot: "sneakers", name: "Rocket Sneakers", cost: 70, color: "#ff2d95" },
  { id: "none", slot: "pet", name: "No Pet", cost: 0 },
  { id: "cat", slot: "pet", name: "Holo Cat", cost: 50, color: "#ffb347" },
  { id: "bot", slot: "pet", name: "Mini Bot", cost: 65, color: "#9b8cff" },
  { id: "none", slot: "dance", name: "No Dance", cost: 0 },
  { id: "bounce", slot: "dance", name: "Victory Bounce", cost: 20 },
  { id: "spin", slot: "dance", name: "Victory Spin", cost: 40 },
];

export function cosmeticFor(slot: CosmeticSlot, id: string): Cosmetic {
  return COSMETICS.find((c) => c.slot === slot && c.id === id) ?? COSMETICS.find((c) => c.slot === slot && c.cost === 0)!;
}

export class AvatarBuilder {
  /** `celebrate` > 0 plays the equipped victory dance. Feet at (x, floorY). */
  draw(ctx: CanvasRenderingContext2D, x: number, floorY: number, size: number, equipped: Equipped, time: number, celebrate: number, reduced: boolean): void {
    const s = size / 160;
    const hoodie = cosmeticFor("hoodie", equipped.hoodie).color ?? "#5b4bd6";
    const visor = cosmeticFor("visor", equipped.visor);
    const shoes = cosmeticFor("sneakers", equipped.sneakers).color ?? "#f4f1ff";
    const pet = cosmeticFor("pet", equipped.pet);
    const m = reduced ? 0.25 : 1;
    let bob = Math.sin(time * 2.4) * 2 * m;
    let spin = 1;
    if (celebrate > 0 && equipped.dance === "bounce") bob -= Math.abs(Math.sin(time * 9)) * 14 * m;
    if (celebrate > 0 && equipped.dance === "spin") spin = reduced ? 1 : Math.cos(time * 7);

    ctx.save();
    ctx.translate(x, floorY);
    ctx.scale(s, s);
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.beginPath(); ctx.ellipse(0, 0, 40, 8, 0, 0, Math.PI * 2); ctx.fill();
    // podium
    const pod = ctx.createLinearGradient(0, -60, 0, 0);
    pod.addColorStop(0, "#2a2260");
    pod.addColorStop(1, "#120e30");
    ctx.fillStyle = pod;
    ctx.beginPath();
    ctx.moveTo(-46, -62); ctx.lineTo(46, -62); ctx.lineTo(40, 0); ctx.lineTo(-40, 0); ctx.closePath();
    ctx.fill();
    ctx.fillStyle = hoodie;
    ctx.fillRect(-46, -66, 92, 6);
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.35;
    ctx.drawImage(glowSprite(hoodie, 64), -46, -96, 92, 60);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    ctx.translate(0, -62 + bob);
    ctx.scale(spin, 1);
    // shoes peeking behind the podium top are hidden; draw upper body
    ctx.fillStyle = shoes;
    ctx.beginPath(); ctx.ellipse(-30, -6, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
    // hoodie torso
    ctx.fillStyle = hoodie;
    ctx.beginPath();
    ctx.moveTo(-34, 0); ctx.quadraticCurveTo(-36, -58, 0, -62); ctx.quadraticCurveTo(36, -58, 34, 0); ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(-12, -30, 24, 12);
    // arms resting on podium / raised when celebrating
    ctx.strokeStyle = hoodie;
    ctx.lineWidth = 12;
    ctx.lineCap = "round";
    const up = celebrate > 0;
    ctx.beginPath();
    ctx.moveTo(-30, -48); ctx.quadraticCurveTo(-52, up ? -80 : -30, up ? -44 : -36, up ? -104 : -4);
    ctx.moveTo(30, -48); ctx.quadraticCurveTo(52, up ? -80 : -30, up ? 44 : 36, up ? -104 : -4);
    ctx.stroke();
    // head + hood
    ctx.fillStyle = hoodie;
    ctx.beginPath(); ctx.arc(0, -84, 28, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ffd9b3";
    ctx.beginPath(); ctx.arc(0, -82, 21, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#1a1433";
    ctx.beginPath(); ctx.arc(-7, -84, 2.6, 0, Math.PI * 2); ctx.arc(7, -84, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#1a1433"; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.arc(0, -78, 7, 0.2, Math.PI - 0.2); ctx.stroke();
    if (visor.id !== "none") {
      ctx.fillStyle = visor.color ?? "#29f0ff";
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.moveTo(-22, -92); ctx.quadraticCurveTo(0, -98, 22, -92); ctx.lineTo(20, -80); ctx.quadraticCurveTo(0, -84, -20, -80); ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // pet hovering beside the podium
    if (pet.id !== "none") {
      const px = x + 58 * s;
      const py = floorY - (90 + Math.sin(time * 3) * 8 * m) * s;
      const color = pet.color ?? "#ffb347";
      ctx.save();
      ctx.translate(px, py);
      ctx.scale(s, s);
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.55;
      ctx.drawImage(glowSprite(color, 64), -30, -30, 60, 60);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = color;
      if (pet.id === "cat") {
        ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-12, -6); ctx.lineTo(-8, -20); ctx.lineTo(-2, -10); ctx.fill();
        ctx.beginPath(); ctx.moveTo(12, -6); ctx.lineTo(8, -20); ctx.lineTo(2, -10); ctx.fill();
      } else {
        ctx.beginPath(); ctx.roundRect?.(-13, -11, 26, 22, 6); ctx.fill();
        ctx.fillRect(-1, -20, 2, 9);
      }
      ctx.fillStyle = "#1a1433";
      ctx.beginPath(); ctx.arc(-5, -1, 2.2, 0, Math.PI * 2); ctx.arc(5, -1, 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }
}
