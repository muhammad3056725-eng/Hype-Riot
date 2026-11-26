// HYPE RIOT — app bootstrap + game orchestration (Blueprint §2, §6).
// Screens: menu / game (3 rounds) / summary / avatar / settings / party.
// The arena canvas (MC VOLT + crowd + player avatar) runs throughout.
import "./styles.css";
import { ARENA_THEMES, Renderer } from "./engine/Renderer";
import { CrowdSystem } from "./engine/CrowdSystem";
import { HostMcVolt } from "./engine/HostMcVolt";
import { AvatarBuilder, COSMETICS } from "./engine/AvatarBuilder";
import { ChiptuneSynth } from "./audio/ChiptuneSynth";
import { LocalSaveDB } from "./db/LocalSaveDB";
import {
  dailyFor, loadEntities, loadManifest, loadPack, type DailyInfo,
} from "./data";
import { Round1Top5 } from "./game/Round1Top5";
import { Round2FactOrCap } from "./game/Round2FactOrCap";
import { PITCH_MAX_CHARS, Round3Pitch } from "./game/Round3Pitch";
import { hypeCoins, tierForXp } from "./game/Progression";
import { downloadShareCardPng, shareText } from "./sharecard";
import type { ContentPack } from "@hype-riot/shared-types";
import type { ShareData } from "@hype-riot/riot-engine";

const PARTY_WS_URL =
  (import.meta as unknown as { env: Record<string, string | undefined> }).env
    .VITE_PARTY_WS_URL ?? "";

const ZOOM_COLORS: Record<string, string> = {
  ".": "#110E1B", K: "#110E1B", W: "#FFF8E7", R: "#E63946", G: "#38B000",
  Y: "#FEE440", B: "#00BBF9", P: "#FF70A6", U: "#9B5DE5", C: "#FFF8E7",
  O: "#F4A261", T: "#00F5D4", N: "#900C3F", S: "#C3B2FF",
};

type Mode = "daily" | "quick" | "blitz";
type Phase = "menu" | "r1" | "r2" | "r3" | "summary";

interface MatchState {
  mode: Mode;
  pack: ContentPack;
  seed: number;
  riotNumber: number;
  daily: DailyInfo | null;
  r1: Round1Top5 | null;
  r2: Round2FactOrCap | null;
  r3: Round3Pitch | null;
  blitzTop10: Set<number> | null;
  blitzTime: number;
  phase: Phase;
}

const app = document.getElementById("app");
if (!app) throw new Error("#app missing");

app.innerHTML = `
<header class="topbar">
  <div class="logo pxfont">HYPE RIOT</div>
  <div class="row">
    <span class="chip pxfont">RANK <b id="chip-rank">—</b></span>
    <span class="chip pxfont">XP <b id="chip-xp">0</b></span>
    <span class="chip pxfont">⬡ <b id="chip-coins">0</b> HC</span>
    <span class="chip pxfont">🔥 <b id="chip-streak">0</b> DAY STREAK</span>
  </div>
</header>
<div class="stage-wrap">
  <canvas id="stage" width="480" height="270"></canvas>
  <div class="crt-overlay" id="crt"></div>
</div>

<section class="panel" id="panel-menu">
  <div class="menu-grid">
    <div>
      <button class="primary" id="btn-daily" style="width:100%">▶ Daily Riot</button>
      <div class="mode-desc" id="daily-desc">Today's global show — same pack for everyone. 3 rounds, ~90 seconds.</div>
    </div>
    <div>
      <button id="btn-quick" style="width:100%">Quick Arcade</button>
      <div class="mode-desc">Endless solo. Random pack every run — beat 3,500 HYPE for the +25 HC victory bonus.</div>
    </div>
    <div>
      <button id="btn-blitz" style="width:100%">Brainstorm Blitz</button>
      <div class="mode-desc">Relaxed 45 seconds, one prompt: hunt down its 10 most famous answers.</div>
    </div>
    <div>
      <button id="btn-party" style="width:100%">Party Room</button>
      <div class="mode-desc">2–12 players, 4-letter room codes, live pitch voting.</div>
    </div>
    <div>
      <button id="btn-avatar" style="width:100%">Avatar Studio</button>
      <div class="mode-desc">Spend Hype Coins on pure cosmetics. Zero pay-to-win, ever.</div>
    </div>
    <div>
      <button id="btn-settings" style="width:100%">Settings</button>
      <div class="mode-desc">CRT effect, motion, font, sound.</div>
    </div>
  </div>
  <p class="note" id="dataset-line">Loading dataset…</p>
</section>

<section class="panel hidden" id="panel-game">
  <div class="score-line pxfont"><span id="round-label">ROUND 1</span> · SCORE <b id="score-now">0</b></div>
  <div class="prompt-bar" id="prompt-bar"></div>
  <div class="timer-track"><div class="timer-fill" id="timer-fill" style="width:100%"></div></div>
  <div id="round-ui"></div>
  <div class="feedback" id="feedback"></div>
  <div class="found-list" id="found-list"></div>
  <div class="row" style="margin-top:10px">
    <button class="small" id="btn-quit">✕ Quit to menu</button>
  </div>
</section>

<section class="panel hidden" id="panel-summary">
  <h2 class="pxfont" style="color:var(--gold);font-size:15px">MATCH COMPLETE</h2>
  <div class="summary-grid" id="summary-grid"></div>
  <p class="note" id="summary-note"></p>
  <pre class="share-text" id="share-text"></pre>
  <div class="row">
    <button class="small primary" id="btn-copy-share">Copy share card</button>
    <button class="small" id="btn-png-share">Download PNG card</button>
    <button class="small" id="btn-again">Play again</button>
    <button class="small" id="btn-menu2">Menu</button>
  </div>
</section>

<section class="panel hidden" id="panel-avatar">
  <h2 class="pxfont" style="font-size:13px;color:var(--gold)">AVATAR STUDIO</h2>
  <p class="note">Cosmetics only — they never change gameplay. Balance: <b id="avatar-coins">0</b> HC</p>
  <div id="avatar-slots"></div>
  <div class="row" style="margin-top:10px"><button class="small" id="btn-menu3">← Menu</button></div>
</section>

<section class="panel hidden" id="panel-settings">
  <h2 class="pxfont" style="font-size:13px;color:var(--gold)">SETTINGS</h2>
  <label class="setting">CRT scanlines
    <select id="set-crt">
      <option value="off">Off</option>
      <option value="subtle">Subtle 15%</option>
      <option value="arcade">Arcade 35%</option>
    </select>
  </label>
  <label class="setting">Reduce motion (no shake / flash / parallax)
    <input type="checkbox" id="set-motion" /></label>
  <label class="setting">Legible font (Inter instead of pixel)
    <input type="checkbox" id="set-font" /></label>
  <label class="setting">Sound
    <input type="checkbox" id="set-sound" /></label>
  <div class="row" style="margin-top:10px"><button class="small" id="btn-menu4">← Menu</button></div>
</section>

<section class="panel hidden" id="panel-party">
  <h2 class="pxfont" style="font-size:13px;color:var(--gold)">PARTY ROOM</h2>
  <p class="note" id="party-status"></p>
  <div class="row">
    <input type="text" id="party-name" placeholder="Your name" maxlength="12" />
  </div>
  <div class="row" style="margin-top:8px">
    <button class="small primary" id="btn-create-room">Create room</button>
    <input type="text" id="party-code" placeholder="CODE" maxlength="4" style="max-width:110px;text-transform:uppercase" />
    <button class="small" id="btn-join-room">Join room</button>
  </div>
  <p class="note">Party rooms run on a live WebSocket relay (Cloudflare Durable
  Objects, packages/party-worker). Solo modes need no backend and are fully playable.</p>
  <div class="row" style="margin-top:10px"><button class="small" id="btn-menu5">← Menu</button></div>
</section>
`;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const db = new LocalSaveDB();
const synth = new ChiptuneSynth();
const canvas = $("stage") as unknown as HTMLCanvasElement;
const renderer = new Renderer(canvas);
const crowd = new CrowdSystem();
const volt = new HostMcVolt();
const avatar = new AvatarBuilder();

let manifestPacks = 0;
let entityCount = 0;
let themeIndex = 0;
let match: MatchState | null = null;
let lastSummary: ShareData | null = null;
let lastMode: Mode = "daily";
let r2FlashUntil = 0;

function applySettings(): void {
  const s = db.get().settings;
  const crt = $("crt");
  crt.className = "crt-overlay" + (s.crt === "subtle" ? " crt-subtle" : s.crt === "arcade" ? " crt-arcade" : "");
  document.body.classList.toggle("legible", s.legibleFont);
  renderer.reducedMotion = s.reducedMotion;
  synth.enabled = s.sound;
  ($("set-crt") as HTMLSelectElement).value = s.crt;
  ($("set-motion") as HTMLInputElement).checked = s.reducedMotion;
  ($("set-font") as HTMLInputElement).checked = s.legibleFont;
  ($("set-sound") as HTMLInputElement).checked = s.sound;
}

function refreshChips(): void {
  const save = db.get();
  $("chip-rank").textContent = tierForXp(save.xp);
  $("chip-xp").textContent = String(save.xp);
  $("chip-coins").textContent = String(save.coins);
  $("chip-streak").textContent = String(save.dailyStreak);
}

function showPanel(id: string): void {
  for (const p of ["panel-menu", "panel-game", "panel-summary", "panel-avatar", "panel-settings", "panel-party"]) {
    $(p).classList.toggle("hidden", p !== id);
  }
}

// ---------- match flow ----------

function setFeedback(text: string, color = "var(--gold)"): void {
  const el = $("feedback");
  el.textContent = text;
  el.style.color = color;
}

function totalScore(): number {
  if (!match) return 0;
  return (match.r1?.score ?? 0) + (match.r2?.score ?? 0) + (match.r3?.result?.total ?? 0);
}

function startMatch(mode: Mode): void {
  void (async () => {
    const today = dailyFor(new Date(), manifestPacks);
    let packId: number;
    let seed: number;
    let riotNumber: number;
    let daily: DailyInfo | null = null;
    if (mode === "daily") {
      packId = today.packId;
      seed = today.seed;
      riotNumber = today.riotNumber;
      themeIndex = today.arenaTheme;
      daily = today;
    } else {
      packId = Math.floor(Math.random() * manifestPacks);
      seed = today.seed;
      riotNumber = today.riotNumber;
      themeIndex = Math.floor(Math.random() * ARENA_THEMES.length);
    }
    const pack = await loadPack(packId);
    renderer.startTransition(ARENA_THEMES[themeIndex].skyTop);
    match = {
      mode, pack, seed, riotNumber, daily,
      r1: new Round1Top5(pack.round1),
      r2: null, r3: null,
      blitzTop10: mode === "blitz"
        ? new Set(pack.round1.answers.slice(0, 10).map((a) => a.entityId))
        : null,
      blitzTime: 45,
      phase: "r1",
    };
    if (mode === "blitz" && match.r1) match.r1.timeLeft = 45;
    lastMode = mode;
    showPanel("panel-game");
    $("score-now").textContent = "0";
    $("found-list").innerHTML = "";
    renderR1();
    volt.setState("IDLE_TALK");
    crowd.react("glowstick", 0.4);
  })();
}

function renderR1(): void {
  if (!match?.r1) return;
  const p = match.pack.round1;
  $("round-label").textContent =
    match.mode === "blitz" ? "BRAINSTORM BLITZ" : "ROUND 1 — TOP 5 RIOT";
  $("prompt-bar").innerHTML =
    `${p.text}<br><span class="combo pxfont" style="font-size:10px">COMBO TAG: ${p.comboTag.label} = 2X HYPE</span>` +
    (match.blitzTop10 ? `<br><span class="combo pxfont" style="font-size:10px">FIND THE TOP 10 MOST FAMOUS</span>` : "");
  $("round-ui").innerHTML = `
    <form class="row" id="r1-form">
      <input type="text" id="r1-input" placeholder="Type an answer and hit ENTER…" autocomplete="off" />
      <button class="primary" type="submit">HIT IT</button>
    </form>`;
  const input = $("r1-input") as HTMLInputElement;
  input.focus();
  ($("r1-form") as HTMLFormElement).addEventListener("submit", (ev) => {
    ev.preventDefault();
    submitR1(input.value);
    input.value = "";
    input.focus();
  });
}

function submitR1(raw: string): void {
  if (!match?.r1) return;
  const res = match.r1.submit(raw);
  if (res === "DUPLICATE") {
    setFeedback("Already on the board!", "var(--lav)");
    return;
  }
  if (!res) {
    setFeedback("The crowd shrugs… not on the board.", "var(--pink2)");
    crowd.react("gasp", 0.25);
    return;
  }
  synth.hit(res.tier === "DEEP_CUT");
  if (res.combo) synth.combo();
  renderer.floatText(240, 120, `+${res.points}`, res.combo ? "#FF2A85" : "#FEE440");
  renderer.burst(240, 130, res.tier === "DEEP_CUT" ? "#FFD166" : "#00F5D4");
  renderer.hitStop(30);
  crowd.react(res.combo ? "sign" : "jump", res.tier === "DEEP_CUT" ? 0.7 : 0.45);
  volt.setState(res.tier === "DEEP_CUT" ? "MIND_BLOWN" : "IDLE_TALK");
  setFeedback(
    res.combo
      ? `⚡ COMBO! ${res.name} — ${res.points} HYPE`
      : `${res.name} — +${res.points} HYPE${res.tier === "DEEP_CUT" ? " (DEEP CUT!)" : ""}`,
  );
  const chip = document.createElement("span");
  chip.className = "found-item" + (res.combo ? " combo" : res.tier === "DEEP_CUT" ? " deep" : "");
  chip.textContent = `${res.name} +${res.points}`;
  $("found-list").appendChild(chip);
  if (match.blitzTop10 && match.r1) {
    const foundTop = [...match.blitzTop10].filter((id) =>
      match!.r1!.hits.some((h) => match!.pack.round1.answers.find((a) => a.name === h.name)?.entityId === id),
    ).length;
    setFeedback(`Top-10 found: ${foundTop}/10 — ${res.name} +${res.points}`);
    if (foundTop >= 10) finishMatch();
  }
}

function advanceToR2(): void {
  if (!match) return;
  match.phase = "r2";
  match.r2 = new Round2FactOrCap(match.pack.round2);
  $("found-list").innerHTML = "";
  volt.setState("FIRE_SUNGLASSES");
  renderR2Card();
}

function renderR2Card(): void {
  if (!match?.r2) return;
  const card = match.r2.current;
  $("round-label").textContent = "ROUND 2 — FACT OR CAP?!";
  if (!card) return;
  const streak = match.r2.streak;
  $("prompt-bar").innerHTML =
    `Question ${match.r2.index + 1} / 4` +
    (streak >= 2 ? ` · <span class="streak-fire pxfont" style="font-size:10px">🔥 ${streak} STREAK x${streak >= 3 ? "2.0" : "1.5"}</span>` : "");
  const ui = $("round-ui");
  if (card.type === "CLAIM") {
    ui.innerHTML = `
      <div class="card-claim">“${card.claim}”</div>
      <div class="big-buttons">
        <button class="fact" id="btn-fact">✓ FACT</button>
        <button class="cap" id="btn-cap">✕ CAP</button>
      </div>`;
    $("btn-fact").addEventListener("click", () => answerR2(() => match!.r2!.answerClaim(true)));
    $("btn-cap").addEventListener("click", () => answerR2(() => match!.r2!.answerClaim(false)));
  } else if (card.type === "CLASH") {
    ui.innerHTML = `
      <div class="card-claim">${card.question}</div>
      <div class="big-buttons">
        <button id="btn-a">${card.a}</button>
        <button id="btn-b">${card.b}</button>
      </div>`;
    $("btn-a").addEventListener("click", () => answerR2(() => match!.r2!.answerClash("A")));
    $("btn-b").addEventListener("click", () => answerR2(() => match!.r2!.answerClash("B")));
  } else {
    ui.innerHTML = `
      <div class="row">
        <canvas id="zoomCanvas" width="160" height="160"></canvas>
        <div style="flex:1;min-width:180px">
          <div class="card-claim" style="margin-top:0">What is this sprite?</div>
          <div class="menu-grid" style="grid-template-columns:1fr 1fr">
            ${card.options.map((o) => `<button class="small zoom-opt" data-opt="${o.replace(/"/g, "&quot;")}">${o}</button>`).join("")}
          </div>
        </div>
      </div>`;
    ui.querySelectorAll(".zoom-opt").forEach((b) =>
      b.addEventListener("click", () =>
        answerR2(() => match!.r2!.answerZoom((b as HTMLElement).dataset.opt ?? "")),
      ),
    );
    drawZoom();
  }
}

function drawZoom(): void {
  if (!match?.r2) return;
  const card = match.r2.current;
  const zc = document.getElementById("zoomCanvas") as HTMLCanvasElement | null;
  if (!card || card.type !== "ZOOM" || !zc) return;
  const ctx = zc.getContext("2d");
  if (!ctx) return;
  const reveal = match.r2.zoomReveal; // 0..1 over the 7s window
  const res = reveal < 0.25 ? 4 : reveal < 0.5 ? 6 : reveal < 0.7 ? 8 : reveal < 0.88 ? 12 : 16;
  const cell = 160 / res;
  ctx.fillStyle = "#110E1B";
  ctx.fillRect(0, 0, 160, 160);
  for (let by = 0; by < res; by++) {
    for (let bx = 0; bx < res; bx++) {
      const srcR = Math.min(15, Math.floor(((by + 0.5) / res) * 16));
      const srcC = Math.min(15, Math.floor(((bx + 0.5) / res) * 16));
      const ch = card.bitmap[srcR][srcC];
      ctx.fillStyle = ZOOM_COLORS[ch] ?? "#110E1B";
      ctx.fillRect(bx * cell, by * cell, cell, cell);
    }
  }
}

function answerR2(fn: () => { correct: boolean; points: number } | null): void {
  if (!match?.r2) return;
  const res = fn();
  if (!res) return;
  const card = match.r2.results[match.r2.results.length - 1]?.card;
  let truth = "";
  if (card?.type === "CLAIM") truth = card.isFact ? "It was FACT." : "It was CAP.";
  if (card?.type === "CLASH") truth = `More: ${card.aValue >= card.bValue ? card.a : card.b} (${Math.max(card.aValue, card.bValue)}${card.unit}).`;
  if (card?.type === "ZOOM") truth = `It was ${card.answer}.`;
  if (res.correct) {
    synth.correct();
    crowd.react("jump", 0.55);
    volt.setState("VICTORY_SPIN");
    renderer.floatText(240, 120, `+${res.points}`, "#A8FF35");
    setFeedback(`✓ CORRECT +${res.points} — ${truth}`, "var(--lime)");
  } else {
    synth.wrong();
    crowd.react("tomato", 0.4);
    volt.setState("WRONG_BUZZER");
    renderer.shake(4, 0.18);
    setFeedback(`✕ WRONG — ${truth}`, "var(--pink2)");
  }
  if (match.r2.finished) advanceToR3();
  else renderR2Card();
}

function advanceToR3(): void {
  if (!match) return;
  match.phase = "r3";
  match.r3 = new Round3Pitch(match.pack.round3, match.seed);
  $("found-list").innerHTML = "";
  $("round-label").textContent = "ROUND 3 — THE ULTIMATE PITCH";
  $("prompt-bar").innerHTML = match.r3.promptText;
  $("round-ui").innerHTML = `
    <textarea id="pitch-input" maxlength="${PITCH_MAX_CHARS}" placeholder="Your one-line pitch — name BOTH wildcards and an action verb!"></textarea>
    <div class="char-count"><span id="pitch-count">0</span>/${PITCH_MAX_CHARS}</div>
    <button class="primary" id="btn-pitch" style="width:100%">DROP THE PITCH</button>`;
  const ta = $("pitch-input") as HTMLTextAreaElement;
  ta.focus();
  ta.addEventListener("input", () => {
    $("pitch-count").textContent = String(ta.value.length);
  });
  $("btn-pitch").addEventListener("click", () => submitPitch(ta.value));
  setFeedback("250 per wildcard named · +150 action verb · too short costs points!");
}

function submitPitch(text: string): void {
  if (!match?.r3 || (match.r3.finished && match.r3.result)) return;
  const m = match;
  const res = match.r3.submit(text);
  synth.pitchReveal();
  crowd.react(res.total >= 600 ? "sign" : "glowstick", res.total >= 600 ? 0.8 : 0.4);
  volt.setState(res.total >= 600 ? "HYPER_MIC_DROP" : "LAUGHING_FIT");
  setFeedback(
    `PITCH SCORE ${res.total} — wildcards ${res.wildcard1 ? "✓" : "✕"}/${res.wildcard2 ? "✓" : "✕"}` +
    ` · verb ${res.actionVerb ? `✓ (${res.actionVerbMatched})` : "✕"} · length ${res.lengthPenalty} · crowd +${res.crowdVariance}`,
  );
  setTimeout(() => { if (match === m) finishMatch(); }, 1600);
}

function finishMatch(): void {
  if (!match) return;
  match.phase = "summary";
  const r1 = match.r1?.score ?? 0;
  const r2 = match.r2?.score ?? 0;
  const r3 = match.r3?.result?.total ?? 0;
  const total = r1 + r2 + r3;
  const save = db.get();
  let streak = save.dailyStreak;
  if (match.mode === "daily" && match.daily) {
    streak = db.recordDaily(match.daily.date);
  }
  const victory =
    (match.mode === "quick" && total >= 3500) ||
    (match.mode === "blitz" && match.blitzTop10 !== null && match.r1 !== null &&
      [...match.blitzTop10].every((id) =>
        match!.r1!.hits.some((h) => match!.pack.round1.answers.find((a) => a.name === h.name)?.entityId === id),
      ));
  const coins = hypeCoins(Math.max(0, total), streak, victory ? 25 : 0);
  db.update({
    xp: save.xp + Math.max(0, total),
    coins: save.coins + coins,
    bestScore: Math.max(save.bestScore, total),
    gamesPlayed: save.gamesPlayed + 1,
  });
  const data: ShareData = {
    riotNumber: match.riotNumber,
    totalScore: total,
    round1Score: r1,
    round1Hits: match.r1?.hits.length ?? 0,
    round1Slots: 5,
    round2Score: r2,
    round2Correct: match.r2?.results.filter((x) => x.correct).length ?? 0,
    round3Score: r3,
    round3Crown: r3 >= 600,
    rankTitle: tierForXp(db.get().xp),
  };
  lastSummary = data;
  $("summary-grid").innerHTML = `
    <div class="summary-cell"><div class="pxfont" style="font-size:9px">TOTAL HYPE</div><div class="v pxfont">${total.toLocaleString()}</div></div>
    <div class="summary-cell"><div class="pxfont" style="font-size:9px">ROUND 1</div><div class="v pxfont">${r1.toLocaleString()}</div></div>
    <div class="summary-cell"><div class="pxfont" style="font-size:9px">ROUND 2</div><div class="v pxfont">${r2.toLocaleString()}</div></div>
    <div class="summary-cell"><div class="pxfont" style="font-size:9px">ROUND 3</div><div class="v pxfont">${r3.toLocaleString()}</div></div>
    <div class="summary-cell"><div class="pxfont" style="font-size:9px">HYPE COINS</div><div class="v pxfont">+${coins} HC</div></div>
    <div class="summary-cell"><div class="pxfont" style="font-size:9px">RANK</div><div class="v pxfont" style="font-size:13px">${data.rankTitle}</div></div>`;
  $("summary-note").textContent =
    match.mode === "blitz"
      ? "Brainstorm Blitz complete — one prompt, top-10 hunt."
      : `Crowd reaction: ${total >= 5000 ? "STANDING OVATION — the arena is shaking!" : total >= 3000 ? "The crowd is ELECTRIC!" : total >= 1500 ? "A warm crowd — they want more." : "Tough crowd tonight. Run it back!"}`;
  $("share-text").textContent = shareText(data);
  showPanel("panel-summary");
  volt.setState("VICTORY_SPIN");
  crowd.react("jump", 0.9);
  synth.fanfare();
  refreshChips();
  match = null;
}

// ---------- avatar / settings / party panels ----------

function renderAvatarPanel(): void {
  const save = db.get();
  $("avatar-coins").textContent = String(save.coins);
  const owned = (id: string, cost: number) => cost === 0 || save.unlocked.includes(id);
  const slots: Array<["hoodie" | "visor" | "sneakers" | "pet" | "dance", string]> = [
    ["hoodie", "HOODIES"], ["visor", "VISORS"], ["sneakers", "SNEAKERS"], ["pet", "PIXEL PETS"], ["dance", "VICTORY DANCES"],
  ];
  $("avatar-slots").innerHTML = slots.map(([slot, label]) => `
    <h3 class="pxfont" style="font-size:10px;color:var(--lav)">${label}</h3>
    <div class="cosmetic-grid">
      ${COSMETICS.filter((c) => c.slot === slot).map((c) => {
        const isOwned = owned(c.id, c.cost);
        const isEquipped = save.equipped[slot] === c.id;
        return `<div class="cosmetic ${isEquipped ? "equipped" : ""}">
          ${c.color ? `<div class="swatch" style="background:${c.color}"></div>` : ""}
          <div>${c.name}</div>
          <div style="color:var(--lav)">${isOwned ? "OWNED" : `${c.cost} HC`}</div>
          <button class="small" data-slot="${slot}" data-id="${c.id}" ${isEquipped ? "disabled" : ""}>
            ${isEquipped ? "EQUIPPED" : isOwned ? "EQUIP" : "BUY"}</button>
        </div>`;
      }).join("")}
    </div>`).join("");
  $("avatar-slots").querySelectorAll("button[data-slot]").forEach((b) => {
    b.addEventListener("click", () => {
      const el = b as HTMLElement;
      const slot = el.dataset.slot as keyof SaveData["equipped"];
      const id = el.dataset.id ?? "";
      const item = COSMETICS.find((c) => c.slot === slot && c.id === id);
      if (!item) return;
      const s = db.get();
      if (!owned(id, item.cost)) {
        if (s.coins < item.cost) { setFeedback("Not enough Hype Coins!"); return; }
        db.update({
          coins: s.coins - item.cost,
          unlocked: [...s.unlocked, id],
          equipped: { ...s.equipped, [slot]: id },
        });
      } else {
        db.update({ equipped: { ...s.equipped, [slot]: id } });
      }
      refreshChips();
      renderAvatarPanel();
    });
  });
}

type SaveData = ReturnType<LocalSaveDB["get"]>;

// ---------- render loop ----------

let lastTs = 0;
let secondAcc = 0;

function drawScene(dt: number): void {
  const theme = ARENA_THEMES[themeIndex];
  renderer.gradient(theme.skyTop, theme.skyBottom);
  if (themeIndex === 4) {
    // Orbital Space Lounge stars (deterministic)
    for (let i = 0; i < 40; i++) {
      const x = (i * 67) % 480;
      const y = (i * 37) % 110;
      renderer.rect(x, y, 2, 2, "#FFF8E7");
    }
  }
  // jumbotron
  renderer.rect(88, 14, 304, 62, "#110E1B");
  renderer.rect(88, 14, 304, 3, theme.accent);
  renderer.rect(88, 73, 304, 3, theme.accent);
  const title = match
    ? match.phase === "r1" ? (match.mode === "blitz" ? "BRAINSTORM BLITZ" : "ROUND 1: TOP 5 RIOT")
      : match.phase === "r2" ? "ROUND 2: FACT OR CAP?!" : "ROUND 3: THE PITCH"
    : "HYPE RIOT";
  renderer.text(title, 240, 24, theme.accent, 10, "center");
  renderer.text(
    match ? `SCORE ${totalScore().toLocaleString()}` : theme.name.toUpperCase().slice(0, 34),
    240, 44, "#FFF8E7", 8, "center",
  );
  if (match) {
    const tl = match.phase === "r1" ? (match.r1?.timeLeft ?? 0)
      : match.phase === "r2" ? (match.r2 ? (match.r2.cards.length - match.r2.index - 1) * 7 + match.r2.cardTimeLeft : 0)
      : (match.r3?.timeLeft ?? 0);
    const max = match.phase === "r1" ? (match.mode === "blitz" ? 45 : 25) : match.phase === "r2" ? 28 : 30;
    renderer.rect(98, 62, 284, 5, "#3A2F5B");
    renderer.rect(98, 62, Math.max(0, (tl / max) * 284), 5, tl <= 5 ? "#E63946" : "#00F5D4");
  }
  // stage floor + crowd pit
  renderer.rect(0, 188, 480, 82, theme.stage);
  renderer.rect(0, 188, 480, 3, theme.accent);
  crowd.update(dt);
  crowd.draw(renderer);
  volt.update(dt);
  volt.draw(renderer, 26, 118);
  avatar.draw(renderer, 408, 120, db.get().equipped, performance.now() / 1000);
  renderer.postFrame(dt);
}

function loop(ts: number): void {
  const dt = Math.min(0.05, lastTs ? (ts - lastTs) / 1000 : 0.016);
  lastTs = ts;
  if (match && !renderer.frozen) {
    if (match.phase === "r1" && match.r1) {
      match.r1.tick(dt);
      $("score-now").textContent = String(totalScore());
      const tl = match.r1.timeLeft;
      const fill = $("timer-fill");
      fill.style.width = `${(tl / (match.mode === "blitz" ? 45 : 25)) * 100}%`;
      fill.classList.toggle("low", tl <= 5);
      secondAcc += dt;
      if (tl <= 5.05 && secondAcc >= 1) { secondAcc = 0; synth.tick(); }
      if (match.r1.finished) {
        if (match.mode === "blitz") finishMatch();
        else advanceToR2();
      }
    } else if (match.phase === "r2" && match.r2) {
      const timeoutRes = match.r2.tick(dt);
      $("score-now").textContent = String(totalScore());
      const fill = $("timer-fill");
      fill.style.width = `${(match.r2.cardTimeLeft / 7) * 100}%`;
      fill.classList.toggle("low", match.r2.cardTimeLeft <= 2);
      if (timeoutRes) {
        synth.wrong();
        crowd.react("tomato", 0.35);
        setFeedback("⏰ TIME UP — streak gone!", "var(--pink2)");
        if (match.r2.finished) advanceToR3();
        else renderR2Card();
      } else if (match.r2.current?.type === "ZOOM") {
        drawZoom();
      }
    } else if (match.phase === "r3" && match.r3) {
      match.r3.tick(dt);
      $("score-now").textContent = String(totalScore());
      const fill = $("timer-fill");
      fill.style.width = `${(match.r3.timeLeft / 30) * 100}%`;
      fill.classList.toggle("low", match.r3.timeLeft <= 5);
      if (match.r3.finished && !match.r3.result) {
        const ta = $("pitch-input") as HTMLTextAreaElement | null;
        submitPitch(ta?.value ?? "");
      }
    }
  }
  drawScene(dt);
  requestAnimationFrame(loop);
}

// ---------- wiring + boot ----------

$("btn-daily").addEventListener("click", () => startMatch("daily"));
$("btn-quick").addEventListener("click", () => startMatch("quick"));
$("btn-blitz").addEventListener("click", () => startMatch("blitz"));
$("btn-party").addEventListener("click", () => {
  const status = $("party-status");
  if (PARTY_WS_URL) {
    status.textContent = `Relay configured: ${PARTY_WS_URL}`;
  } else {
    status.textContent =
      "⚠ Party relay NOT deployed yet — this mode needs the Cloudflare Durable Objects backend (packages/party-worker) on the owner's Cloudflare account. Create/Join stay disabled until a relay URL is configured (VITE_PARTY_WS_URL). Solo modes are fully playable.";
    ($("btn-create-room") as HTMLButtonElement).disabled = true;
    ($("btn-join-room") as HTMLButtonElement).disabled = true;
  }
  showPanel("panel-party");
});
$("btn-avatar").addEventListener("click", () => { renderAvatarPanel(); showPanel("panel-avatar"); });
$("btn-settings").addEventListener("click", () => showPanel("panel-settings"));
for (const id of ["btn-menu2", "btn-menu3", "btn-menu4", "btn-menu5"]) {
  $(id).addEventListener("click", () => showPanel("panel-menu"));
}
$("btn-quit").addEventListener("click", () => {
  match = null;
  showPanel("panel-menu");
  volt.setState("IDLE_TALK");
});
$("btn-again").addEventListener("click", () => startMatch(lastMode));
$("btn-copy-share").addEventListener("click", () => {
  if (lastSummary) void navigator.clipboard?.writeText(shareText(lastSummary));
});
$("btn-png-share").addEventListener("click", () => {
  if (lastSummary) downloadShareCardPng(lastSummary);
});
($("set-crt") as HTMLSelectElement).addEventListener("change", (e) => {
  const v = (e.target as HTMLSelectElement).value as "off" | "subtle" | "arcade";
  db.update({ settings: { ...db.get().settings, crt: v } });
  applySettings();
});
($("set-motion") as HTMLInputElement).addEventListener("change", (e) => {
  db.update({ settings: { ...db.get().settings, reducedMotion: (e.target as HTMLInputElement).checked } });
  applySettings();
});
($("set-font") as HTMLInputElement).addEventListener("change", (e) => {
  db.update({ settings: { ...db.get().settings, legibleFont: (e.target as HTMLInputElement).checked } });
  applySettings();
});
($("set-sound") as HTMLInputElement).addEventListener("change", (e) => {
  db.update({ settings: { ...db.get().settings, sound: (e.target as HTMLInputElement).checked } });
  applySettings();
});

async function boot(): Promise<void> {
  applySettings();
  refreshChips();
  try {
    const manifest = await loadManifest();
    manifestPacks = manifest.packs;
    const entities = await loadEntities(manifest);
    entityCount = entities.length;
    const today = dailyFor(new Date(), manifestPacks);
    themeIndex = today.arenaTheme;
    $("dataset-line").textContent =
      `DATASET v${manifest.version}: ${entityCount.toLocaleString()} entities · ${manifest.shards} trie shards · ${manifestPacks} packs loaded. Today's arena: ${ARENA_THEMES[today.arenaTheme].name}.`;
    $("daily-desc").textContent =
      `HYPE RIOT #${String(today.riotNumber).padStart(3, "0")} — today's global show, same pack for everyone. 3 rounds, ~90 seconds.`;
  } catch (err) {
    $("dataset-line").innerHTML =
      `<span class="error">Dataset failed to load (${err instanceof Error ? err.message : "unknown error"}). The data files must sit beside the app under data/v1/.</span>`;
    for (const id of ["btn-daily", "btn-quick", "btn-blitz"]) {
      ($(id) as HTMLButtonElement).disabled = true;
    }
  }
  requestAnimationFrame(loop);
}

void boot();
