"""Round 2 "Zoom-in mystery" parser (corpus/data/zoom.txt).

Format: "emoji | Answer | Distractor | Distractor | Distractor". The game
renders the emoji huge, starting extremely zoomed-in and blurred, then
pulls back over the 7-second card window.
"""
from . import CorpusError, cells, lines
from .text import normalize


def load_zoom():
    out, seen = [], set()
    for line in lines("zoom.txt"):
        c = cells(line)
        if len(c) != 5 or not all(c):
            raise CorpusError(f"zoom.txt: bad line {line!r}")
        emoji, answer, *distractors = c
        if len({normalize(o) for o in [answer] + distractors}) != 4:
            raise CorpusError(f"zoom.txt: options not distinct in {line!r}")
        if emoji in seen:
            raise CorpusError(f"zoom.txt: duplicate emoji {emoji}")
        seen.add(emoji)
        out.append({"emoji": emoji, "answer": answer, "distractors": distractors})
    return out
