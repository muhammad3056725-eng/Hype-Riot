#!/usr/bin/env python3
"""
HYPE RIOT pipeline Stage 5 — binary and shard compiler (Blueprint §5).
Follows the blueprint's shipped compiler structure: entities.bin
(64-byte header + packed records + string table) and 2-letter prefix
trie shards. Extensions for this deployment:
  - entities.json: full text fallback (the GitHub connector push is
    text-only, so the binary cannot be relied on to reach the repo;
    the web loader tries .bin first, then .json — same pattern as
    NEXUS RELAY's telemetry fallback).
  - packs copied to public/data/v1/packs/pack_NNN.json
  - manifest.json with per-file sha256 fingerprints
  - daily/latest.json for the build date
"""
import datetime
import hashlib
import json
import os
import struct
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from daily import daily_for  # noqa: E402

DATA_DIR = Path(__file__).parent / "output"
PUBLIC_DIR = Path(__file__).parent.parent / "public" / "data" / "v1"


def compile_binary_entities(entities_data):
    """Compiles entities list into the compact binary format (Blueprint §4)."""
    os.makedirs(PUBLIC_DIR, exist_ok=True)
    bin_path = PUBLIC_DIR / "entities.bin"
    header_magic = b"HRD1"  # Hype Riot Data v1
    version = 1
    count = len(entities_data)
    header = struct.pack("<4sHI54x", header_magic, version, count)
    records = bytearray()
    string_table = bytearray()
    string_offsets = {}
    for item in entities_data:
        name_bytes = item["name"].encode("utf-8") + b"\x00"
        if item["name"] not in string_offsets:
            string_offsets[item["name"]] = len(string_table)
            string_table.extend(name_bytes)
        offset = string_offsets[item["name"]]
        record = struct.pack(
            "<IBBBIIH",
            item["id"],
            item["category_id"],
            item["popularity_score"],
            item["era_decade"],
            item["tag_bitmask"],
            offset,
            item["cluster_id"],
        )
        records.extend(record)
    with open(bin_path, "wb") as f:
        f.write(header)
        f.write(records)
        f.write(string_table)
    print(f"[stage5] compiled {count} entities into {bin_path} ({os.path.getsize(bin_path)} bytes)")


def generate_shards(alias_dictionary):
    """Generates 2-letter prefix trie shards (Blueprint §4)."""
    shards_dir = PUBLIC_DIR / "trie_shards"
    os.makedirs(shards_dir, exist_ok=True)
    shards = {}
    for alias, entity_info in alias_dictionary.items():
        prefix = alias[:2].lower()
        if len(prefix) < 2:
            prefix = prefix.ljust(2, "_")
        if prefix not in shards:
            shards[prefix] = {"prefix": prefix, "alias_map": {}, "canonical": {}}
        shards[prefix]["alias_map"][alias] = entity_info["id"]
        shards[prefix]["canonical"][str(entity_info["id"])] = {
            "name": entity_info["name"],
            "category": entity_info["category_id"],
            "tier": entity_info["tier"],
        }
    for prefix, content in shards.items():
        shard_path = shards_dir / f"{prefix}.json"
        with open(shard_path, "w", encoding="utf-8") as f:
            json.dump(content, f, separators=(",", ":"))
    print(f"[stage5] generated {len(shards)} trie shards in {shards_dir}")
    return len(shards)


def sha12(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()[:12]


def main():
    entities = json.loads((DATA_DIR / "entities_filtered.json").read_text(encoding="utf-8"))
    aliases = json.loads((DATA_DIR / "aliases.json").read_text(encoding="utf-8"))
    packs = json.loads((DATA_DIR / "packs.json").read_text(encoding="utf-8"))

    entities_sorted = sorted(entities, key=lambda e: e["id"])
    compile_binary_entities(entities_sorted)
    shard_count = generate_shards(aliases)

    # text fallback with the same records (names included)
    (PUBLIC_DIR / "entities.json").write_text(
        json.dumps(
            [
                {
                    "id": e["id"], "name": e["name"], "categoryId": e["category_id"],
                    "popularity": e["popularity_score"], "eraDecade": e["era_decade"],
                    "tagBitmask": e["tag_bitmask"], "clusterId": e["cluster_id"],
                }
                for e in entities_sorted
            ],
            ensure_ascii=False, separators=(",", ":"),
        ),
        encoding="utf-8",
    )

    packs_dir = PUBLIC_DIR / "packs"
    packs_dir.mkdir(parents=True, exist_ok=True)
    for old in packs_dir.glob("pack_*.json"):
        old.unlink()
    for pack in packs:
        (packs_dir / f"pack_{pack['id']:03d}.json").write_text(
            json.dumps(pack, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )

    files = {}
    for path in sorted(PUBLIC_DIR.rglob("*")):
        if path.is_file() and path.name != "manifest.json":
            files[str(path.relative_to(PUBLIC_DIR))] = sha12(path)
    manifest = {
        "version": "0.1.0-starter",
        "generated": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "entities": len(entities_sorted),
        "shards": shard_count,
        "packs": len(packs),
        "files": files,
    }
    (PUBLIC_DIR / "manifest.json").write_text(
        json.dumps(manifest, indent=2), encoding="utf-8"
    )

    daily_dir = PUBLIC_DIR.parent / "daily"
    daily_dir.mkdir(parents=True, exist_ok=True)
    today = datetime.datetime.now(datetime.timezone.utc).date()
    daily = daily_for(today, len(packs))
    (daily_dir / "latest.json").write_text(json.dumps(daily, indent=2), encoding="utf-8")
    (daily_dir / f"{today.isoformat()}.json").write_text(
        json.dumps(daily, indent=2), encoding="utf-8"
    )
    print(
        f"[stage5] manifest: {manifest['entities']} entities, {shard_count} shards, "
        f"{len(packs)} packs; daily -> pack {daily['packId']}"
    )


if __name__ == "__main__":
    main()
