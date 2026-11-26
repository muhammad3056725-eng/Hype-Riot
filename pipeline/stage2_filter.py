#!/usr/bin/env python3
"""
HYPE RIOT pipeline Stage 2 — teen relevance & alias filter (Blueprint §5).
- Drops entities below the relevance floor (popularity < 40).
- Normalizes every alias with the SAME rules as the web AnswerMatcher
  (lowercase, strip diacritics/punctuation, collapse spaces, drop a
  leading "the") and builds the global alias dictionary.
- Guarantees alias uniqueness: an alias claimed by two entities is
  kept only for the more popular one.
"""
import json
import re
import sys
import unicodedata
from pathlib import Path

OUT = Path(__file__).parent / "output"
RELEVANCE_FLOOR = 40


def normalize(s: str) -> str:
    s = unicodedata.normalize("NFD", s.lower())
    s = "".join(ch for ch in s if unicodedata.category(ch) != "Mn")
    s = s.replace("&", " and ")
    s = re.sub(r"[^a-z0-9 ]+", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    if s.startswith("the "):
        s = s[4:]
    return s


def main():
    entities = json.loads((OUT / "entities_raw.json").read_text(encoding="utf-8"))
    kept = [e for e in entities if e["popularity_score"] >= RELEVANCE_FLOOR]
    dropped = len(entities) - len(kept)

    # alias ownership: highest popularity wins a contested alias
    claims = {}
    for e in sorted(kept, key=lambda x: -x["popularity_score"]):
        forms = {normalize(e["name"])} | {normalize(a) for a in e["aliases"]}
        owned = []
        for f in forms:
            if not f:
                continue
            if f not in claims:
                claims[f] = e["id"]
                owned.append(f)
        e["alias_forms"] = sorted(owned)

    (OUT / "entities_filtered.json").write_text(
        json.dumps(kept, ensure_ascii=False), encoding="utf-8"
    )
    alias_dict = {
        f: next(e for e in kept if e["id"] == eid)
        for f, eid in claims.items()
    }
    alias_out = {
        f: {
            "id": e["id"],
            "name": e["name"],
            "category_id": e["category_id"],
            "tier": "CROWD_PLEASER" if e["popularity_score"] >= 185 else "DEEP_CUT",
        }
        for f, e in alias_dict.items()
    }
    (OUT / "aliases.json").write_text(
        json.dumps(alias_out, ensure_ascii=False), encoding="utf-8"
    )
    print(
        f"[stage2] kept {len(kept)} entities (dropped {dropped} below floor), "
        f"{len(alias_out)} alias forms"
    )


if __name__ == "__main__":
    main()
