# HYPE RIOT

The 90-second party game show: brainstorm answers, call FACT or CAP, and
pitch the wildest idea in front of a roaring crowd. Plays in any modern
browser on phones (portrait or landscape) and desktops.

**Play:** https://muhammad3056725-eng.github.io/Hype-Riot/

## The show

| Round | Time | How it works |
|---|---|---|
| 1 — TOP 5 RIOT | 25s | Type answers to the prompt (30–60 valid answers each). Crowd Pleasers (the most famous 55%) +150, Deep Cuts +250. Each prompt has a **combo tag** (e.g. "Starts with S or T", "Two words or more") that 20–40% of answers satisfy: those score 2×. Matching forgives typos (5+ letters), plurals, punctuation, accents, spacing ("spiderman"), surnames ("messi") and any significant word of a name ("whale" → the best-known whale on the board). No prefix guessing. When time runs out the round shows the top answers you missed. |
| 2 — FACT OR CAP?! | 4 × 7s | Two claims (FACT/CAP), one clash ("Which is TALLER?" / "Which came FIRST?" — winner side randomised) and one zoom-in mystery (an emoji starts extremely zoomed and blurred, then pulls back; pick 1 of 4). 400 each, streaks ×1.5 then ×2. After each card the right answer is revealed (input locked, so double-taps can't skip a card). Keys: F/C, A/B or ←/→, 1–4. |
| 3 — THE ULTIMATE PITCH | 30s | One line (≤80 chars) combining two wildcards: +250 per wildcard named (whole words, plural/hyphen-insensitive), +150 for any action verb in any form (1,192-verb dictionary + inflections), −5 per character under 30 (trimmed), + a 0–100 crowd reaction seeded by the day and your pitch text. Never below 0. 600+ = 👑 crowd favorite. Live checklist shows what you've hit. |

**Hype meter** (0–100%) rises with hits, combos and streaks, drops on
misses, wrong calls and timeouts, and drives the crowd (glowsticks,
cheer waves, boos, tomatoes). Peak hype pays a crowd bonus (5 pts per %).

**Modes**
- **Daily Riot** — one show per UTC day, the same for everyone. The schedule
  walks through all 122 packs before repeating (stride coprime with the pack
  count). One scored attempt per day; replays are practice (no coins/XP).
  Streak bonus coins (+15 per streak day) are paid once per day.
- **Quick Arcade** — random pack, random theme and a random pitch drawn from
  the full template/wildcard pools. Beat 3,500 for a +25 coin victory bonus.
- **Brainstorm Blitz** — 45 seconds on one prompt; find its 10 most famous
  answers (★ marks them). Clearing all 10 ends early and pays +25.
- **Party Room** — only shown when the build has `VITE_PARTY_WS_URL`. The
  client joins a 4-letter room on the relay in `packages/party-worker`
  (Cloudflare Durable Objects) and shows the lobby; synced party matches are
  not implemented yet. The relay is not deployed by this repo.

**Progression:** Hype Coins = floor(score/100) + victory bonus (+ streak
bonus on the first Daily of a day), spent on cosmetics only (hoodies,
visors, sneakers, holo pets, victory dances). Ranks from Rookie Spectator
(0 XP) to Hype Legend (150,000 XP). Saved in `localStorage`.

## Graphics & UI

- Full-screen hi-DPI Canvas2D arena behind a DOM HUD: themed sky and arena
  bowl (cached), sweeping additive spotlights with floor light pools, LED
  jumbotron with glow + equalizer, glossy perspective stage, a vector host
  (MC VOLT, 11 moods), the player's podium avatar with cosmetics, a
  perspective crowd of silhouettes with glowsticks/phone lights, pooled
  confetti/spark/tomato particles, screen shake, flashes, vignette.
- Performance: DPR capped at 2, adaptive quality (resolution, crowd rows,
  particle budget) when frames run slow, batched paths per row/color, cached
  glow sprites, render loop paused while the tab is hidden.
- Round timers are wall-clock deadlines, so slow frames or a hidden tab never
  stretch them.
- HUD: timer ring, score, hype meter, prompt card, answer input or choice
  buttons; fits one phone screen (portrait and landscape) and follows the
  on-screen keyboard (`visualViewport`).
- Accessibility: `aria-live` feedback, keyboard shortcuts, visible focus,
  reduced-motion setting (defaults to the OS preference), system fonts (no
  web-font CDN), graphics quality setting (Auto / High / Battery saver).

## Dataset

Hand-authored, validated text in `pipeline/corpus/data/`:

| File | Content |
|---|---|
| `prompts_a.txt` … `prompts_d.txt` | 122 Top-5 prompts, 6,414 answers (30–60 each, most famous first) with aliases |
| `claims.txt` | 260 Fact-or-Cap claims (130 fact / 130 cap), non-time-sensitive |
| `clashes.txt` | 106 clashes (stable numbers; `max` and `min` questions) |
| `zoom.txt` | 115 zoom-in mysteries (emoji + 3 distractors) |
| `templates.txt`, `wildcards.txt` | 34 pitch templates, 330 wildcards |
| `verbs.txt` | 1,192 verbs for the pitch verb bonus |

`npm run data` (or `python pipeline/run_pipeline.py`) rebuilds everything
deterministically:

1. `stage1_ingest` parses and validates (formats, answer counts, duplicates,
   alias collisions, clash gaps, zoom options, templates).
2. `stage2_filter` assigns tiers and picks each prompt's combo tag (20–40% coverage).
3. `stage3_expansion` assembles one pack per prompt (claims dealt without
   repeats, clash sides and zoom options shuffled).
4. `stage4_safety` runs the blocklist + denied-people gate (hard fail).
5. `stage5_compile` writes `public/data/v1/packs/pack_NNN.json`,
   `pitch.json`, `manifest.json` (counts, daily stride, hashes) and the
   generated verb dictionary in `packages/riot-engine/src/action-verbs*.ts`.

`make_daily.py` writes `public/data/daily/<date>.json` as a readable record;
the client computes the Daily itself from the manifest.

## Develop

```
npm ci
npm run dev        # http://localhost:5173 (serves public/ incl. data)
npm run typecheck
npm test           # engine + web (vitest) + pipeline (Python; skipped with a warning if no Python 3.9+)
npm run build      # apps/web/dist (relative base, data copied from public/)
```

## Deploy

`.github/workflows/pages.yml` (push to `main`): npm ci → rebuild dataset →
typecheck → test → build → stage data → deploy to GitHub Pages (Settings →
Pages → Source: GitHub Actions). `data-build.yml` ("Dataset check")
validates corpus changes on PRs/pushes, fails if the committed dataset is
stale, and never pushes commits; a successful run on `main` triggers a
redeploy.

## Repo layout

```
apps/web/              Vite + TS game (engine/ renderer, game/ rounds, ui/, db/, audio/)
packages/riot-engine/  text rules, AnswerMatcher, ComboTagEvaluator, PitchScorer, share text, verbs
packages/shared-types/ pack + manifest schema, party protocol
packages/party-worker/ Cloudflare Durable Object relay (not deployed)
pipeline/              corpus data + parsers, stages 1–5, daily schedule, tests
public/                favicon + compiled dataset (data/v1, data/daily)
```

### Leftovers from v1 safe to delete

These files are no longer read by anything: `pipeline/corpus/entities_cat01.py` …
`entities_cat10.py`, `pipeline/wikidata_ingest.py`, `pipeline/output/*` from
the old pipeline (`aliases.json`, `entities_*.json`, `wikidata_entities.json`),
`public/data/v1/entities.json`, `public/data/v1/trie_shards/`, and
`art-source/neon_32.gpl`.
