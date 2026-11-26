#!/usr/bin/env python3
"""HYPE RIOT pipeline Stage 1 — ingest + validate the hand-authored corpus.

Reads pipeline/corpus/data/*.txt, validates every entry (formats, answer
counts 30-60, duplicate answers, alias collisions, clash value gaps,
zoom option uniqueness, template placeholders) and writes
pipeline/output/corpus.json. Any malformed entry fails the build.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from corpus import CorpusError  # noqa: E402
from corpus.loader import load_corpus  # noqa: E402

OUT = Path(__file__).parent / "output"


def main():
    try:
        corpus, warnings = load_corpus()
    except CorpusError as exc:
        print(f"[stage1] CORPUS ERROR: {exc}")
        raise SystemExit(1)
    for w in warnings:
        print(f"[stage1] warning: {w}")
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "corpus.json").write_text(json.dumps(corpus, ensure_ascii=False), encoding="utf-8")
    n_answers = sum(len(p["answers"]) for p in corpus["prompts"])
    facts = sum(1 for c in corpus["claims"] if c["isFact"])
    print(
        f"[stage1] {len(corpus['prompts'])} prompts / {n_answers} answers, "
        f"{len(corpus['claims'])} claims ({facts} fact / {len(corpus['claims']) - facts} cap), "
        f"{len(corpus['clashes'])} clashes, {len(corpus['zoom'])} zoom items, "
        f"{len(corpus['templates'])} templates, {len(corpus['wildcards'])} wildcards, "
        f"{len(corpus['verbs'])} verbs"
    )


if __name__ == "__main__":
    main()
