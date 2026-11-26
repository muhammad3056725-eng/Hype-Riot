# HYPE RIOT art source

Everything the game draws is vector/canvas code — there are no bitmap
sprites to edit:

- Arena, spotlights, jumbotron, crowd, particles: `apps/web/src/engine/`
  (`Renderer.ts`, `CrowdSystem.ts`, `Particles.ts`, `Shaders.ts`).
- Host MC VOLT: `apps/web/src/engine/HostMcVolt.ts`.
- Player avatar + cosmetics: `apps/web/src/engine/AvatarBuilder.ts`.
- Theme colors: `ARENA_THEMES` in `Renderer.ts` and the CSS variables in
  `apps/web/src/styles.css`.
- Favicon: `public/favicon.svg`.

`neon_32.gpl` is the palette of the retired pixel-art version (v1), kept
for reference only; the v2 renderer does not use it.
