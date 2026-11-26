"""HYPE RIOT safety gate: word blocklist + denied people (hard fail)."""
from .text import normalize

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
    "alcohol", "vodka", "whiskey", "tequila", "beer pong", "wine",
    "casino", "gambling", "betting", "pornography", "onlyfans",
    "stripper", "escort", "brothel", "prostitute", "hooker",
}

# Creators/public figures the owner removed for a teen audience.
DENIED_PEOPLE = [
    "Andrew Tate", "Tristan Tate", "Sneako", "LeafyIsHere", "Filthy Frank",
    "RiceGum", "FouseyTube", "Vitaly", "Logan Paul", "Jake Paul", "Adin Ross",
    "Dr Disrespect", "David Dobrik", "Nelk Boys",
]


# Innocent phrases that contain a blocked word; removed before scanning.
ALLOW_PHRASES = ["naked eye", "moby dick", "dick grayson", "dick tracy", "spotted dick"]


def scan(label, text, hits):
    norm = normalize(text)
    for phrase in ALLOW_PHRASES:
        norm = f" {norm} ".replace(f" {phrase} ", " ").strip()
    words = set(norm.split())
    for bad in BLOCKLIST:
        if (" " in bad and f" {bad} " in f" {norm} ") or bad in words:
            hits.append(f"{label}: {text!r} contains {bad!r}")
    padded = f" {norm} "
    for person in DENIED_PEOPLE:
        if f" {normalize(person)} " in padded:
            hits.append(f"{label}: {text!r} names denied person {person!r}")
