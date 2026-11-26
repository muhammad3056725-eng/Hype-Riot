"""Round 1 prompt parser (corpus/data/prompts_*.txt).

Format: "@ slug | categoryId | Prompt text" followed by one answer per line
"Canonical Name | alias | alias". Answers are ordered most famous first;
that order drives the score tiers and the Brainstorm Blitz top 10.
"""
from . import DATA, CorpusError, cells, lines
from .text import compact_key

MIN_ANSWERS = 30
MAX_ANSWERS = 60


def load_prompts(warnings):
    prompts = []
    seen_slugs = set()
    for path in sorted(DATA.glob("prompts_*.txt")):
        current = None
        for line in lines(path.name):
            if line.startswith("@"):
                head = cells(line[1:])
                if len(head) != 3 or not head[1].isdigit():
                    raise CorpusError(f"{path.name}: bad header {line!r}")
                slug, cat, text = head
                if slug in seen_slugs:
                    raise CorpusError(f"duplicate prompt slug {slug}")
                seen_slugs.add(slug)
                current = {"slug": slug, "categoryId": int(cat), "text": text, "answers": []}
                prompts.append(current)
                continue
            if current is None:
                raise CorpusError(f"{path.name}: answer before any header: {line!r}")
            parts = [c for c in cells(line) if c]
            current["answers"].append({"name": parts[0], "aliases": parts[1:]})

    for p in prompts:
        owner = {}
        for idx, a in enumerate(p["answers"]):
            k = compact_key(a["name"])
            if not k:
                raise CorpusError(f"{p['slug']}: empty answer {a['name']!r}")
            if k in owner:
                other = p["answers"][owner[k]]["name"]
                raise CorpusError(f"{p['slug']}: duplicate answer {a['name']!r} vs {other!r}")
            owner[k] = idx
        for idx, a in enumerate(p["answers"]):
            kept, kept_keys = [], {compact_key(a["name"])}
            for al in a["aliases"]:
                k = compact_key(al)
                if not k or k in kept_keys:
                    continue
                if k in owner and owner[k] != idx:
                    other = p["answers"][owner[k]]["name"]
                    warnings.append(f"{p['slug']}: alias {al!r} of {a['name']!r} collides with answer {other!r}; dropped")
                    continue
                kept.append(al)
                kept_keys.add(k)
            a["aliases"] = kept
        # an alias claimed by two answers is ambiguous: drop it from both
        alias_owner = {}
        for idx, a in enumerate(p["answers"]):
            for al in a["aliases"]:
                alias_owner.setdefault(compact_key(al), set()).add(idx)
        for idx, a in enumerate(p["answers"]):
            clean = []
            for al in a["aliases"]:
                if len(alias_owner[compact_key(al)]) > 1:
                    warnings.append(f"{p['slug']}: alias {al!r} shared by several answers; dropped")
                    continue
                clean.append(al)
            a["aliases"] = clean
        n = len(p["answers"])
        if not MIN_ANSWERS <= n <= MAX_ANSWERS:
            raise CorpusError(f"{p['slug']}: {n} answers (need {MIN_ANSWERS}-{MAX_ANSWERS})")
    return prompts
