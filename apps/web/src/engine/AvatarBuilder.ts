// HYPE RIOT AvatarBuilder (Blueprint §2/§3): 48x48 player avatar with
// 100% cosmetic unlocks bought with Hype Coins — zero pay-to-win.
import type { Renderer } from "./Renderer";
import type { SaveData } from "../db/LocalSaveDB";

export interface Cosmetic {
  id: string;
  slot: "hoodie" | "visor" | "sneakers" | "pet" | "dance";
  name: string;
  cost: number; // Hype Coins; 0 = owned by default
  color?: string;
}

export const COSMETICS: Cosmetic[] = [
  { id: "default", slot: "hoodie", name: "Starter Hoodie", cost: 0, color: "#5B4B8A" },
  { id: "neon-pink", slot: "hoodie", name: "Neon Pink Hoodie", cost: 25, color: "#FF2A85" },
  { id: "volt-teal", slot: "hoodie", name: "Volt Teal Hoodie", cost: 25, color: "#00BBF9" },
  { id: "gold", slot: "hoodie", name: "Champion Gold Hoodie", cost: 90, color: "#FFD166" },
  { id: "none", slot: "visor", name: "No Visor", cost: 0 },
  { id: "cyber", slot: "visor", name: "Cyber Visor", cost: 30, color: "#00F5D4" },
  { id: "shades", slot: "visor", name: "Fire Shades", cost: 45, color: "#E76F51" },
  { id: "default", slot: "sneakers", name: "Canvas Sneakers", cost: 0, color: "#FFF8E7" },
  { id: "neon", slot: "sneakers", name: "Neon Sneakers", cost: 35, color: "#A8FF35" },
  { id: "rocket", slot: "sneakers", name: "Rocket Sneakers", cost: 70, color: "#FF70A6" },
  { id: "none", slot: "pet", name: "No Pet", cost: 0 },
  { id: "cat", slot: "pet", name: "Pixel Cat", cost: 50, color: "#F4A261" },
  { id: "bot", slot: "pet", name: "Mini Bot", cost: 65, color: "#8F79D2" },
  { id: "none", slot: "dance", name: "No Dance", cost: 0 },
  { id: "bounce", slot: "dance", name: "Victory Bounce", cost: 20 },
  { id: "spin", slot: "dance", name: "Victory Spin", cost: 40 },
];

export function cosmeticById(slot: Cosmetic["slot"], id: string): Cosmetic {
  return COSMETICS.find((c) => c.slot === slot && c.id === id) ?? COSMETICS[0];
}

export class AvatarBuilder {
  draw(r: Renderer, x: number, y: number, equipped: SaveData["equipped"], time: number): void {
    const hoodie = cosmeticById("hoodie", equipped.hoodie);
    const visor = cosmeticById("visor", equipped.visor);
    const sneakers = cosmeticById("sneakers", equipped.sneakers);
    const pet = cosmeticById("pet", equipped.pet);
    let bounce = 0;
    if (equipped.dance === "bounce") bounce = Math.abs(Math.sin(time * 5)) * 4;
    if (equipped.dance === "spin") bounce = Math.sin(time * 5) * 2;
    const oy = y - bounce;
    // legs + sneakers
    r.rect(x + 16, oy + 36, 6, 8, "#1E1735");
    r.rect(x + 27, oy + 36, 6, 8, "#1E1735");
    r.rect(x + 14, oy + 44, 9, 4, sneakers.color ?? "#FFF8E7");
    r.rect(x + 26, oy + 44, 9, 4, sneakers.color ?? "#FFF8E7");
    // hoodie body
    r.rect(x + 12, oy + 18, 24, 19, hoodie.color ?? "#5B4B8A");
    r.rect(x + 8, oy + 20, 5, 14, hoodie.color ?? "#5B4B8A");
    r.rect(x + 35, oy + 20, 5, 14, hoodie.color ?? "#5B4B8A");
    // head
    r.rect(x + 15, oy + 2, 18, 16, "#FFD166");
    r.rect(x + 15, oy + 2, 18, 4, hoodie.color ?? "#5B4B8A"); // hood rim
    r.rect(x + 19, oy + 10, 2, 3, "#110E1B");
    r.rect(x + 27, oy + 10, 2, 3, "#110E1B");
    r.rect(x + 21, oy + 15, 6, 2, "#110E1B");
    if (visor.id !== "none") {
      r.rect(x + 15, oy + 8, 18, 5, visor.color ?? "#00F5D4");
    }
    // pet
    if (pet.id === "cat") {
      r.rect(x + 38, oy + 38, 9, 7, pet.color ?? "#F4A261");
      r.rect(x + 38, oy + 35, 3, 3, pet.color ?? "#F4A261");
      r.rect(x + 44, oy + 35, 3, 3, pet.color ?? "#F4A261");
      r.rect(x + 40, oy + 40, 1, 1, "#110E1B");
      r.rect(x + 44, oy + 40, 1, 1, "#110E1B");
    } else if (pet.id === "bot") {
      r.rect(x + 38, oy + 36, 9, 9, pet.color ?? "#8F79D2");
      r.rect(x + 40, oy + 39, 2, 2, "#00F5D4");
      r.rect(x + 44, oy + 39, 2, 2, "#00F5D4");
      r.rect(x + 42, oy + 33, 1, 3, "#8F79D2");
    }
  }
}
