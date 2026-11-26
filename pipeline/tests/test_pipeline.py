"""HYPE RIOT pipeline + dataset integrity tests (stdlib unittest; pytest-compatible).

Run: python -m unittest discover -s pipeline/tests -v
"""
import datetime
import json
import math
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).parent.parent.parent
PIPELINE = ROOT / "pipeline"
PUBLIC = ROOT / "public" / "data" / "v1"
sys.path.insert(0, str(PIPELINE))

from corpus.loader import load_corpus  # noqa: E402
from corpus.safety import DENIED_PEOPLE, scan  # noqa: E402
from corpus.text import combo_matches, compact_key, normalize  # noqa: E402
from daily import daily_for  # noqa: E402


def load_packs():
    return [json.loads(p.read_text(encoding="utf-8")) for p in sorted((PUBLIC / "packs").glob("pack_*.json"))]


class TestCorpus(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.corpus, cls.warnings = load_corpus()

    def test_scale_targets(self):
        c = self.corpus
        self.assertGreaterEqual(len(c["prompts"]), 120)
        self.assertGreaterEqual(len(c["claims"]), 240)
        self.assertGreaterEqual(len(c["clashes"]), 80)
        self.assertGreaterEqual(len(c["zoom"]), 100)
        self.assertGreaterEqual(len(c["templates"]), 30)
        self.assertGreaterEqual(len(c["wildcards"]), 300)
        self.assertGreaterEqual(len(c["verbs"]), 900)

    def test_answers_per_prompt(self):
        for p in self.corpus["prompts"]:
            self.assertTrue(30 <= len(p["answers"]) <= 60, p["slug"])

    def test_claims_balanced(self):
        facts = sum(1 for c in self.corpus["claims"] if c["isFact"])
        share = facts / len(self.corpus["claims"])
        self.assertTrue(0.45 <= share <= 0.55, share)

    def test_clash_modes_and_labels(self):
        modes = {c["mode"] for c in self.corpus["clashes"]}
        self.assertEqual(modes, {"max", "min"})
        for c in self.corpus["clashes"]:
            for label in (c["a"], c["b"]):
                self.assertNotIn(str(c["aValue"]), label)
                self.assertNotIn(str(c["bValue"]), label)

    def test_no_overlapping_prompts(self):
        slugs = [p["slug"] for p in self.corpus["prompts"]]
        self.assertEqual(len(slugs), len(set(slugs)))
        texts = [normalize(p["text"]) for p in self.corpus["prompts"]]
        self.assertEqual(len(texts), len(set(texts)))

    def test_denied_people_absent(self):
        denied = {compact_key(n) for n in DENIED_PEOPLE}
        for p in self.corpus["prompts"]:
            for a in p["answers"]:
                for form in [a["name"], *a["aliases"]]:
                    self.assertNotIn(compact_key(form), denied, f"{p['slug']}: {form}")

    def test_safety_scan_catches_denylist(self):
        hits = []
        scan("t", "Andrew Tate", hits)
        scan("t", "root beer float", hits)
        scan("t", "seen with the naked eye", hits)
        self.assertEqual(len(hits), 1)


class TestCompiledDataset(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manifest = json.loads((PUBLIC / "manifest.json").read_text(encoding="utf-8"))
        cls.packs = load_packs()

    def test_manifest_matches_files(self):
        self.assertEqual(self.manifest["packs"], len(self.packs))
        self.assertGreaterEqual(len(self.packs), 120)
        for rel in self.manifest["files"]:
            self.assertTrue((PUBLIC / rel).exists(), rel)
        self.assertTrue((PUBLIC / "pitch.json").exists())

    def test_every_pack(self):
        claims_seen = set()
        for pack in self.packs:
            r1 = pack["round1"]
            n = len(r1["answers"])
            self.assertTrue(30 <= n <= 60, r1["id"])
            self.assertEqual({a["tier"] for a in r1["answers"]}, {"CROWD_PLEASER", "DEEP_CUT"})
            self.assertEqual([a["rank"] for a in r1["answers"]], list(range(n)))
            cov = sum(1 for a in r1["answers"] if combo_matches(r1["comboTag"], a["name"])) / n
            self.assertTrue(0.2 <= cov <= 0.4, f"{r1['id']}: {r1['comboTag']} covers {cov:.2f}")
            types = sorted(c["type"] for c in pack["round2"])
            self.assertEqual(types, ["CLAIM", "CLAIM", "CLASH", "ZOOM"], r1["id"])
            for c in pack["round2"]:
                if c["type"] == "CLAIM":
                    self.assertNotIn(c["claim"], claims_seen, "claims must not repeat across packs")
                    claims_seen.add(c["claim"])
                elif c["type"] == "ZOOM":
                    self.assertEqual(len(c["options"]), 4)
                    self.assertIn(c["answer"], c["options"])
            r3 = pack["round3"]
            self.assertIn("{A}", r3["template"])
            self.assertIn("{B}", r3["template"])
            self.assertNotEqual(r3["wildcardA"], r3["wildcardB"])

    def test_clash_sides_randomised(self):
        a_wins = 0
        total = 0
        for pack in self.packs:
            for c in pack["round2"]:
                if c["type"] != "CLASH":
                    continue
                total += 1
                bigger_a = c["aValue"] > c["bValue"]
                a_wins += 1 if bigger_a == (c["mode"] == "max") else 0
        self.assertTrue(0.3 <= a_wins / total <= 0.7, a_wins / total)

    def test_daily_cycle_has_no_repeats(self):
        n = self.manifest["packs"]
        stride = self.manifest["dailyStride"]
        self.assertEqual(math.gcd(n, stride), 1)
        start = datetime.date(2026, 1, 1)
        ids = {daily_for(start + datetime.timedelta(days=i), n, stride)["packId"] for i in range(n)}
        self.assertEqual(len(ids), n)
        self.assertGreaterEqual(n, 120)
        for date, pack_id in self.manifest["dailyCheck"].items():
            self.assertEqual(daily_for(datetime.date.fromisoformat(date), n, stride)["packId"], pack_id)


if __name__ == "__main__":
    unittest.main()
