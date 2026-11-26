#!/usr/bin/env python3
"""HYPE RIOT pipeline Stage 2 — score tiers + Wildcard Combo Tag per prompt.

Tiers: answers are authored most-famous-first; the top 55% are CROWD
PLEASERS (+150), the rest DEEP CUTS (+250).

Combo tag: every prompt gets one secondary condition worth 2x HYPE. It is
chosen automatically so that 20-40% of the prompt's answers qualify (no
more always-on or never-on combos). Kinds (mirrored by
packages/riot-engine/src/ComboTagEvaluator.ts and corpus/text.py):
STARTS_WITH / ENDS_WITH / CONTAINS letters, MULTI_WORD, MAX_LETTERS,
MIN_LETTERS, DOUBLE_LETTER. Letters are taken from the raw display name
(a leading "The" counts).
"""
import json
import random
import string
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from corpus.text import combo_matches  # noqa: E402

OUT = Path(__file__).parent / "output"
CROWD_PLEASER_SHARE = 0.55
COMBO_MIN, COMBO_MAX = 0.20, 0.40
KIND_ORDER = ["STARTS_WITH", "MULTI_WORD", "MAX_LETTERS", "ENDS_WITH",
              "MIN_LETTERS", "CONTAINS", "DOUBLE_LETTER"]


def letters_label(prefix, letters):
    up = [ch.upper() for ch in letters]
    if len(up) == 1:
        return f"{prefix} {up[0]}"
    return f"{prefix} {', '.join(up[:-1])} or {up[-1]}"


def candidates(names, rng):
    n = len(names)

    def cov(tag):
        return sum(1 for nm in names if combo_matches(tag, nm)) / n

    out = []
    # STARTS_WITH: a set of 1-3 letters (letters visited in a seeded order)
    alphabet = list(string.ascii_lowercase)
    rng.shuffle(alphabet)
    for first in alphabet:
        chosen = first
        tag = None
        for nxt in [""] + alphabet:
            if nxt and nxt in chosen:
                continue
            trial = "".join(sorted(chosen + nxt))
            if len(trial) > 3:
                break
            t = {"kind": "STARTS_WITH", "param": trial}
            c = cov(t)
            if COMBO_MIN <= c <= COMBO_MAX:
                tag = t
                break
            if c < COMBO_MIN:
                chosen = trial
            if len(chosen) >= 3:
                break
        if tag:
            tag["label"] = letters_label("Starts with", tag["param"])
            out.append(tag)
            break
    out.append({"kind": "MULTI_WORD", "param": "", "label": "Two words or more"})
    for k in range(3, 9):
        out.append({"kind": "MAX_LETTERS", "param": str(k), "label": f"Short names ({k} letters or fewer)"})
    out.append({"kind": "ENDS_WITH", "param": "aeiou", "label": "Ends with a vowel"})
    out.append({"kind": "ENDS_WITH", "param": "s", "label": "Ends with S"})
    out.append({"kind": "ENDS_WITH", "param": "y", "label": "Ends with Y"})
    for k in range(8, 15):
        out.append({"kind": "MIN_LETTERS", "param": str(k), "label": f"Long names ({k}+ letters)"})
    for ch in "zkxjvwbpmcghfdy":
        out.append({"kind": "CONTAINS", "param": ch, "label": f"Contains the letter {ch.upper()}"})
    out.append({"kind": "DOUBLE_LETTER", "param": "", "label": "Has a double letter (like LL or OO)"})
    good = []
    for t in out:
        c = cov(t)
        if COMBO_MIN <= c <= COMBO_MAX:
            good.append((t, c))
    return good


def choose_combo(prompt, index):
    rng = random.Random(f"combo:{prompt['slug']}")
    names = [a["name"] for a in prompt["answers"]]
    good = candidates(names, rng)
    if not good:
        return None
    order = KIND_ORDER[index % len(KIND_ORDER):] + KIND_ORDER[:index % len(KIND_ORDER)]
    for kind in order:
        of_kind = [(t, c) for t, c in good if t["kind"] == kind]
        if of_kind:
            of_kind.sort(key=lambda tc: abs(tc[1] - 0.3))
            return of_kind[0][0]
    return None


def main():
    corpus = json.loads((OUT / "corpus.json").read_text(encoding="utf-8"))
    problems = []
    for i, p in enumerate(corpus["prompts"]):
        n = len(p["answers"])
        cut = -(-n * int(CROWD_PLEASER_SHARE * 100) // 100)
        for idx, a in enumerate(p["answers"]):
            a["tier"] = "CROWD_PLEASER" if idx < cut else "DEEP_CUT"
        combo = choose_combo(p, i)
        if combo is None:
            problems.append(f"{p['slug']}: no combo tag lands in 20-40% coverage")
            continue
        p["comboTag"] = combo
    if problems:
        print("[stage2] COMBO PROBLEMS:")
        for x in problems:
            print("  -", x)
        raise SystemExit(1)
    (OUT / "prompts.json").write_text(json.dumps(corpus, ensure_ascii=False), encoding="utf-8")
    kinds = {}
    for p in corpus["prompts"]:
        kinds[p["comboTag"]["kind"]] = kinds.get(p["comboTag"]["kind"], 0) + 1
    print(f"[stage2] tiers + combo tags assigned for {len(corpus['prompts'])} prompts; kinds: {kinds}")


if __name__ == "__main__":
    main()
