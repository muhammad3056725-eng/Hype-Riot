#!/usr/bin/env python3
"""HYPE RIOT Daily Riot schedule — identical math to apps/web/src/data.ts.

riotNumber = days since the 2026-01-01 launch + 1 (UTC dates)
packId     = (offset + (riotNumber - 1) * stride) mod packCount
The stride is coprime with packCount, so the Daily visits every pack
exactly once before anything repeats (packCount consecutive days), and a
golden-ratio stride keeps consecutive days far apart (categories mix).
"""
import datetime
import math

LAUNCH_EPOCH = datetime.date(2026, 1, 1)


def pick_stride(pack_count: int) -> int:
    if pack_count <= 2:
        return 1
    s = max(1, round(pack_count * 0.381966))
    while math.gcd(s, pack_count) != 1:
        s += 1
    return s


def daily_for(date: datetime.date, pack_count: int, stride: int, offset: int = 0) -> dict:
    seed = (date - datetime.date(1970, 1, 1)).days
    riot = (date - LAUNCH_EPOCH).days + 1
    return {
        "date": date.isoformat(),
        "seed": seed,
        "riotNumber": riot,
        "packId": (offset + (riot - 1) * stride) % pack_count,
        "arenaTheme": seed % 6,
    }
