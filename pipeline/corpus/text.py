"""Text helpers shared by the HYPE RIOT pipeline.

These mirror packages/riot-engine/src/text.ts exactly (normalize, word
keys, display names) and ComboTagEvaluator.ts (combo checks), so the
build can validate packs with the same rules the game uses.
"""
import re
import unicodedata

IRREGULAR = {
    "mice": "mouse", "geese": "goose", "teeth": "tooth", "feet": "foot",
    "children": "child", "men": "man", "women": "woman", "people": "person",
    "oxen": "ox", "lice": "louse", "dice": "die", "cacti": "cactus",
    "fungi": "fungus", "octopi": "octopus", "dwarves": "dwarf", "elves": "elf",
}


def fold(s: str) -> str:
    """Lowercase + strip diacritics (no other changes)."""
    s = unicodedata.normalize("NFD", s.lower())
    return "".join(ch for ch in s if unicodedata.category(ch) != "Mn")


def display_name(s: str) -> str:
    """Drop trailing '(...)' disambiguators for display."""
    return re.sub(r"\s*\([^)]*\)", "", s).strip()


def normalize(s: str) -> str:
    s = fold(s)
    s = s.replace("&", " and ")
    s = re.sub(r"['’`]", "", s)          # apostrophes vanish: mcdonald's -> mcdonalds
    s = re.sub(r"[^a-z0-9 ]+", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    if s.startswith("the "):
        s = s[4:]
    return s


def word_key(w: str) -> str:
    """Singular-ish stem so plural/singular forms meet (same on both sides)."""
    if w in IRREGULAR:
        w = IRREGULAR[w]
    n = len(w)
    if n > 4 and w.endswith("ies"):
        w = w[:-3] + "y"
    elif n > 4 and w.endswith("ves"):
        w = w[:-3] + "f"
    elif w.endswith(("sses", "xes", "zes", "ches", "shes")):
        w = w[:-2]
    elif n > 3 and w.endswith("s") and not w.endswith(("ss", "us", "is")):
        w = w[:-1]
    if len(w) > 3 and w.endswith("ie"):
        w = w[:-2] + "y"
    if len(w) > 3 and w.endswith("fe"):
        w = w[:-2] + "f"
    if len(w) > 3 and w.endswith("e"):
        w = w[:-1]
    return w


def compact_key(s: str) -> str:
    return "".join(word_key(w) for w in normalize(s).split(" ") if w)


def letters(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", fold(display_name(s)))


def combo_matches(tag: dict, name: str) -> bool:
    """Mirror of ComboTagEvaluator.ts evaluateComboTag."""
    shown = display_name(name)
    lt = letters(shown)
    kind, param = tag["kind"], tag.get("param", "")
    if kind == "STARTS_WITH":
        return bool(lt) and lt[0] in param
    if kind == "ENDS_WITH":
        return bool(lt) and lt[-1] in param
    if kind == "CONTAINS":
        return param in lt
    if kind == "MULTI_WORD":
        return len(shown.split()) >= 2
    if kind == "MAX_LETTERS":
        return len(lt) <= int(param)
    if kind == "MIN_LETTERS":
        return len(lt) >= int(param)
    if kind == "DOUBLE_LETTER":
        return re.search(r"([a-z])\1", lt) is not None
    raise ValueError(f"unknown combo kind {kind}")
