#!/usr/bin/env python3
"""
HYPE RIOT pipeline Stage 4 — safety and profanity guardrails (Blueprint S5).
Scans every player-visible string (entity names, aliases, prompt text,
claims, wildcards, pitch templates) against a blocklist of profanity,
slurs and explicit terms. Any hit fails the build. PG-13 / streamer
compliance is a hard gate, not a warning.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from stage2_filter import normalize  # noqa: E402

OUT = Path(__file__).parent / "output"

BLOCKLIST = {
    "fuck", "shit", "bitch", "bastard", "whore", "slut", "porn", "porno",
    "sex", "sexy", "nude", "naked", "erotic", "fetish", "orgasm",
    "penis", "vagina", "boobs", "tits", "dick", "cock", "pussy",
    "nigger", "nigga", "faggot", "retard", "kike", "spic", "chink",
    "cocaine", "heroin", "meth", "methamphetamine", "crack cocaine",
    "marijuana", "weed", "cannabis", "lsd", "ecstasy", "mdma",
    "suicide", "kill yourself", "kys", "self harm", "selfharm",
    "nazi", "hitler", "isis", "terrorist", "jihad",
    "rape", "rapist", "molest", "pedophile", "pedo",
    "alcohol", "vodka", "whiskey", "tequila", "beer pong",
    "casino", "gambling", "betting", "pornography", "onlyfans",
    "stripper", "escort", "brothel", "prostitute", "hooker",
}


def scan(label, text, hits):
    norm = normalize(text)
    words = set(norm.split())
    for bad in BLOCKLIST:
        if " " in bad:
            if bad in norm:
                hits.append(label + ": " + repr(text) + " contains " + repr(bad))
        elif bad in words:
            hits.append(label + ": " + repr(text) + " contains " + repr(bad))


def main():
    entities = json.loads((OUT / "entities_filtered.json").read_text(encoding="utf-8"))
    packs = json.loads((OUT / "packs.json").read_text(encoding="utf-8"))
    hits = []
    for e in entities:
        scan("entity", e["name"], hits)
        for a in e["aliases"]:
            scan("alias", a, hits)
    for p in packs:
        scan("prompt", p["round1"]["text"], hits)
        for card in p["round2"]:
            if card["type"] == "CLAIM":
                scan("claim", card["claim"], hits)
            elif card["type"] == "CLASH":
                scan("clash", card["a"], hits)
                scan("clash", card["b"], hits)
            elif card["type"] == "ZOOM":
                scan("zoom", card["answer"], hits)
        scan("pitch", p["round3"]["wildcardA"], hits)
        if "wildcardB" in p["round3"]:
            scan("pitch", p["round3"]["wildcardB"], hits)
    if hits:
        print("[stage4] SAFETY VIOLATIONS:")
        for h in hits:
            print("  -", h)
        raise SystemExit(1)
    print("[stage4] safety scan clean (" + str(len(entities)) + " entities, " + str(len(packs)) + " packs)")


if __name__ == "__main__":
    main()
