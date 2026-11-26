#!/usr/bin/env python3
"""
HYPE RIOT pipeline Stage 1 — multi-source ingestion (Blueprint §5).
Starter build: ingests the hand-authored corpus package into
pipeline/output/entities_raw.json. In production the same output
format is produced from live sources (Wikidata via wikidata_ingest.py,
Wikipedia pageviews, OpenTDB, Spotify/IGDB exports) — the downstream
stages only ever read entities_raw.json + wikidata_entities.json.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from corpus import load_entities  # noqa: E402

OUT = Path(__file__).parent / "output"


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    entities = load_entities()
    wikidata_path = OUT / "wikidata_entities.json"
    if wikidata_path.exists():
        extra = json.loads(wikidata_path.read_text(encoding="utf-8"))
        known = {e["name"].lower() for e in entities}
        added = 0
        for e in extra:
            if e["name"].lower() not in known:
                entities.append(e)
                known.add(e["name"].lower())
                added += 1
        print(f"[stage1] merged {added} Wikidata entities")
    (OUT / "entities_raw.json").write_text(
        json.dumps(entities, ensure_ascii=False), encoding="utf-8"
    )
    print(f"[stage1] ingested {len(entities)} entities -> output/entities_raw.json")


if __name__ == "__main__":
    main()
