#!/usr/bin/env python3
"""Writes public/data/daily/<YYYY-MM-DD>.json + latest.json for a UTC date
(default: today). The web client computes the same values itself from
manifest.json; these files are a published, human-readable record."""
import datetime
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from daily import daily_for  # noqa: E402

PUBLIC = Path(__file__).parent.parent / "public" / "data"


def main():
    if len(sys.argv) > 1:
        date = datetime.date.fromisoformat(sys.argv[1])
    else:
        date = datetime.datetime.now(datetime.timezone.utc).date()
    manifest = json.loads((PUBLIC / "v1" / "manifest.json").read_text(encoding="utf-8"))
    daily = daily_for(date, manifest["packs"], manifest["dailyStride"], manifest.get("dailyOffset", 0))
    out_dir = PUBLIC / "daily"
    out_dir.mkdir(parents=True, exist_ok=True)
    text = json.dumps(daily, indent=2) + "\n"
    (out_dir / f"{date.isoformat()}.json").write_text(text, encoding="utf-8", newline="\n")
    (out_dir / "latest.json").write_text(text, encoding="utf-8", newline="\n")
    print(f"[daily] {date.isoformat()} -> pack {daily['packId']}, riot #{daily['riotNumber']}")


if __name__ == "__main__":
    main()
