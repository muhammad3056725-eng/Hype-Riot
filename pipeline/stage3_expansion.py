#!/usr/bin/env python3
"""
HYPE RIOT pipeline Stage 3 — brainstorm expansion & coverage check
(Blueprint §5): every prompt must resolve >= 25 valid answers with
both hit tiers present; then content packs are compiled (one pack =
1 brainstorm prompt + 4 Round 2 cards + 1 pitch setup).

Tier assignment: the blueprint names the tiers (Crowd Pleaser /
Deep Cut) but never fixes a global popularity threshold. Stage 3
assigns tiers RELATIVE to each pool — top 55% by popularity are
Crowd Pleasers, the rest Deep Cuts — so every pool mixes both,
which is the gameplay intent (niche flexes inside any topic).
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from corpus.prompts import PROMPTS  # noqa: E402
from corpus.cards import CLAIMS, CLASHES, WILDCARDS, PITCH_TEMPLATES  # noqa: E402
from corpus.zoom import ZOOM_ITEMS  # noqa: E402
from stage2_filter import normalize  # noqa: E402

OUT = Path(__file__).parent / "output"
MIN_ANSWERS = 25
MIN_PER_TIER = 4


def main():
    entities = json.loads((OUT / "entities_filtered.json").read_text(encoding="utf-8"))
    by_norm_name = {}
    for e in entities:
        by_norm_name.setdefault(normalize(e["name"]), e)

    packs = []
    problems = []
    for i, (pid, text, cat_id, combo, answer_names) in enumerate(PROMPTS):
        answers = []
        seen = set()
        for name in answer_names:
            e = by_norm_name.get(normalize(name))
            if e is None:
                problems.append(f"{pid}: answer not in corpus: {name!r}")
                continue
            if e["id"] in seen:
                continue
            seen.add(e["id"])
            answers.append({
                "entityId": e["id"],
                "name": e["name"],
                "tier": "DEEP_CUT",  # reassigned relatively below
                "aliases": [a for a in e["aliases"]],
                "_pop": e["popularity_score"],
                "_era": e["era_decade"],
                "_tags": e["tag_bitmask"],
            })
        # Relative tier split: top 55% by popularity = CROWD_PLEASER.
        answers.sort(key=lambda a: -a["_pop"])
        cut = (len(answers) * 55 + 99) // 100
        for idx, a in enumerate(answers):
            a["tier"] = "CROWD_PLEASER" if idx < cut else "DEEP_CUT"
        tiers = {t: sum(1 for a in answers if a["tier"] == t)
                 for t in ("CROWD_PLEASER", "DEEP_CUT")}
        if len(answers) < MIN_ANSWERS:
            problems.append(f"{pid}: only {len(answers)} answers (< {MIN_ANSWERS})")
        if tiers["CROWD_PLEASER"] < MIN_PER_TIER or tiers["DEEP_CUT"] < MIN_PER_TIER:
            problems.append(f"{pid}: tier split too thin: {tiers}")

        # Round 2: CLAIM, CLASH, CLAIM, ZOOM — rotating deterministically.
        claim1 = CLAIMS[(2 * i) % len(CLAIMS)]
        claim2 = CLAIMS[(2 * i + 1) % len(CLAIMS)]
        clash = CLASHES[i % len(CLASHES)]
        zoom_ans, zoom_cat, zoom_dist, zoom_bm = ZOOM_ITEMS[i % len(ZOOM_ITEMS)]
        options = sorted([zoom_ans] + zoom_dist, key=lambda s: (len(s), s))
        round2 = [
            {"type": "CLAIM", "claim": claim1[0], "isFact": claim1[1], "category": claim1[2]},
            {"type": "CLASH", "question": clash[0], "a": clash[1], "aValue": clash[2],
             "b": clash[3], "bValue": clash[4], "unit": clash[5]},
            {"type": "CLAIM", "claim": claim2[0], "isFact": claim2[1], "category": claim2[2]},
            {"type": "ZOOM", "bitmap": zoom_bm, "answer": zoom_ans,
             "options": options, "category": zoom_cat},
        ]
        template = PITCH_TEMPLATES[i % len(PITCH_TEMPLATES)]
        wa = WILDCARDS[(2 * i) % len(WILDCARDS)]
        wb = WILDCARDS[(2 * i + 1) % len(WILDCARDS)]
        pitch = {"template": template, "wildcardA": wa}
        if "{B}" in template:
            pitch["wildcardB"] = wb
        for a in answers:
            a.pop("_pop")
            a["eraDecade"] = a.pop("_era")
            a["tagBitmask"] = a.pop("_tags")
        packs.append({
            "id": i,
            "round1": {
                "id": pid, "text": text, "categoryId": cat_id,
                "comboTag": combo, "answers": answers,
            },
            "round2": round2,
            "round3": pitch,
        })

    if problems:
        print("[stage3] COVERAGE PROBLEMS:")
        for p in problems:
            print("  -", p)
        raise SystemExit(1)
    (OUT / "packs.json").write_text(json.dumps(packs, ensure_ascii=False), encoding="utf-8")
    print(f"[stage3] coverage OK: {len(packs)} packs, every prompt >= {MIN_ANSWERS} answers")


if __name__ == "__main__":
    main()
