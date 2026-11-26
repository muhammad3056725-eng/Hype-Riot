# HYPE RIOT pipeline corpus package — aggregates the hand-authored
# starter corpus (production ingestion: stage1_ingest.py / wikidata_ingest.py).
import importlib

CATEGORY_MODULES = {
    1: "entities_cat01",
    2: "entities_cat02",
    3: "entities_cat03",
    4: "entities_cat04",
    5: "entities_cat05",
    6: "entities_cat06",
    7: "entities_cat07",
    8: "entities_cat08",
    9: "entities_cat09",
    10: "entities_cat10",
}

TAG_BITS = {
    "GAMING": 1, "ANIME": 2, "MEME": 4, "MUSIC": 8, "SPORT": 16,
    "FOOD": 32, "SPACE": 64, "HORROR": 128, "SUPERHERO": 256, "CLASSIC": 512,
}


def load_entities():
    """Returns the full starter entity list in pipeline dict format."""
    out = []
    for cat_id, mod_name in CATEGORY_MODULES.items():
        mod = importlib.import_module(f"corpus.{mod_name}")
        for idx, (name, pop, era, tags, aliases) in enumerate(mod.ENTITIES):
            bitmask = 0
            for t in tags:
                bitmask |= TAG_BITS[t]
            out.append({
                "id": cat_id * 100000 + idx + 1,
                "name": name,
                "category_id": cat_id,
                "popularity_score": pop,
                "era_decade": era,
                "tag_bitmask": bitmask,
                "tags": tags,
                "cluster_id": cat_id,
                "aliases": list(aliases),
            })
    return out
