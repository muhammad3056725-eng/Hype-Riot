// Static HUD markup. Dynamic text is always inserted with textContent or esc().

export const APP_HTML = `
<header class="topbar">
  <button class="brand" id="btn-home" aria-label="HYPE RIOT home">
    <svg viewBox="0 0 64 64" aria-hidden="true"><path d="M36 6 14 36h14l-4 22 26-34H36z"/></svg>
    <span>HYPE RIOT</span>
  </button>
  <div class="chips">
    <span class="chip" title="Rank"><b id="chip-rank">—</b></span>
    <span class="chip" title="Hype Coins">🪙 <b id="chip-coins">0</b></span>
    <span class="chip" title="Daily streak">🔥 <b id="chip-streak">0</b></span>
  </div>
</header>

<main class="screen" id="screen-menu">
  <section class="hero">
    <p class="kicker" id="menu-kicker">THE 90-SECOND GAME SHOW</p>
    <h1 class="title">HYPE <span>RIOT</span></h1>
    <p class="tagline">Name it. Call it. Pitch it. The crowd decides how loud it gets.</p>
  </section>
  <section class="modes" aria-label="Game modes">
    <button class="mode mode-daily" id="btn-daily" disabled>
      <span class="mode-icon" aria-hidden="true">📅</span>
      <span class="mode-text"><b>Daily Riot</b><small id="daily-desc">Loading today's show…</small></span>
    </button>
    <button class="mode mode-quick" id="btn-quick" disabled>
      <span class="mode-icon" aria-hidden="true">⚡</span>
      <span class="mode-text"><b>Quick Arcade</b><small>Random show, random pitch. Beat 3,500 for +25 coins.</small></span>
    </button>
    <button class="mode mode-blitz" id="btn-blitz" disabled>
      <span class="mode-icon" aria-hidden="true">🧠</span>
      <span class="mode-text"><b>Brainstorm Blitz</b><small>45 seconds, one prompt: find its 10 most famous answers.</small></span>
    </button>
    <button class="mode mode-party hidden" id="btn-party">
      <span class="mode-icon" aria-hidden="true">🎉</span>
      <span class="mode-text"><b>Party Room</b><small>Lobby for 2–12 players with a 4-letter code.</small></span>
    </button>
  </section>
  <nav class="menu-links" aria-label="More">
    <button class="link-btn" id="btn-help">How to play</button>
    <button class="link-btn" id="btn-avatar">Avatar Studio</button>
    <button class="link-btn" id="btn-settings">Settings</button>
  </nav>
  <p class="dataset-line" id="dataset-line">Loading the show…</p>
</main>

<main class="screen game hidden" id="screen-game">
  <div class="hud-top">
    <button class="icon-btn" id="btn-quit" aria-label="Quit to menu">✕</button>
    <div class="round-tag" id="round-label">ROUND 1</div>
    <div class="score-box"><span>SCORE</span><b id="score-now">0</b></div>
  </div>
  <div class="hype-meter" aria-label="Hype meter">
    <span class="hype-label">HYPE</span>
    <div class="hype-track"><i id="hype-fill"></i></div>
    <b id="hype-value">25%</b>
  </div>
  <div class="stage-spacer"></div>
  <section class="prompt-card" id="prompt-card">
    <div class="timer-ring" id="timer-ring" aria-hidden="true">
      <svg viewBox="0 0 64 64"><circle class="ring-bg" cx="32" cy="32" r="27"/><circle class="ring-fg" id="ring-fg" cx="32" cy="32" r="27"/></svg>
      <b id="timer-num">25</b>
    </div>
    <div class="prompt-body">
      <div class="prompt-meta" id="prompt-meta"></div>
      <div class="prompt-text" id="prompt-text"></div>
      <div class="prompt-sub" id="prompt-sub"></div>
    </div>
  </section>
  <div class="found-list" id="found-list" aria-label="Answers found"></div>
  <div class="feedback" id="feedback" role="status" aria-live="polite"></div>
  <div class="round-ui" id="round-ui"></div>
</main>

<main class="screen panel-screen hidden" id="screen-summary">
  <section class="panel summary">
    <p class="kicker" id="summary-kicker">SHOW COMPLETE</p>
    <div class="summary-total"><b id="summary-total">0</b><span>HYPE POINTS</span></div>
    <p class="summary-note" id="summary-note"></p>
    <div class="summary-grid" id="summary-grid"></div>
    <div class="rank-progress"><span id="rank-label"></span><div class="rank-track"><i id="rank-fill"></i></div></div>
    <pre class="share-text" id="share-text"></pre>
    <div class="btn-row">
      <button class="btn primary" id="btn-share">Share</button>
      <button class="btn" id="btn-png-share">Download card</button>
      <button class="btn" id="btn-again">Play again</button>
      <button class="btn ghost" id="btn-menu-summary">Menu</button>
    </div>
  </section>
</main>

<main class="screen panel-screen hidden" id="screen-avatar">
  <section class="panel">
    <div class="panel-head"><h2>Avatar Studio</h2><button class="icon-btn" data-back aria-label="Back to menu">✕</button></div>
    <p class="note">Cosmetics only — they never change scoring. Balance: <b id="avatar-coins">0</b> 🪙</p>
    <p class="note warn" id="avatar-msg" role="status" aria-live="polite"></p>
    <div id="avatar-slots"></div>
  </section>
</main>

<main class="screen panel-screen hidden" id="screen-settings">
  <section class="panel">
    <div class="panel-head"><h2>Settings</h2><button class="icon-btn" data-back aria-label="Back to menu">✕</button></div>
    <label class="setting"><span>Sound</span><input type="checkbox" id="set-sound" /></label>
    <label class="setting"><span>Reduce motion <small>(no shake, flashes, sweeping lights)</small></span><input type="checkbox" id="set-motion" /></label>
    <label class="setting"><span>Graphics</span>
      <select id="set-quality">
        <option value="auto">Auto (adapts to your device)</option>
        <option value="high">High</option>
        <option value="low">Battery saver</option>
      </select>
    </label>
  </section>
</main>

<main class="screen panel-screen hidden" id="screen-help">
  <section class="panel help">
    <div class="panel-head"><h2>How to play</h2><button class="icon-btn" data-back aria-label="Back to menu">✕</button></div>
    <h3>Round 1 · Top 5 Riot <small>25s</small></h3>
    <p>Type as many answers to the prompt as you can. Famous answers (Crowd Pleasers) are worth 150, rarer Deep Cuts 250. Answers that match the <b>combo tag</b> score double. Typos, plurals and surnames are forgiven.</p>
    <h3>Round 2 · Fact or Cap?! <small>4 × 7s</small></h3>
    <p>Call each claim FACT or CAP, pick the winner of a head-to-head clash, and name the mystery emoji as it zooms out. 400 each; streaks pay ×1.5 then ×2. Keys: F / C, A / B, 1–4.</p>
    <h3>Round 3 · The Pitch <small>30s</small></h3>
    <p>Pitch one line (max 80 characters) that names both wildcards (+250 each) and uses an action verb (+150). Under 30 characters costs points. The crowd adds 0–100.</p>
    <h3>Hype meter</h3>
    <p>Hits, combos and streaks pump the crowd; misses cool it. Your peak hype pays a crowd bonus at the end.</p>
    <h3>Modes</h3>
    <p><b>Daily Riot</b>: one scored attempt per day, same show worldwide, streak bonus coins. Replays are practice. <b>Quick Arcade</b>: any show, any time. <b>Brainstorm Blitz</b>: 45 seconds to find a prompt's 10 most famous answers.</p>
  </section>
</main>

<main class="screen panel-screen hidden" id="screen-party">
  <section class="panel">
    <div class="panel-head"><h2>Party Room</h2><button class="icon-btn" data-back aria-label="Back to menu">✕</button></div>
    <p class="note" id="party-status">Create a room or join one with its 4-letter code.</p>
    <div class="party-form">
      <input type="text" id="party-name" placeholder="Your name" maxlength="12" autocomplete="nickname" aria-label="Your name" />
      <button class="btn primary" id="btn-create-room">Create room</button>
      <input type="text" id="party-code" placeholder="CODE" maxlength="4" autocomplete="off" aria-label="Room code" />
      <button class="btn" id="btn-join-room">Join</button>
    </div>
    <ul class="party-lobby" id="party-lobby" aria-label="Players in the room"></ul>
  </section>
</main>

<div class="splash hidden" id="splash" role="dialog" aria-modal="true" aria-labelledby="splash-title">
  <div class="splash-inner">
    <p class="splash-kicker" id="splash-kicker"></p>
    <h2 class="splash-title" id="splash-title"></h2>
    <p class="splash-sub" id="splash-sub"></p>
    <div class="splash-body" id="splash-body"></div>
    <button class="btn primary hidden" id="splash-continue">Continue ▸</button>
  </div>
</div>
<div class="toast" id="toast" role="status" aria-live="polite"></div>
`;
