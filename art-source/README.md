# HYPE RIOT art source

- `neon_32.gpl` — the blueprint §3 exact 32-color neon palette (GIMP/Aseprite-importable).
- Sprites in this build are **code-drawn** (MC VOLT, the 64-member crowd,
  avatars, and the 16×16 Pixel Zoom-Out bitmaps in
  `pipeline/corpus/zoom.py`) — the same approach NEXUS RELAY shipped with.

Deviation (flagged, not hidden): the blueprint's repo layout lists
`.aseprite` source files. Aseprite is not available in this build
environment, so there are no .aseprite masters; the .gpl palette plus
the in-code pixel data are the editable sources.
