#!/usr/bin/env python3
"""HYPE RIOT pipeline Stage 4 — safety gate (hard fail).

Scans every player-visible string — prompts, answers, aliases, claims,
clash questions/options, zoom options, pitch templates and wildcards —
against the word blocklist and the denied-people list in
corpus/safety.py. Any hit fails the build.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from corpus.safety import scan  # noqa: E402

OUT = Path(__file__).parent / "output"


def main():
    packs = json.loads((OUT / "packs.json").read_text(encoding="utf-8"))
    pitch = json.loads((OUT / "pitch.json").read_text(encoding="utf-8"))
    hits = []
    for p in packs:
        r1 = p["round1"]
        scan("prompt", r1["text"], hits)
        scan("combo", r1["comboTag"]["label"], hits)
        for a in r1["answers"]:
            scan(f"answer[{r1['id']}]", a["name"], hits)
            for al in a["aliases"]:
                scan(f"alias[{r1['id']}]", al, hits)
        for card in p["round2"]:
            if card["type"] == "CLAIM":
                scan("claim", card["claim"], hits)
            elif card["type"] == "CLASH":
                for k in ("question", "a", "b", "unit"):
                    scan("clash", card[k], hits)
            else:
                for o in card["options"]:
                    scan("zoom", o, hits)
    for t in pitch["templates"]:
        scan("template", t, hits)
    for w in pitch["wildcards"]:
        scan("wildcard", w, hits)
    if hits:
        print("[stage4] SAFETY VIOLATIONS:")
        for h in sorted(set(hits)):
            print("  -", h)
        raise SystemExit(1)
    print(f"[stage4] safety scan clean ({len(packs)} packs, {len(pitch['wildcards'])} wildcards)")


if __name__ == "__main__":
    main()
