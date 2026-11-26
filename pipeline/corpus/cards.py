"""Round 2 / Round 3 corpus parsers.

claims.txt     "F | claim | Category"  or  "C | claim | Category"
clashes.txt    "max|min | Question | A | valueA | B | valueB | unit"
               (max: bigger value wins; min: smaller wins, e.g. earlier year)
wildcards.txt  one Round 3 wildcard per line
templates.txt  one pitch template per line with exactly one {A} and one {B}
verbs.txt      one base-form verb per line (pitch action-verb bonus)
"""
import re

from . import CorpusError, cells, lines
from .text import normalize


def load_claims():
    out, seen = [], set()
    for line in lines("claims.txt"):
        c = cells(line)
        if len(c) != 3 or c[0] not in ("F", "C") or not c[1]:
            raise CorpusError(f"claims.txt: bad line {line!r}")
        key = normalize(c[1])
        if key in seen:
            raise CorpusError(f"claims.txt: duplicate claim {c[1]!r}")
        seen.add(key)
        out.append({"claim": c[1], "isFact": c[0] == "F", "category": c[2]})
    return out


def _num(s, line):
    try:
        return float(s) if "." in s else int(s)
    except ValueError as exc:
        raise CorpusError(f"clashes.txt: bad number {s!r} in {line!r}") from exc


def load_clashes():
    out = []
    for line in lines("clashes.txt"):
        c = cells(line)
        if len(c) != 7 or c[0] not in ("max", "min"):
            raise CorpusError(f"clashes.txt: bad line {line!r}")
        mode, q, a, av, b, bv, unit = c
        av, bv = _num(av, line), _num(bv, line)
        scale = max(abs(av), abs(bv))
        if "year" in unit.lower():
            too_close = abs(av - bv) < 1
        else:
            too_close = scale == 0 or abs(av - bv) / scale < 0.05
        if too_close:
            print(f"[corpus] skipping clash with values too close: {line!r}")
            continue
        for label in (a, b):
            if re.search(r"\d{3,}", label):
                raise CorpusError(f"clashes.txt: option label leaks a number: {label!r}")
        out.append({"mode": mode, "question": q, "a": a, "aValue": av,
                    "b": b, "bValue": bv, "unit": unit})
    return out


def load_list(name):
    out, seen = [], set()
    for line in lines(name):
        k = normalize(line)
        if k and k not in seen:
            seen.add(k)
            out.append(line)
    return out


def load_templates():
    out = load_list("templates.txt")
    for t in out:
        if t.count("{A}") != 1 or t.count("{B}") != 1:
            raise CorpusError(f"templates.txt: needs one {{A}} and one {{B}}: {t!r}")
    return out


FUNCTION_VERBS = {"be", "is", "am", "are", "was", "were", "have", "has", "had", "do",
                  "does", "did", "can", "will", "shall", "may", "might", "must",
                  "should", "would", "could"}


def load_verbs():
    return sorted({v.lower() for v in load_list("verbs.txt")
                   if re.fullmatch(r"[a-zA-Z]+", v) and v.lower() not in FUNCTION_VERBS})
