"""HYPE RIOT corpus package.

Hand-authored text data lives in corpus/data/*.txt (see loader.py for the
formats). Parsers: prompts.py (Round 1), cards.py (Round 2 claims/clashes,
Round 3 templates/wildcards, verb dictionary), zoom.py (Zoom-in mystery).
Shared text rules: text.py. Safety gate: safety.py.
"""
from pathlib import Path

DATA = Path(__file__).parent / "data"


class CorpusError(Exception):
    """Raised for any malformed or invalid corpus entry (fails the build)."""


def lines(name):
    for raw in (DATA / name).read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if line and not line.startswith("#"):
            yield line


def cells(line):
    return [c.strip() for c in line.split("|")]
