#!/usr/bin/env python3
"""Generates public/data/daily/<YYYY-MM-DD>.json + latest.json for a date
(default: tomorrow UTC, matching the blueprint's 23:00 UTC cron that
publishes the next day's riot). Used by .github/workflows/daily-riot.yml."""
import datetime
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from daily import daily_for  # noqa: E402

ROOT = Path(__file__).parent.parent
PUBLIC = ROOT / "public" / "data"


def main():
    if len(sys.argv) > 1:
        date = datetime.date.fromisoformat(sys.argv[1])
    else:
        date = datetime.datetime.now(datetime.timezone.utc).date() + datetime.timedelta(days=1)
    manifest = json.loads((PUBLIC / "v1" / "manifest.json").read_text(encoding="utf-8"))
    daily = daily_for(date, manifest["packs"])
    out_dir = PUBLIC / "daily"
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / f"{date.isoformat()}.json").write_text(
        json.dumps(daily, indent=2), encoding="utf-8"
    )
    (out_dir / "latest.json").write_text(json.dumps(daily, indent=2), encoding="utf-8")
    print(f"[daily] wrote daily/{date.isoformat()}.json -> pack {daily['packId']}, riot #{daily['riotNumber']}")


if __name__ == "__main__":
    main()
