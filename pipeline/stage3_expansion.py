#!/usr/bin/env python3
"""HYPE RIOT pipeline Stage 3 — assemble one content pack per prompt.

pack = Round 1 prompt (tiered answers + combo tag)
     + Round 2: 2 Fact-or-Cap claims, 1 Clash, 1 Zoom-in mystery (seeded order)
     + Round 3: pitch template + two wildcards

Everything is seeded (random.Random with fixed string seeds) so rebuilds
are byte-identical. Claims are dealt without repeats (2 per pack); clash
answer sides and zoom option order are randomised per pack.
"""
import json
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

OUT = Path(__file__).parent / "output"


def deal(items, seed):
    items = list(items)
    random.Random(seed).shuffle(items)
    return items


def main():
    corpus = json.loads((OUT / "prompts.json").read_text(encoding="utf-8"))
    prompts = corpus["prompts"]
    n = len(prompts)
    claims = deal(corpus["claims"], "claims")
    if len(claims) < 2 * n:
        print(f"[stage3] need {2 * n} claims for {n} packs without repeats, have {len(claims)}")
        raise SystemExit(1)
    clashes = deal(corpus["clashes"], "clashes")
    zooms = deal(corpus["zoom"], "zoom")
    templates = deal(corpus["templates"], "templates")
    wildcards = deal(corpus["wildcards"], "wildcards")

    packs = []
    for i, p in enumerate(prompts):
        rng = random.Random(f"pack:{p['slug']}")
        c1, c2 = claims[2 * i], claims[2 * i + 1]
        clash = dict(clashes[i % len(clashes)])
        if rng.random() < 0.5:  # random side for the winner
            clash["a"], clash["b"] = clash["b"], clash["a"]
            clash["aValue"], clash["bValue"] = clash["bValue"], clash["aValue"]
        z = zooms[i % len(zooms)]
        options = [z["answer"]] + z["distractors"]
        rng.shuffle(options)
        round2 = [
            {"type": "CLAIM", **c1},
            {"type": "CLAIM", **c2},
            {"type": "CLASH", **clash},
            {"type": "ZOOM", "emoji": z["emoji"], "answer": z["answer"], "options": options,
             "focusX": round(rng.uniform(0.3, 0.7), 2), "focusY": round(rng.uniform(0.3, 0.7), 2)},
        ]
        rng.shuffle(round2)
        wa = wildcards[(2 * i) % len(wildcards)]
        wb = wildcards[(2 * i + 1) % len(wildcards)]
        packs.append({
            "id": i,
            "round1": {
                "id": p["slug"],
                "text": p["text"],
                "categoryId": p["categoryId"],
                "comboTag": p["comboTag"],
                "answers": [
                    {"rank": idx, "name": a["name"], "aliases": a["aliases"], "tier": a["tier"]}
                    for idx, a in enumerate(p["answers"])
                ],
            },
            "round2": round2,
            "round3": {"template": templates[i % len(templates)], "wildcardA": wa, "wildcardB": wb},
        })
    (OUT / "packs.json").write_text(json.dumps(packs, ensure_ascii=False), encoding="utf-8")
    pitch = {"templates": corpus["templates"], "wildcards": corpus["wildcards"]}
    (OUT / "pitch.json").write_text(json.dumps(pitch, ensure_ascii=False), encoding="utf-8")
    (OUT / "verbs.json").write_text(json.dumps(corpus["verbs"]), encoding="utf-8")
    a_side = sum(1 for pk in packs for c in pk["round2"] if c["type"] == "CLASH"
                 and ((c["aValue"] > c["bValue"]) == (c["mode"] == "max")))
    print(f"[stage3] {len(packs)} packs assembled; clash winner on side A in {a_side}/{len(packs)}")


if __name__ == "__main__":
    main()
