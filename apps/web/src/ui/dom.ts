// Small DOM helpers for the HUD (no framework).

export const $ = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} missing`);
  return el as T;
};

/** HTML-escapes untrusted/data text for template strings. */
export function esc(s: string | number): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Sets textContent only when it changed (avoids layout churn in the frame loop). */
export function setText(el: HTMLElement, text: string): void {
  if (el.textContent !== text) el.textContent = text;
}

export function fmt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

/** Animated count-up for summary numbers (skipped with reduced motion). */
export function countUp(el: HTMLElement, to: number, ms: number, reduced: boolean, prefix = ""): void {
  if (reduced || ms <= 0) {
    el.textContent = prefix + fmt(to);
    return;
  }
  const start = performance.now();
  const step = (now: number) => {
    const k = Math.min(1, (now - start) / ms);
    const eased = 1 - Math.pow(1 - k, 3);
    el.textContent = prefix + fmt(to * eased);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** Tracks the visual viewport (mobile keyboard) as CSS var --vvh. */
export function trackViewport(onResize: () => void): void {
  const apply = () => {
    const vv = window.visualViewport;
    const h = vv ? vv.height : window.innerHeight;
    document.documentElement.style.setProperty("--vvh", `${Math.round(h)}px`);
    document.documentElement.style.setProperty("--vvtop", `${Math.round(vv ? vv.offsetTop : 0)}px`);
  };
  apply();
  let raf = 0;
  const schedule = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      apply();
      onResize();
    });
  };
  window.addEventListener("resize", schedule);
  window.addEventListener("orientationchange", schedule);
  window.visualViewport?.addEventListener("resize", () => apply());
  window.visualViewport?.addEventListener("scroll", () => apply());
}
