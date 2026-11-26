#!/usr/bin/env python3
"""
HYPE RIOT — Wikidata ingestion for dataset growth (owner order Nov 26, 2026).
Pulls entities per game category from Wikidata (SPARQL), using sitelink
count as the popularity proxy and skos:altLabel as slang/alias sources,
and writes pipeline/output/wikidata_entities.json in the exact format
stage1_ingest.py merges. Stage 2-5 then rebuild pools/packs/bin/shards
and re-validate (coverage + safety) before anything publishes.

Growth is STAGED: --per-category N caps each pull (default 250). The
data-build GitHub Actions workflow raises the cap over time; every run
reports the honest counts it actually pulled. No API key is needed
(Wikidata is open), only a descriptive User-Agent per their policy.

What this can and cannot grow:
  - Entities + aliases + brainstorm answer pools: YES (this script).
  - Fact-or-Cap claims / clash stats: NO — those need editorial facts,
    they stay hand-authored in corpus/cards.py.
"""
import argparse
import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from corpus import TAG_BITS  # noqa: E402

OUT = Path(__file__).parent / "output"
ENDPOINT = "https://query.wikidata.org/sparql"
UA = "HypeRiotDataBuild/0.1 (https://github.com/muhammad3056725-eng/Hype-Riot)"

# category_id -> (label, [Wikidata class QIDs for instance-of/subclass-of])
CATEGORY_CLASSES = {
    1: ("Video Games", ["Q7889"]),
    2: ("Music", ["Q215380", "Q639669"]),
    3: ("Movies & TV", ["Q11424", "Q5398426"]),
    4: ("Sports", ["Q2066131", "Q476028"]),
    5: ("Internet Culture", ["Q10944661", "Q17125263"]),
    6: ("Food", ["Q2095", "Q15495909"]),
    7: ("Animals", ["Q729"]),
    8: ("Science & Space", ["Q40218", "Q634", "Q3863"]),
    9: ("Places", ["Q515", "Q570116"]),
    10: ("School & Everyday", ["Q3914", "Q41176"]),
}

QUERY = """
SELECT ?item ?itemLabel (COUNT(DISTINCT ?sitelink) AS ?links)
       (SAMPLE(?inception) AS ?inc) (GROUP_CONCAT(DISTINCT ?alt; separator="|") AS ?alts)
WHERE {{
  VALUES ?class {{ {classes} }}
  ?item wdt:P31/wdt:P279* ?class .
  ?sitelink schema:about ?item .
  OPTIONAL {{ ?item wdt:P571 ?inception . }}
  OPTIONAL {{ ?item skos:altLabel ?alt . FILTER(LANG(?alt) = "en") }}
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en" . }}
}}
GROUP BY ?item ?itemLabel
HAVING (?links >= 15)
ORDER BY DESC(?links)
LIMIT {limit}
"""


def sparql(query: str) -> dict:
    url = ENDPOINT + "?" + urllib.parse.urlencode(
        {"query": query, "format": "json"}
    )
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/sparql-results+json"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read().decode("utf-8"))


def decade_offset(inc: str) -> int:
    try:
        year = int(inc[:4])
    except (TypeError, ValueError):
        return 5
    return max(0, min(7, (year - 1950) // 10))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--per-category", type=int, default=250)
    ap.add_argument("--categories", type=str, default="")
    ap.add_argument("--sleep", type=float, default=2.0)
    args = ap.parse_args()

    cats = (
        [int(c) for c in args.categories.split(",") if c]
        if args.categories
        else sorted(CATEGORY_CLASSES)
    )
    OUT.mkdir(parents=True, exist_ok=True)
    existing = []
    out_path = OUT / "wikidata_entities.json"
    if out_path.exists():
        existing = json.loads(out_path.read_text(encoding="utf-8"))
    known = {e["name"].lower() for e in existing}
    total_new = 0
    for cat in cats:
        label, classes = CATEGORY_CLASSES[cat]
        q = QUERY.format(
            classes=" ".join(f"wd:{c}" for c in classes),
            limit=args.per_category,
        )
        try:
            data = sparql(q)
        except Exception as exc:  # network/rate-limit: report, keep going
            print(f"[wikidata] CAT_{cat:02d} {label}: FAILED ({exc})")
            continue
        rows = data["results"]["bindings"]
        added = 0
        for i, row in enumerate(rows):
            name = row["itemLabel"]["value"]
            if name.lower() in known or name.startswith("Q"):
                continue
            links = int(row["links"]["value"])
            pop = max(40, min(255, 40 + links * 2))
            era = decade_offset(row.get("inc", {}).get("value", ""))
            alts = []
            if row.get("alts", {}).get("value"):
                alts = [a for a in row["alts"]["value"].split("|") if a and a.lower() != name.lower()][:4]
            existing.append({
                "id": cat * 100000 + 5000 + len([e for e in existing if e["category_id"] == cat]) + 1,
                "name": name,
                "category_id": cat,
                "popularity_score": pop,
                "era_decade": era,
                "tag_bitmask": 0,
                "tags": [],
                "cluster_id": cat,
                "aliases": alts,
                "source": "wikidata",
                "qid": row["item"]["value"].rsplit("/", 1)[-1],
            })
            known.add(name.lower())
            added += 1
        total_new += added
        print(f"[wikidata] CAT_{cat:02d} {label}: pulled {len(rows)}, new {added}")
        time.sleep(args.sleep)
    out_path.write_text(json.dumps(existing, ensure_ascii=False), encoding="utf-8")
    print(f"[wikidata] total stored: {len(existing)} entities (+{total_new} new this run)")


if __name__ == "__main__":
    main()
