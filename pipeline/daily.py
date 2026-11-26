#!/usr/bin/env python3
"""
HYPE RIOT daily seed computation (Blueprint §2 Daily Riot, §6 daily-riot.yml).
One global sequence per UTC date: seed = days since epoch, riot number
counts days since launch epoch (2026-01-01), pack and arena derive from
the seed. The web client computes the identical values locally; this
module produces the published daily/YYYY-MM-DD.json artifacts.
"""
import datetime

LAUNCH_EPOCH = datetime.date(2026, 1, 1)


def daily_for(date: datetime.date, pack_count: int) -> dict:
    seed = (date - datetime.date(1970, 1, 1)).days
    riot_number = (date - LAUNCH_EPOCH).days + 1
    return {
        "date": date.isoformat(),
        "seed": seed,
        "riotNumber": riot_number,
        "packId": seed % pack_count,
        "arenaTheme": seed % 6,
    }
