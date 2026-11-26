// HYPE RIOT "shaders" for the Canvas2D arena: cached, pre-rendered
// light sprites (radial glows, beam gradients, LED panels, vignette) so
// the per-frame work is cheap drawImage/fill calls instead of rebuilding
// gradients or using shadowBlur every frame.

const cache = new Map<string, HTMLCanvasElement>();

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

/** Soft radial glow (white core -> color -> transparent), size x size px. */
export function glowSprite(color: string, size = 128, core = 0.15): HTMLCanvasElement {
  const key = `glow:${color}:${size}:${core}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const c = makeCanvas(size, size);
  const g = c.getContext("2d")!;
  const r = size / 2;
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, "rgba(255,255,255,0.95)");
  grad.addColorStop(core, color);
  grad.addColorStop(0.45, withAlpha(color, 0.35));
  grad.addColorStop(1, withAlpha(color, 0));
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  cache.set(key, c);
  return c;
}

/** LED matrix texture for the jumbotron (dots on dark glass). */
export function ledPanel(w: number, h: number, pitch: number, tint: string): HTMLCanvasElement {
  const key = `led:${w}:${h}:${pitch}:${tint}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const c = makeCanvas(w, h);
  const g = c.getContext("2d")!;
  const bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, "#0d0a24");
  bg.addColorStop(1, "#05040f");
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.fillStyle = withAlpha(tint, 0.13);
  const r = Math.max(0.6, pitch * 0.28);
  for (let y = pitch / 2; y < h; y += pitch) {
    for (let x = pitch / 2; x < w; x += pitch) {
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
  }
  cache.set(key, c);
  return c;
}

/** Dark edge vignette over the whole arena. */
export function vignette(w: number, h: number): HTMLCanvasElement {
  const key = `vig:${w}:${h}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const c = makeCanvas(w, h);
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.25, w / 2, h * 0.5, Math.max(w, h) * 0.75);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.65)");
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  cache.set(key, c);
  return c;
}

/** Drops cached sprites that depend on the viewport size. */
export function clearSizedCaches(): void {
  for (const k of [...cache.keys()]) {
    if (k.startsWith("led:") || k.startsWith("vig:")) cache.delete(k);
  }
}

/** "#rrggbb" + alpha -> "rgba(...)". */
export function withAlpha(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((x) => x + x).join("") : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Linear mix of two "#rrggbb" colors. */
export function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return `#${((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1)}`;
}
