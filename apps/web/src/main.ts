// HYPE RIOT — app bootstrap + game orchestration.
// Screens: menu / game (3 rounds + splashes) / summary / avatar / settings /
// help / party. The full-screen arena canvas runs behind the DOM HUD.
import "./styles.css";
import {
  ACTION_VERBS,
  PITCH_MAX_CHARS,
  displayName,
  findActionVerb,
  wildcardPresent,
  type ShareData,
  type ShareMode,
} from "@hype-riot/riot-engine";
import type { ContentPack, DataManifest, FactOrCapCard, PitchSetup } from "@hype-riot/shared-types";
import { CATEGORIES } from "@hype-riot/shared-types";
import { ChiptuneSynth } from "./audio/ChiptuneSynth";
import { dailyFor, loadManifest, loadPack, loadPitchPool, type DailyInfo } from "./data";
import { LocalSaveDB, type Equipped, type QualitySetting } from "./db/LocalSaveDB";
import { COSMETICS, type CosmeticSlot } from "./engine/AvatarBuilder";
import { ARENA_THEMES, Renderer } from "./engine/Renderer";
import { HypeMeter } from "./game/HypeMeter";
import {
  QUICK_VICTORY_SCORE, VICTORY_BONUS, crowdBonus, hypeCoins, tierForXp, tierProgress,
} from "./game/Progression";
import { BLITZ_SECONDS, ROUND1_SECONDS, Round1Top5, TOP_N } from "./game/Round1Top5";
import {
  REVEAL_MS, Round2FactOrCap, SECONDS_PER_CARD, clashWinner, correctAnswerText, type CardResult,
} from "./game/Round2FactOrCap";
import { ROUND3_SECONDS, Round3Pitch } from "./game/Round3Pitch";
import { downloadShareCardPng, shareText } from "./sharecard";
import { $, countUp, esc, fmt, setText, trackViewport } from "./ui/dom";
import { APP_HTML } from "./ui/templates";

const PARTY_WS_URL: string = import.meta.env.VITE_PARTY_WS_URL ?? "";

type Mode = "daily" | "quick" | "blitz";
type Phase = "splash" | "r1" | "r2" | "r3" | "result" | "summary";

interface MatchState {
  token: number;
  mode: Mode;
  practice: boolean; // a replay of an already-scored Daily
  pack: ContentPack;
  pitch: PitchSetup;
  seed: number;
  daily: DailyInfo;
  r1: Round1Top5 | null;
  r2: Round2FactOrCap | null;
  r3: Round3Pitch | null;
  phase: Phase;
}

// ---------- boot DOM ----------
const app = document.getElementById("app");
if (!app) throw new Error("#app missing");
app.innerHTML = APP_HTML;

const db = new LocalSaveDB();
const synth = new ChiptuneSynth();
const renderer = new Renderer($<HTMLCanvasElement>("arena"));
const hype = new HypeMeter();

let manifest: DataManifest | null = null;
let match: MatchState | null = null;
let matchToken = 0;
let lastSummary: ShareData | null = null;
let lastMode: Mode = "daily";
let celebrateUntil = 0;
let inputLockedUntil = 0;
let lastTickSecond = -1;

const SCREENS = ["screen-menu", "screen-game", "screen-summary", "screen-avatar", "screen-settings", "screen-help", "screen-party"];

function showScreen(id: string): void {
  for (const s of SCREENS) $(s).classList.toggle("hidden", s !== id);
  document.body.dataset.screen = id;
  lastLayout = 0; // re-measure the HUD on the next frame
  // Move focus to the screen's heading (not a button), so the Enter/Space
  // that opened this screen can't also activate something on it.
  const heading = $(id).querySelector<HTMLElement>("h1, h2, .kicker");
  if (heading && id !== "screen-game") {
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }
}

function toast(text: string, ms = 2400): void {
  const el = $("toast");
  el.textContent = text;
  el.classList.add("show");
  window.clearTimeout((toast as unknown as { t?: number }).t);
  (toast as unknown as { t?: number }).t = window.setTimeout(() => el.classList.remove("show"), ms);
}

function today(): DailyInfo | null {
  return manifest ? dailyFor(new Date(), manifest) : null;
}

// ---------- settings ----------
function applySettings(): void {
  const s = db.get().settings;
  renderer.reducedMotion = s.reducedMotion;
  renderer.setQualitySetting(s.quality);
  synth.enabled = s.sound;
  document.body.classList.toggle("reduced-motion", s.reducedMotion);
  $<HTMLInputElement>("set-sound").checked = s.sound;
  $<HTMLInputElement>("set-motion").checked = s.reducedMotion;
  $<HTMLSelectElement>("set-quality").value = s.quality;
}

function refreshChips(): void {
  const save = db.get();
  const d = today();
  setText($("chip-rank"), tierForXp(save.xp));
  setText($("chip-coins"), fmt(save.coins));
  setText($("chip-streak"), String(d ? db.currentStreak(d.date) : save.dailyStreak));
}

function refreshMenu(): void {
  const d = today();
  if (!manifest || !d) return;
  const played = db.hasPlayedDaily(d.date);
  $("daily-desc").textContent = played
    ? `#${String(d.riotNumber).padStart(3, "0")} done (${fmt(db.get().dailyScores[d.date])} pts) — replay as practice`
    : `Show #${String(d.riotNumber).padStart(3, "0")} — same show worldwide. One scored attempt.`;
  $("menu-kicker").textContent = `TODAY: ${ARENA_THEMES[d.arenaTheme].name.toUpperCase()} · SHOW #${String(d.riotNumber).padStart(3, "0")}`;
  refreshChips();
}

// ---------- splash ----------
interface SplashOpts {
  kicker: string;
  title: string;
  sub?: string;
  bodyHtml?: string;
  ms: number;
  continueLabel?: string;
}

let splashResolve: (() => void) | null = null;

function splash(o: SplashOpts): Promise<void> {
  const el = $("splash");
  $("splash-kicker").textContent = o.kicker;
  $("splash-title").textContent = o.title;
  $("splash-sub").textContent = o.sub ?? "";
  $("splash-body").innerHTML = o.bodyHtml ?? "";
  const cont = $<HTMLButtonElement>("splash-continue");
  cont.classList.toggle("hidden", !o.continueLabel);
  cont.textContent = o.continueLabel ?? "";
  el.classList.remove("hidden");
  el.classList.remove("out");
  void el.offsetWidth; // restart CSS animation
  el.classList.add("in");
  synth.whoosh();
  if (o.continueLabel) cont.focus({ preventScroll: true });
  return new Promise((resolve) => {
    const done = () => {
      if (splashResolve !== done) return;
      splashResolve = null;
      window.clearTimeout(timer);
      el.classList.remove("in");
      el.classList.add("hidden");
      resolve();
    };
    const timer = window.setTimeout(done, o.ms);
    splashResolve = done;
  });
}

function closeSplash(): void {
  splashResolve?.();
}

$("splash-continue").addEventListener("click", closeSplash);
$("splash").addEventListener("click", (e) => {
  if (e.target === $("splash")) closeSplash();
});

// ---------- match flow ----------
function setFeedback(text: string, tone: "good" | "bad" | "info" | "gold" = "info"): void {
  const el = $("feedback");
  el.textContent = text;
  el.dataset.tone = tone;
}

function totalScore(): number {
  if (!match) return 0;
  return (match.r1?.score ?? 0) + (match.r2?.score ?? 0) + (match.r3?.result?.total ?? 0);
}

function alive(token: number): boolean {
  return match !== null && match.token === token;
}

function setModeButtonsEnabled(on: boolean): void {
  for (const id of ["btn-daily", "btn-quick", "btn-blitz"]) $<HTMLButtonElement>(id).disabled = !on;
}

async function startMatch(mode: Mode): Promise<void> {
  if (!manifest) return;
  const d = dailyFor(new Date(), manifest);
  const token = ++matchToken;
  setModeButtonsEnabled(false);
  try {
    let packId = d.packId;
    let theme = d.arenaTheme;
    let seed = d.seed;
    if (mode !== "daily") {
      packId = Math.floor(Math.random() * manifest.packs);
      theme = Math.floor(Math.random() * ARENA_THEMES.length);
      seed = Math.floor(Math.random() * 1e9);
    }
    const pack = await loadPack(packId);
    let pitch = pack.round3;
    if (mode === "quick") {
      try {
        const pool = await loadPitchPool();
        const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
        const wa = pick(pool.wildcards);
        let wb = pick(pool.wildcards);
        while (wb === wa && pool.wildcards.length > 1) wb = pick(pool.wildcards);
        pitch = { template: pick(pool.templates), wildcardA: wa, wildcardB: wb };
      } catch {
        /* fall back to the pack's own pitch */
      }
    }
    if (token !== matchToken) return;
    match = {
      token, mode, pack, pitch, seed, daily: d,
      practice: mode === "daily" && db.hasPlayedDaily(d.date),
      r1: null, r2: null, r3: null, phase: "splash",
    };
    lastMode = mode;
    hype.reset();
    renderer.setTheme(theme);
    renderer.fadeIn("#000000");
    renderer.volt.setState("IDLE_TALK");
    $("found-list").innerHTML = "";
    $("round-ui").innerHTML = "";
    setFeedback("");
    showScreen("screen-game");
    await runRound1(token);
  } catch (err) {
    toast(`Couldn't load the show (${err instanceof Error ? err.message : "network error"}). Try again.`, 4000);
    if (token === matchToken) {
      match = null;
      showScreen("screen-menu");
    }
  } finally {
    setModeButtonsEnabled(true);
  }
}

// ----- Round 1 -----
async function runRound1(token: number): Promise<void> {
  if (!match) return;
  const m = match;
  const p = m.pack.round1;
  const blitz = m.mode === "blitz";
  $("round-label").textContent = blitz ? "BRAINSTORM BLITZ" : "ROUND 1 · TOP 5 RIOT";
  $("prompt-meta").textContent = `${CATEGORIES[p.categoryId] ?? "Brainstorm"} · ${p.answers.length} answers on the board`;
  $("prompt-text").textContent = p.text;
  $("prompt-sub").innerHTML = blitz
    ? `🎯 Find the <b>top ${TOP_N}</b> most famous · ⚡ <b>${esc(p.comboTag.label)}</b> = 2×`
    : `⚡ COMBO: <b>${esc(p.comboTag.label)}</b> = 2× HYPE`;
  $("round-ui").innerHTML = "";
  await splash({
    kicker: blitz ? "BRAINSTORM BLITZ · 45 SECONDS" : `${m.practice ? "PRACTICE · " : ""}ROUND 1 · 25 SECONDS`,
    title: blitz ? "FIND THE TOP 10" : "TOP 5 RIOT",
    sub: p.text,
    ms: 2200,
  });
  if (!alive(token)) return;
  m.phase = "r1";
  m.r1 = new Round1Top5(p, performance.now(), blitz ? BLITZ_SECONDS : ROUND1_SECONDS);
  renderer.volt.setState("IDLE_TALK");
  renderer.crowdReact("wave");
  $("round-ui").innerHTML = `
    <form class="answer-form" id="r1-form" autocomplete="off">
      <input type="text" id="r1-input" placeholder="Type an answer + Enter" aria-label="Your answer"
        autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="send" maxlength="60" />
      <button class="btn primary" type="submit">HIT IT</button>
    </form>`;
  const input = $<HTMLInputElement>("r1-input");
  input.focus({ preventScroll: true });
  $<HTMLFormElement>("r1-form").addEventListener("submit", (ev) => {
    ev.preventDefault();
    submitR1(input.value);
    input.value = "";
    input.focus({ preventScroll: true });
  });
  setFeedback(blitz ? "Go! Famous answers first." : "Go! Every answer counts — typos are forgiven.");
}

function submitR1(raw: string): void {
  if (!match?.r1 || match.phase !== "r1") return;
  const now = performance.now();
  const res = match.r1.submit(raw, now);
  if (res === "DUPLICATE") {
    setFeedback("Already on the board!", "info");
    return;
  }
  if (!res) {
    if (raw.trim()) {
      setFeedback(`“${raw.trim().slice(0, 30)}” isn't on the board.`, "bad");
      synth.miss();
      hype.add(-3);
    }
    return;
  }
  synth.hit(res.tier === "DEEP_CUT");
  if (res.combo) synth.combo();
  hype.add(res.tier === "DEEP_CUT" ? 12 : 8);
  if (res.combo) {
    hype.add(6);
    renderer.shake(9, 0.3);
    renderer.flash("#ff2d95", 0.18);
    renderer.crowdReact("cheer");
    synth.crowd("cheer", 0.8);
  } else if (res.tier === "DEEP_CUT") {
    renderer.crowdReact("cheer");
  }
  renderer.sparks(0.5, 0.36, res.combo ? 40 : 22, res.combo ? 0 : res.tier === "DEEP_CUT" ? 1 : 2);
  renderer.volt.setState(res.combo ? "HYPER_MIC_DROP" : res.tier === "DEEP_CUT" ? "MIND_BLOWN" : "IDLE_TALK");
  const label = `${res.name} +${res.points}${res.combo ? " COMBO!" : res.tier === "DEEP_CUT" ? " DEEP CUT!" : ""}`;
  setFeedback(match.mode === "blitz" ? `${label} · Top 10: ${match.r1.topFound}/${TOP_N}` : label, res.combo ? "gold" : "good");
  const chip = document.createElement("span");
  chip.className = "found-item" + (res.combo ? " combo" : res.tier === "DEEP_CUT" ? " deep" : "") + (res.topTen && match.mode === "blitz" ? " top" : "");
  chip.textContent = `${res.topTen && match.mode === "blitz" ? "★ " : ""}${res.name} +${res.points}`;
  const list = $("found-list");
  list.prepend(chip);
  if (match.mode === "blitz" && match.r1.topFound >= TOP_N) match.r1.endNow();
}

async function endRound1(token: number): Promise<void> {
  if (!match?.r1) return;
  const m = match;
  const r1 = m.r1!;
  m.phase = "splash";
  const missed = r1.matcher.missed();
  const blitz = m.mode === "blitz";
  const topMissed = missed.filter((a) => a.rank < TOP_N);
  const shown = (blitz ? topMissed : missed).slice(0, blitz ? TOP_N : 14);
  const body =
    `<p class="splash-stat"><b>${r1.hits.length}</b> found · <b>${fmt(r1.score)}</b> pts${blitz ? ` · top 10: <b>${r1.topFound}/${TOP_N}</b>` : ""}</p>` +
    (shown.length
      ? `<p class="splash-small">${blitz ? "Top-10 answers you missed" : "Top answers you missed"}:</p><div class="missed">${shown
          .map((a) => `<span class="${a.rank < TOP_N ? "top" : ""}">${esc(displayName(a.name))}</span>`)
          .join("")}</div>`
      : `<p class="splash-small">You cleared the board. Legendary.</p>`);
  if (r1.hits.length >= 8) {
    renderer.confetti(0.6);
    synth.crowd("cheer", 1);
  }
  renderer.volt.setState(r1.hits.length >= 5 ? "CONFETTI_DANCE" : "SIDE_EYE");
  await splash({
    kicker: blitz ? "BLITZ OVER" : "TIME!",
    title: blitz && r1.topFound >= TOP_N ? "TOP 10 CLEARED!" : `${r1.hits.length} ON THE BOARD`,
    bodyHtml: body,
    ms: 9000,
    continueLabel: blitz ? "See results ▸" : "Round 2 ▸",
  });
  if (!alive(token)) return;
  if (blitz) void finishMatch(token);
  else void runRound2(token);
}

// ----- Round 2 -----
async function runRound2(token: number): Promise<void> {
  if (!match) return;
  const m = match;
  $("found-list").innerHTML = "";
  $("round-ui").innerHTML = "";
  setFeedback("");
  $("round-label").textContent = "ROUND 2 · FACT OR CAP?!";
  renderer.volt.setState("FIRE_SUNGLASSES");
  await splash({ kicker: "ROUND 2 · 4 CARDS · 7 SECONDS EACH", title: "FACT OR CAP?!", sub: "Streaks pay ×1.5, then ×2.", ms: 1900 });
  if (!alive(token)) return;
  m.phase = "r2";
  m.r2 = new Round2FactOrCap(m.pack.round2, performance.now());
  if (m.r2.finished) {
    void runRound3(token); // no cards in this pack: never soft-lock
    return;
  }
  renderR2Card();
}

function cardKeyHint(card: FactOrCapCard): string {
  if (card.type === "CLAIM") return "F = fact · C = cap";
  if (card.type === "CLASH") return "A / B or ← / →";
  return "keys 1–4";
}

function renderR2Card(): void {
  if (!match?.r2) return;
  const r2 = match.r2;
  const card = r2.current;
  if (!card) return;
  const streak = r2.streak;
  $("prompt-meta").textContent = `Card ${r2.index + 1} / ${r2.cards.length}${streak >= 1 ? ` · 🔥 streak ${streak}` : ""}${streak >= 1 ? ` · next ×${streak + 1 >= 3 ? "2" : "1.5"}` : ""}`;
  $("prompt-sub").textContent = cardKeyHint(card);
  const ui = $("round-ui");
  if (card.type === "CLAIM") {
    $("prompt-text").textContent = card.claim;
    ui.innerHTML = `
      <div class="choice-row two">
        <button class="choice fact" data-pick="FACT"><kbd>F</kbd> FACT</button>
        <button class="choice cap" data-pick="CAP"><kbd>C</kbd> CAP</button>
      </div>`;
  } else if (card.type === "CLASH") {
    $("prompt-text").textContent = card.question;
    ui.innerHTML = `
      <div class="choice-row two">
        <button class="choice" data-pick="A"><kbd>A</kbd> <span>${esc(card.a)}</span><em class="val"></em></button>
        <button class="choice" data-pick="B"><kbd>B</kbd> <span>${esc(card.b)}</span><em class="val"></em></button>
      </div>`;
  } else {
    $("prompt-text").textContent = "What's in the picture?";
    ui.innerHTML = `
      <div class="zoom-wrap">
        <div class="zoom-window" aria-label="Zooming mystery picture"><span class="zoom-emoji" id="zoom-emoji">${esc(card.emoji)}</span></div>
        <div class="choice-row four">
          ${card.options.map((o, i) => `<button class="choice small" data-pick="${esc(o)}"><kbd>${i + 1}</kbd> ${esc(o)}</button>`).join("")}
        </div>
      </div>`;
    const emoji = $("zoom-emoji");
    emoji.style.transformOrigin = `${card.focusX * 100}% ${card.focusY * 100}%`;
    updateZoom(performance.now());
  }
  ui.querySelectorAll<HTMLButtonElement>("[data-pick]").forEach((b) =>
    b.addEventListener("click", () => answerR2(b.dataset.pick ?? "")),
  );
}

function updateZoom(now: number): void {
  if (!match?.r2) return;
  const card = match.r2.current;
  const el = document.getElementById("zoom-emoji");
  if (!card || card.type !== "ZOOM" || !el) return;
  let r = match.r2.zoomReveal(now);
  if (renderer.reducedMotion) r = Math.floor(r * 4) / 4; // 4 calm steps instead of a continuous zoom
  const inv = 1 - r;
  const scale = 1 + 11 * Math.pow(inv, 1.7);
  const blur = 16 * Math.pow(inv, 1.3);
  el.style.transform = `scale(${scale.toFixed(3)})`;
  el.style.filter = blur > 0.3 ? `blur(${blur.toFixed(1)}px) saturate(1.2)` : "none";
}

function answerR2(pick: string): void {
  if (!match?.r2 || match.phase !== "r2") return;
  const now = performance.now();
  if (now < inputLockedUntil) return;
  const r2 = match.r2;
  const card = r2.current;
  if (!card || r2.phase !== "ask") return;
  let res: CardResult | null = null;
  if (card.type === "CLAIM") res = r2.answerClaim(pick === "FACT", now);
  else if (card.type === "CLASH") res = r2.answerClash(pick === "A" ? "A" : "B", now);
  else res = r2.answerZoom(pick, now);
  if (!res) return;
  inputLockedUntil = now + REVEAL_MS;
  showR2Reveal(res);
}

function valueText(v: number, unit: string): string {
  if (unit.toLowerCase() === "year") return String(v);
  return `${v.toLocaleString("en-US")} ${unit}`;
}

function showR2Reveal(res: CardResult): void {
  const card = res.card;
  const ui = $("round-ui");
  const right = correctAnswerText(card);
  ui.querySelectorAll<HTMLButtonElement>("[data-pick]").forEach((b) => {
    const pick = b.dataset.pick ?? "";
    const label = card.type === "CLASH" ? (pick === "A" ? card.a : card.b) : pick;
    b.disabled = true;
    if (label === right) b.classList.add("correct");
    else if (label === res.picked) b.classList.add("wrong");
    if (card.type === "CLASH") {
      const v = b.querySelector(".val");
      if (v) v.textContent = valueText(pick === "A" ? card.aValue : card.bValue, card.unit);
    }
  });
  if (card.type === "ZOOM") {
    const el = document.getElementById("zoom-emoji");
    if (el) {
      el.style.transform = "scale(1)";
      el.style.filter = "none";
    }
  }
  let truth = "";
  if (card.type === "CLAIM") truth = `It's ${card.isFact ? "FACT" : "CAP"}.`;
  else if (card.type === "CLASH") {
    const winner = clashWinner(card) === "A" ? card.a : card.b;
    truth = `${winner}: ${valueText(clashWinner(card) === "A" ? card.aValue : card.bValue, card.unit)} vs ${valueText(clashWinner(card) === "A" ? card.bValue : card.aValue, card.unit)}.`;
  } else truth = `It was ${card.answer}.`;
  if (res.correct) {
    synth.correct();
    hype.add(10 + res.streakAfter * 3);
    renderer.crowdReact("cheer");
    renderer.sparks(0.5, 0.4, 24, 4);
    if (res.streakAfter >= 3) {
      renderer.shake(7, 0.25);
      synth.crowd("cheer", 0.7);
    }
    renderer.volt.setState(res.streakAfter >= 3 ? "CONFETTI_DANCE" : "VICTORY_SPIN");
    setFeedback(`✓ +${res.points}${res.streakAfter >= 2 ? ` (🔥×${res.streakAfter >= 3 ? 2 : 1.5})` : ""} — ${truth}`, "good");
  } else {
    synth.wrong();
    hype.add(res.timedOut ? -10 : -14);
    renderer.crowdReact("boo");
    renderer.tomatoes(res.timedOut ? 4 : 7);
    synth.crowd("boo", 0.6);
    renderer.volt.setState("WRONG_BUZZER");
    setFeedback(`${res.timedOut ? "⏰ Time's up" : "✕ Nope"} — ${truth}`, "bad");
  }
  setText($("prompt-meta"), `Card ${match!.r2!.index + 1} / ${match!.r2!.cards.length} · ${res.correct ? "correct" : "streak reset"}`);
}

// ----- Round 3 -----
async function runRound3(token: number): Promise<void> {
  if (!match) return;
  const m = match;
  $("round-ui").innerHTML = "";
  setFeedback("");
  $("round-label").textContent = "ROUND 3 · THE PITCH";
  renderer.volt.setState("IDLE_TALK");
  const setup = m.pitch;
  await splash({
    kicker: "ROUND 3 · 30 SECONDS",
    title: "THE ULTIMATE PITCH",
    sub: `${setup.wildcardA} + ${setup.wildcardB}`,
    ms: 2200,
  });
  if (!alive(token)) return;
  m.phase = "r3";
  m.r3 = new Round3Pitch(setup, m.seed, performance.now());
  $("prompt-meta").textContent = "One line · name both wildcards · use an action verb";
  $("prompt-text").textContent = m.r3.promptText;
  $("prompt-sub").textContent = "";
  $("round-ui").innerHTML = `
    <div class="pitch-checks" id="pitch-checks">
      <span data-check="a">${esc(setup.wildcardA)}</span>
      <span data-check="b">${esc(setup.wildcardB)}</span>
      <span data-check="verb">action verb</span>
      <span data-check="len">30+ chars</span>
    </div>
    <form class="answer-form pitch-form" id="r3-form">
      <textarea id="pitch-input" maxlength="${PITCH_MAX_CHARS}" rows="2" aria-label="Your pitch"
        placeholder="e.g. ${esc(setup.wildcardA)} race through ${esc(setup.wildcardB)} to save the world"></textarea>
      <div class="pitch-side"><span class="char-count"><b id="pitch-count">0</b>/${PITCH_MAX_CHARS}</span>
      <button class="btn primary" type="submit">DROP IT 🎤</button></div>
    </form>`;
  const ta = $<HTMLTextAreaElement>("pitch-input");
  ta.focus({ preventScroll: true });
  const checks = () => {
    const v = ta.value;
    setText($("pitch-count"), String(v.length));
    const box = $("pitch-checks");
    box.querySelector('[data-check="a"]')!.classList.toggle("on", wildcardPresent(v, setup.wildcardA));
    box.querySelector('[data-check="b"]')!.classList.toggle("on", wildcardPresent(v, setup.wildcardB));
    box.querySelector('[data-check="verb"]')!.classList.toggle("on", findActionVerb(v, ACTION_VERBS) !== null);
    box.querySelector('[data-check="len"]')!.classList.toggle("on", v.trim().length >= 30);
  };
  ta.addEventListener("input", checks);
  ta.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submitPitch(token);
    }
  });
  $<HTMLFormElement>("r3-form").addEventListener("submit", (e) => {
    e.preventDefault();
    void submitPitch(token);
  });
  setFeedback("+250 per wildcard · +150 action verb · short pitches lose points");
}

async function submitPitch(token: number): Promise<void> {
  if (!match?.r3 || match.phase !== "r3" || match.r3.result) return;
  const m = match;
  const ta = document.getElementById("pitch-input") as HTMLTextAreaElement | null;
  const res = m.r3!.submit(ta?.value ?? "");
  m.phase = "result";
  updateTimerRing(0, ROUND3_SECONDS, 0);
  synth.pitchReveal();
  hype.add(res.crown ? 30 : res.total >= 400 ? 12 : -5);
  if (res.crown) {
    renderer.confetti(1);
    renderer.crowdReact("cheer");
    renderer.flash("#ffe066", 0.25);
    synth.crowd("cheer", 1.2);
    renderer.volt.setState("HYPER_MIC_DROP");
  } else {
    renderer.crowdReact(res.total >= 400 ? "cheer" : "gasp");
    renderer.volt.setState(res.total >= 400 ? "LAUGHING_FIT" : "SIDE_EYE");
  }
  const row = (ok: boolean, label: string, pts: string) =>
    `<li class="${ok ? "ok" : "no"}"><span>${ok ? "✓" : "✕"} ${esc(label)}</span><b>${pts}</b></li>`;
  $("round-ui").innerHTML = `
    <div class="pitch-result">
      <p class="pitch-quote">“${esc(m.r3!.pitchText || "…silence…")}”</p>
      <ul>
        ${row(res.wildcard1, m.r3!.setup.wildcardA, res.wildcard1 ? "+250" : "0")}
        ${row(res.wildcard2, m.r3!.setup.wildcardB, res.wildcard2 ? "+250" : "0")}
        ${row(res.actionVerb, res.actionVerbMatched ? `verb: ${res.actionVerbMatched}` : "action verb", res.actionVerb ? "+150" : "0")}
        ${row(res.lengthPenalty === 0, "length", String(res.lengthPenalty))}
        ${row(true, "crowd reaction", `+${res.crowdVariance}`)}
      </ul>
      <p class="pitch-total">${res.crown ? "👑 CROWD FAVORITE · " : ""}${fmt(res.total)} pts</p>
      <button class="btn primary" id="btn-to-summary">Final results ▸</button>
    </div>`;
  setFeedback(res.crown ? "The arena is on its feet!" : "The crowd has spoken.", res.crown ? "gold" : "info");
  const go = $("btn-to-summary");
  go.focus({ preventScroll: true });
  let moved = false;
  const next = () => {
    if (moved || !alive(token)) return;
    moved = true;
    void finishMatch(token);
  };
  go.addEventListener("click", next);
  window.setTimeout(next, 6000);
}

// ----- results -----
async function finishMatch(token: number): Promise<void> {
  if (!alive(token)) return;
  const m = match!;
  m.phase = "summary";
  const r1 = m.r1?.score ?? 0;
  const r2 = m.r2?.score ?? 0;
  const r3 = m.r3?.result?.total ?? 0;
  const bonus = crowdBonus(hype.peak);
  const total = r1 + r2 + r3 + bonus;
  const save = db.get();
  const victory =
    (m.mode === "quick" && total >= QUICK_VICTORY_SCORE) ||
    (m.mode === "blitz" && (m.r1?.topFound ?? 0) >= TOP_N);
  let coins = 0;
  let streakBonusDays = 0;
  let note: string;
  if (m.practice) {
    note = `Practice run — today's scored show was ${fmt(save.dailyScores[m.daily.date] ?? 0)}. No coins or XP for replays.`;
  } else {
    if (m.mode === "daily") {
      const streak = db.recordDaily(m.daily.date, total);
      streakBonusDays = streak ?? 0;
    }
    coins = hypeCoins(total, streakBonusDays, victory ? VICTORY_BONUS : 0);
    db.update({
      xp: save.xp + total,
      coins: save.coins + coins,
      bestScore: Math.max(save.bestScore, total),
      gamesPlayed: save.gamesPlayed + 1,
    });
    note =
      total >= 6000 ? "STANDING OVATION — the arena is shaking!"
        : total >= 3500 ? "The crowd is ELECTRIC!"
          : total >= 1800 ? "A warm crowd — they want more."
            : "Tough crowd tonight. Run it back!";
    if (streakBonusDays > 0) note += ` 🔥 ${streakBonusDays}-day streak bonus: +${streakBonusDays * 15} coins.`;
    if (victory) note += ` 🏆 Victory bonus +${VICTORY_BONUS}.`;
  }
  const mode: ShareMode = m.practice ? "practice" : m.mode;
  const xpNow = db.get().xp;
  const data: ShareData = {
    mode,
    riotNumber: m.daily.riotNumber,
    promptText: m.pack.round1.text,
    totalScore: total,
    round1Score: r1,
    round1Hits: m.r1?.hits.length ?? 0,
    round1Total: m.pack.round1.answers.length,
    round2Score: r2,
    round2Marks: m.r2?.results.map((x) => x.correct) ?? [],
    round3Score: r3,
    round3Crown: m.r3?.result?.crown ?? false,
    blitzTopFound: m.r1?.topFound ?? 0,
    crowdBonus: bonus,
    hypePeak: hype.peak,
    rankTitle: tierForXp(xpNow),
  };
  lastSummary = data;
  match = null;

  const cell = (label: string, value: string, cls = "") => `<div class="summary-cell ${cls}"><span>${esc(label)}</span><b>${esc(value)}</b></div>`;
  $("summary-kicker").textContent =
    mode === "daily" ? `DAILY RIOT #${String(data.riotNumber).padStart(3, "0")}` : mode === "practice" ? "PRACTICE RUN" : mode === "quick" ? "QUICK ARCADE" : "BRAINSTORM BLITZ";
  $("summary-grid").innerHTML =
    (m.mode === "blitz"
      ? cell("Top-10 found", `${data.blitzTopFound}/10`) + cell("Answers", `${data.round1Hits} · +${fmt(r1)}`)
      : cell("Top 5 Riot", `${data.round1Hits} · +${fmt(r1)}`) +
        cell("Fact or Cap", `${data.round2Marks.filter(Boolean).length}/${data.round2Marks.length} · +${fmt(r2)}`) +
        cell("The Pitch", `${data.round3Crown ? "👑 " : ""}+${fmt(r3)}`)) +
    cell("Crowd bonus", `+${fmt(bonus)}`, "accent") +
    cell("Hype Coins", `+${coins}`, "gold");
  $("summary-note").textContent = note;
  const prog = tierProgress(xpNow);
  $("rank-label").textContent = prog.next ? `${data.rankTitle} → ${prog.next}` : `${data.rankTitle} · max rank`;
  $<HTMLElement>("rank-fill").style.width = `${Math.round(prog.progress * 100)}%`;
  $("share-text").textContent = shareText(data);
  $("btn-again").textContent = m.mode === "daily" ? "Replay (practice)" : "Play again";
  showScreen("screen-summary");
  countUp($("summary-total"), total, 1200, renderer.reducedMotion);
  celebrateUntil = performance.now() + 6000;
  renderer.volt.setState("VICTORY_SPIN");
  renderer.crowdReact("cheer");
  renderer.confetti(total >= 3500 ? 1.4 : 0.7);
  synth.fanfare();
  synth.crowd("cheer", 1);
  refreshMenu();
  refreshChips();
}

function quitMatch(): void {
  match = null;
  matchToken++;
  closeSplash();
  showScreen("screen-menu");
  renderer.volt.setState("IDLE_TALK");
  refreshMenu();
}

// ---------- avatar studio ----------
function renderAvatarPanel(): void {
  const save = db.get();
  $("avatar-coins").textContent = fmt(save.coins);
  const owned = (slot: CosmeticSlot, id: string, cost: number) => cost === 0 || db.isUnlocked(slot, id);
  const slots: Array<[CosmeticSlot, string]> = [
    ["hoodie", "Hoodies"], ["visor", "Visors"], ["sneakers", "Sneakers"], ["pet", "Holo pets"], ["dance", "Victory dances"],
  ];
  $("avatar-slots").innerHTML = slots
    .map(([slot, label]) => `
      <h3>${esc(label)}</h3>
      <div class="cosmetic-grid">
        ${COSMETICS.filter((c) => c.slot === slot)
          .map((c) => {
            const isOwned = owned(slot, c.id, c.cost);
            const isEquipped = save.equipped[slot] === c.id;
            return `<button class="cosmetic ${isEquipped ? "equipped" : ""}" data-slot="${slot}" data-id="${esc(c.id)}" ${isEquipped ? 'aria-pressed="true"' : ""}>
              ${c.color ? `<i class="swatch" style="background:${esc(c.color)}"></i>` : `<i class="swatch none"></i>`}
              <span>${esc(c.name)}</span>
              <small>${isEquipped ? "Equipped" : isOwned ? "Equip" : `${c.cost} 🪙`}</small>
            </button>`;
          })
          .join("")}
      </div>`)
    .join("");
  $("avatar-slots").querySelectorAll<HTMLButtonElement>("button[data-slot]").forEach((b) => {
    b.addEventListener("click", () => {
      const slot = b.dataset.slot as CosmeticSlot;
      const id = b.dataset.id ?? "";
      const item = COSMETICS.find((c) => c.slot === slot && c.id === id);
      if (!item) return;
      const s = db.get();
      const equipped: Equipped = { ...s.equipped, [slot]: id };
      if (!owned(slot, id, item.cost)) {
        if (s.coins < item.cost) {
          $("avatar-msg").textContent = `Not enough Hype Coins — ${item.name} costs ${item.cost}, you have ${s.coins}.`;
          return;
        }
        db.update({ coins: s.coins - item.cost, unlocked: [...s.unlocked, `${slot}:${id}`], equipped });
        $("avatar-msg").textContent = `Unlocked ${item.name}!`;
        synth.combo();
        celebrateUntil = performance.now() + 2500;
      } else {
        db.update({ equipped });
        $("avatar-msg").textContent = `${item.name} equipped.`;
      }
      refreshChips();
      renderAvatarPanel();
    });
  });
}

// ---------- party room (only when a relay URL is configured) ----------
let partySocket: WebSocket | null = null;
const ROOM_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function partyConnect(code: string): void {
  const name = ($<HTMLInputElement>("party-name").value.trim() || "Player").slice(0, 12);
  const clean = code.toUpperCase();
  if (!/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/.test(clean)) {
    $("party-status").textContent = "Room codes are 4 letters/numbers (no I, L, O, 0 or 1).";
    return;
  }
  partySocket?.close();
  const url = `${PARTY_WS_URL.replace(/\/$/, "")}/${clean}`;
  $("party-status").textContent = `Connecting to room ${clean}…`;
  try {
    const ws = new WebSocket(url);
    partySocket = ws;
    ws.addEventListener("open", () => {
      ws.send(JSON.stringify({ t: "JOIN", name, avatar: 0 }));
      $("party-status").textContent = `In room ${clean}. Share the code with friends! (Synced party matches are coming next — the lobby is live now.)`;
    });
    ws.addEventListener("message", (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as { t?: string; players?: Array<{ name: string }> };
        if (msg.t === "LOBBY" && Array.isArray(msg.players)) {
          $("party-lobby").innerHTML = msg.players.map((p) => `<li>${esc(p.name)}</li>`).join("");
        }
      } catch {
        /* ignore malformed relay messages */
      }
    });
    ws.addEventListener("close", () => {
      if (partySocket === ws) $("party-status").textContent = "Disconnected from the room.";
    });
    ws.addEventListener("error", () => {
      $("party-status").textContent = "Couldn't reach the party relay. Try again later.";
    });
  } catch {
    $("party-status").textContent = "Couldn't open a connection to the party relay.";
  }
}

// ---------- frame loop ----------
let rafId = 0;
let lastTs = 0;
const ringFg = () => document.getElementById("ring-fg") as SVGCircleElement | null;
const RING_LEN = 2 * Math.PI * 27;

function updateTimerRing(remaining: number, total: number, lowAt: number): void {
  const fg = ringFg();
  if (fg) {
    fg.style.strokeDasharray = `${RING_LEN}`;
    fg.style.strokeDashoffset = `${RING_LEN * (1 - Math.max(0, Math.min(1, remaining / total)))}`;
  }
  const ring = $("timer-ring");
  ring.classList.toggle("low", remaining <= lowAt && remaining > 0);
  setText($("timer-num"), String(Math.ceil(remaining)));
}

function gameTick(now: number): void {
  if (!match) return;
  const m = match;
  if (m.phase === "r1" && m.r1) {
    const rem = m.r1.remaining(now);
    updateTimerRing(rem, m.r1.seconds, 5);
    const sec = Math.ceil(rem);
    if (rem <= 5 && rem > 0 && sec !== lastTickSecond) {
      lastTickSecond = sec;
      synth.tick();
      if (renderer.volt.state === "IDLE_TALK") renderer.volt.setState("PANIC_COUNTDOWN");
    }
    if (m.r1.isOver(now)) {
      lastTickSecond = -1;
      void endRound1(m.token);
    }
  } else if (m.phase === "r2" && m.r2) {
    const r2 = m.r2;
    for (const ev of r2.update(now)) {
      if (ev.kind === "timeout") showR2Reveal(ev.result);
      else if (r2.finished) {
        void runRound3(m.token);
        m.phase = "splash";
        return;
      } else renderR2Card();
    }
    updateTimerRing(r2.cardRemaining(now), SECONDS_PER_CARD, 2);
    if (r2.current?.type === "ZOOM" && r2.phase === "ask") updateZoom(now);
  } else if (m.phase === "r3" && m.r3) {
    const rem = m.r3.remaining(now);
    updateTimerRing(rem, ROUND3_SECONDS, 5);
    if (m.r3.isOver(now) && !m.r3.result) void submitPitch(m.token);
  }
  setText($("score-now"), fmt(totalScore()));
}

let lastHypeShown = -1;

function jumbo(): { title: string; sub: string } {
  if (match) {
    const label =
      match.phase === "r1" || (match.phase === "splash" && !match.r2 && !match.r3)
        ? match.mode === "blitz" ? "BRAINSTORM BLITZ" : "TOP 5 RIOT"
        : match.r3 ? "THE PITCH" : "FACT OR CAP?!";
    return { title: label, sub: `SCORE ${fmt(totalScore())} · HYPE ${Math.round(hype.value)}%` };
  }
  const d = today();
  return { title: "HYPE RIOT", sub: d ? `SHOW #${String(d.riotNumber).padStart(3, "0")} · ${ARENA_THEMES[d.arenaTheme].name.toUpperCase()}` : "LOADING THE SHOW" };
}

let lastLayout = 0;

/** Tells the renderer where the HUD leaves space for the jumbotron (game screen only). */
function layoutArena(): void {
  if (document.body.dataset.screen !== "screen-game") {
    renderer.jumboBox = null;
    return;
  }
  const meter = document.querySelector<HTMLElement>(".hype-meter");
  const top = $("btn-quit").getBoundingClientRect().bottom;
  const meterBottom = meter && meter.offsetParent ? meter.getBoundingClientRect().bottom : top;
  const spacer = document.querySelector<HTMLElement>(".stage-spacer")!.getBoundingClientRect();
  const start = Math.max(top, meterBottom);
  renderer.jumboBox = { top: start, maxH: (spacer.bottom - start) * 0.62 };
}

function loop(ts: number): void {
  const frameMs = lastTs ? ts - lastTs : 16;
  const dt = Math.min(0.1, frameMs / 1000);
  lastTs = ts;
  const now = performance.now();
  if (now - lastLayout > 300) {
    lastLayout = now;
    layoutArena();
  }
  gameTick(now);
  hype.update(dt);
  const hv = Math.round(hype.value);
  if (hv !== lastHypeShown) {
    lastHypeShown = hv;
    $<HTMLElement>("hype-fill").style.transform = `scaleX(${hv / 100})`;
    setText($("hype-value"), `${hv}%`);
    document.body.classList.toggle("hype-max", hv >= 80);
  }
  const j = jumbo();
  renderer.frame(dt, frameMs, {
    energy: match ? hype.energy : 0.35,
    jumboTitle: j.title,
    jumboSub: j.sub,
    equipped: db.get().equipped,
    celebrate: Math.max(0, (celebrateUntil - now) / 1000),
  });
  rafId = requestAnimationFrame(loop);
}

function startLoop(): void {
  if (rafId) return;
  lastTs = 0;
  rafId = requestAnimationFrame(loop);
}

function stopLoop(): void {
  cancelAnimationFrame(rafId);
  rafId = 0;
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    // Rendering pauses; round timers are wall-clock and keep running,
    // so switching tabs can't freeze the clock to look up answers.
    stopLoop();
    synth.suspend();
  } else {
    startLoop();
  }
});

// ---------- keyboard ----------
document.addEventListener("keydown", (e) => {
  if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
  if (!$("splash").classList.contains("hidden")) {
    if (e.key === "Enter" || e.key === " " || e.key === "Escape") {
      e.preventDefault();
      closeSplash();
    }
    return;
  }
  const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
  if (e.key === "Escape") {
    if (document.body.dataset.screen === "screen-game") {
      if (window.confirm("Quit this show? Progress in this match will be lost.")) quitMatch();
    } else if (document.body.dataset.screen !== "screen-menu") showScreen("screen-menu");
    return;
  }
  if (typing || !match?.r2 || match.phase !== "r2") return;
  const card = match.r2.current;
  if (!card) return;
  const k = e.key.toLowerCase();
  if (card.type === "CLAIM" && (k === "f" || k === "c")) answerR2(k === "f" ? "FACT" : "CAP");
  else if (card.type === "CLASH" && ["a", "b", "1", "2", "arrowleft", "arrowright"].includes(k))
    answerR2(k === "a" || k === "1" || k === "arrowleft" ? "A" : "B");
  else if (card.type === "ZOOM" && ["1", "2", "3", "4"].includes(k)) answerR2(card.options[Number(k) - 1] ?? "");
  else return;
  e.preventDefault();
});

// ---------- wiring ----------
$("btn-daily").addEventListener("click", () => void startMatch("daily"));
$("btn-quick").addEventListener("click", () => void startMatch("quick"));
$("btn-blitz").addEventListener("click", () => void startMatch("blitz"));
$("btn-home").addEventListener("click", () => {
  if (match) {
    if (window.confirm("Quit this show? Progress in this match will be lost.")) quitMatch();
  } else showScreen("screen-menu");
});
$("btn-quit").addEventListener("click", () => {
  if (window.confirm("Quit this show? Progress in this match will be lost.")) quitMatch();
});
$("btn-help").addEventListener("click", () => showScreen("screen-help"));
$("btn-avatar").addEventListener("click", () => {
  $("avatar-msg").textContent = "";
  renderAvatarPanel();
  showScreen("screen-avatar");
});
$("btn-settings").addEventListener("click", () => showScreen("screen-settings"));
document.querySelectorAll<HTMLButtonElement>("[data-back]").forEach((b) => b.addEventListener("click", () => showScreen("screen-menu")));
$("btn-menu-summary").addEventListener("click", () => showScreen("screen-menu"));
$("btn-again").addEventListener("click", () => void startMatch(lastMode));
$("btn-share").addEventListener("click", async () => {
  if (!lastSummary) return;
  const text = shareText(lastSummary);
  try {
    if (navigator.share && matchMedia("(pointer: coarse)").matches) {
      await navigator.share({ text });
      return;
    }
    await navigator.clipboard.writeText(text);
    toast("Copied to clipboard — paste it anywhere!");
  } catch (err) {
    if ((err as DOMException)?.name !== "AbortError") toast("Couldn't copy automatically — select the text above.");
  }
});
$("btn-png-share").addEventListener("click", () => {
  if (lastSummary) downloadShareCardPng(lastSummary);
});
$<HTMLInputElement>("set-sound").addEventListener("change", (e) => {
  db.update({ settings: { ...db.get().settings, sound: (e.target as HTMLInputElement).checked } });
  applySettings();
});
$<HTMLInputElement>("set-motion").addEventListener("change", (e) => {
  db.update({ settings: { ...db.get().settings, reducedMotion: (e.target as HTMLInputElement).checked } });
  applySettings();
});
$<HTMLSelectElement>("set-quality").addEventListener("change", (e) => {
  db.update({ settings: { ...db.get().settings, quality: (e.target as HTMLSelectElement).value as QualitySetting } });
  applySettings();
});
if (PARTY_WS_URL) {
  $("btn-party").classList.remove("hidden");
  $("btn-party").addEventListener("click", () => showScreen("screen-party"));
  $("btn-create-room").addEventListener("click", () => {
    let code = "";
    const rnd = new Uint32Array(4);
    crypto.getRandomValues(rnd);
    for (const r of rnd) code += ROOM_ALPHABET[r % ROOM_ALPHABET.length];
    $<HTMLInputElement>("party-code").value = code;
    partyConnect(code);
  });
  $("btn-join-room").addEventListener("click", () => partyConnect($<HTMLInputElement>("party-code").value.trim()));
}

trackViewport(() => renderer.resize());

async function boot(): Promise<void> {
  applySettings();
  refreshChips();
  startLoop();
  try {
    manifest = await loadManifest();
    const d = dailyFor(new Date(), manifest);
    db.refreshStreak(d.date);
    renderer.setTheme(d.arenaTheme);
    renderer.fadeIn("#000000");
    const c = manifest.counts;
    $("dataset-line").textContent = `${c.prompts} shows · ${fmt(c.answers)} answers · ${c.claims} facts & caps · ${c.zoom} mystery zooms · ${c.wildcards} pitch wildcards`;
    setModeButtonsEnabled(true);
    refreshMenu();
    showScreen("screen-menu");
  } catch (err) {
    const line = $("dataset-line");
    line.innerHTML = `<span class="error">Couldn't load the show (${esc(err instanceof Error ? err.message : "unknown error")}).</span> <button class="link-btn" id="btn-retry">Retry</button>`;
    $("btn-retry").addEventListener("click", () => location.reload());
  }
}

void boot();
