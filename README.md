# HYPE RIOT

The 90-second retro pixel-art arcade game show for teenagers: electrify a
64-character Pixel Crowd across 3 mini-rounds in a 480×270 Hi-Bit neon
arena. Game #3 on the deepwell.games hub (after Deepwell/APOGEE and
NEXUS RELAY), built exactly to its blueprint
(`HYPE_RIOT___Teen_Retro_Pixel-Art_Trivia___Brainstorming_Game_Blueprint.docx`).

**Play:** https://muhammad3056725-eng.github.io/Hype-Riot/ (once the repo
exists and Pages is enabled — see "Deploy" below).

## The show (Blueprint §2)

| Round | Time | What happens |
|---|---|---|
| 1 — TOP 5 RIOT | 25s | Rapid-fire brainstorming against a huge valid answer pool. Crowd Pleaser +150, Deep Cut +250, Wildcard Combo Tag = 2×. Slang/typo matching: `spidey` → Spider-Man, `mc` → Minecraft, `gta` → Grand Theft Auto. |
| 2 — FACT OR CAP?! | 28s (4 × 7s) | Claim Smash (FACT/CAP), Stream/Stat Clash ("Which has MORE…?"), Pixel Zoom-Out (16×16 sprite de-pixelates). Streaks: 2 in a row = 1.5×, 3+ = 2.0×. |
| 3 — THE ULTIMATE PITCH | 30s | Combine two wildcard items into one ≤80-char pitch. Solo/Daily judged by the blueprint formula: 250 per wildcard present + 150 action-verb bonus − 5/char under 30 chars + deterministic crowd variance 0–100. |

Modes: **Daily Riot** (global seed 00:00 UTC, identical worldwide, streak
tracking, sharecard) · **Quick Arcade** (endless solo, beat 3,500 for the
victory bonus) · **Brainstorm Blitz** (relaxed 45s, hunt one prompt's
top 10) · **Party Room** (2–12 players — needs the relay backend, below).

Progression: Hype Coins `floor(Hype/100) + streakDays × 15 + victoryBonus`,
spent on 100% cosmetic avatar gear (hoodies, visors, neon sneakers, pixel
pets, victory dances). Zero pay-to-win. XP tiers from Rookie Spectator
(0) to Hype Legend (150,000).

Sharecards: the blueprint's text format (🟩🟨⬜ squares, streak, crown)
plus a downloadable 1200×630 PNG card.

## Dataset (Blueprint §4, §5)

Static, zero-backend: `entities.bin` (HRD1 header + packed records +
string table), 2-letter prefix `trie_shards/*.json`, and
`packs/pack_NNN.json`, all under `public/data/v1/` with a fingerprinted
`manifest.json`. An `entities.json` text fallback ships alongside the
binary (the GitHub connector push is text-only; the loader tries `.bin`
first, then `.json`).

Pipeline (`pipeline/`): Stage 1 ingest → Stage 2 relevance/alias filter →
Stage 3 brainstorm expansion + coverage gate (every prompt ≥ 25 answers,
both tiers) → Stage 4 safety/profanity gate (hard fail) → Stage 5 binary
+ shard compiler. Run it with `python3 pipeline/run_pipeline.py`.

**Growth:** `pipeline/wikidata_ingest.py` pulls entities + aliases from
Wikidata per category (sitelinks = popularity proxy), and the
**Wikidata data build** GitHub Actions workflow (`.github/workflows/data-build.yml`)
runs it on a schedule/dispatch, rebuilds through all five stages, and
commits the enlarged dataset. Fact-or-Cap claims stay hand-authored —
Wikidata grows entities/aliases/pools, not editorial trivia facts.

**Current shipped scale (honest numbers):** 2,267 entities · 3,413 alias
forms · 324 trie shards · 30 packs · 60 claims · 20 clashes · 12 zoom
sprites · 93 pitch wildcards · 1,019 verified action verbs. The
blueprint's production targets (250,000 entities, 677 shards, 250 packs,
1,200 verbs) are the growth roadmap the Wikidata workflow walks toward —
the starter corpus is hand-authored seed data so the game is fully
playable today.

## Party rooms — backend requirement (NOT deployed)

Party mode needs a live backend; there is no honest static-only version.
The blueprint's design ships in `packages/party-worker/`: a Cloudflare
**Durable Objects** WebSocket relay (one object per 4-letter room code,
dumb broadcast pipe, ≤12 players, host client owns room state).

To enable it, the owner needs:
1. A Cloudflare account with Workers enabled (Durable Objects are
   included on the free tier in limited volume; the Workers Paid plan,
   $5/mo, is the realistic tier for public use).
2. `cd packages/party-worker && npx wrangler deploy` (wrangler.toml is
   ready; migration v1 creates the PartyRoom class).
3. A web build with `VITE_PARTY_WS_URL=wss://<deployed-worker>/room`.

Until then the Party Room screen in-game explains this and stays gated;
**all solo modes are complete without any backend.**

## Deploy

GitHub Pages from this repo (the Muse GitHub App cannot create
repositories or push workflow files — both are owner steps):

1. Create the repo (owner): github.com/new → `Hype-Riot`, public.
2. Muse pushes all code + data.
3. Owner pastes the workflow files from `.github/workflows/` (they are
   in the local project; the app cannot push them) — `pages.yml` is the
   critical one; `ci.yml`, `daily-riot.yml`, `data-build.yml` complete
   the set.
4. Repo Settings → Pages → Source: GitHub Actions. First push to `main`
   with `pages.yml` present builds, tests, stages `public/data` beside
   the app, and deploys.

Local dev: `npm install && npm run build` (dataset staged by the
workflow; locally: `cp -r public/data apps/web/dist/data`), or
`npm run dev --workspace=@hype-riot/web` with `public/data` served
alongside. Tests: `npm test` (engine + web + pipeline). Typecheck:
`npm run typecheck`.

Hosting note: the blueprint targets Cloudflare Pages + R2 at
hyperiot.gg; this build deploys to GitHub Pages instead (same static
shape, mount-agnostic relative base) because that is the owner's
existing games infrastructure (deepwell.games hub). The `_headers`
cache rules from the blueprint are documented in the workflow/README
for a future Cloudflare move; GitHub Pages sets its own caching.

## Deviations from the blueprint (flagged, never silent)

1. **entities.bin record size is 17 bytes, not 18.** The blueprint text
   says 18-byte records, but its own shipped Stage-5 compiler packs
   struct `"<IBBBIIH"` = 17 bytes. The executable spec wins; the parser
   and compiler agree and round-trip in tests.
2. **Starter corpus scale** (see honest numbers above) vs the 250k
   production corpus — the blueprint's own roadmap stages corpus
   growth over weeks; the Wikidata workflow is the growth engine.
3. **Action verbs: 1,019** verified-clean entries vs the 1,200 target.
   The check is presence-only ({0,1}) so scoring is unaffected.
4. **Tier assignment is relative per pool** (top 55% by popularity =
   Crowd Pleaser). The blueprint names the tiers but fixes no global
   threshold; relative assignment guarantees both tiers in every pool.
5. **Hosting**: GitHub Pages instead of Cloudflare Pages/R2 (above).
6. **Party relay not deployed** (above) — code complete, gated in UI.
7. **No .aseprite masters** — Aseprite is unavailable in the build
   environment; sprites are code-drawn and the palette ships as
   `art-source/neon_32.gpl` (same approach as NEXUS RELAY).
8. **Renderer**: Canvas2D with the blueprint's Bayer 4×4 dither math;
   the WebGL2 GLSL versions ship in `src/engine/Shaders.ts`. The
   480×270 logical canvas + integer upscale + `pixelated` rendering
   follow the spec either way.
9. **Persistence** uses localStorage behind the blueprint's
   `LocalSaveDB` class (the blueprint names the class, not the store).

## Repo layout (Blueprint §6)

```
apps/web/            Vite + TS game (engine, rounds, audio, db)
packages/riot-engine/  AnswerMatcher, ComboTagEvaluator, PitchScorer, ShareCardEncoder
packages/shared-types/ binary/pack/party schemas + parser + palette
packages/party-worker/ Cloudflare Durable Object relay (not deployed)
pipeline/            stages 1–5 + Wikidata ingest + tests
public/data/         compiled dataset (v1 + daily)
art-source/          neon_32.gpl palette
.github/workflows/   pages, ci, daily-riot, data-build (owner-pasted)
```
