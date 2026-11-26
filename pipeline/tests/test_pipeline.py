"""HYPE RIOT pipeline integrity tests (Blueprint §6: test_pipeline.py).
Runs under both pytest (CI) and stdlib unittest (local)."""
import json
import struct
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).parent.parent.parent
PIPELINE = ROOT / "pipeline"
PUBLIC = ROOT / "public" / "data" / "v1"
sys.path.insert(0, str(PIPELINE))


class TestCompiledDataset(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manifest = json.loads((PUBLIC / "manifest.json").read_text(encoding="utf-8"))
        cls.entities = json.loads((PUBLIC / "entities.json").read_text(encoding="utf-8"))

    def test_manifest_counts_match_files(self):
        self.assertEqual(self.manifest["entities"], len(self.entities))
        packs = list((PUBLIC / "packs").glob("pack_*.json"))
        self.assertEqual(self.manifest["packs"], len(packs))
        shards = list((PUBLIC / "trie_shards").glob("*.json"))
        self.assertEqual(self.manifest["shards"], len(shards))

    def test_entities_bin_round_trip(self):
        bin_path = PUBLIC / "entities.bin"
        if not bin_path.exists():
            self.skipTest(
                "entities.bin is a generated artifact, absent in this checkout"
            )
        buf = bin_path.read_bytes()
        magic, version, count = struct.unpack_from("<4sHI", buf, 0)
        self.assertEqual(magic, b"HRD1")
        self.assertEqual(version, 1)
        self.assertEqual(count, len(self.entities))
        record_size = struct.calcsize("<IBBBIIH")
        first = struct.unpack_from("<IBBBIIH", buf, 64)
        self.assertEqual(first[0], self.entities[0]["id"])
        string_table_at = 64 + count * record_size
        name_off = first[5]
        end = buf.index(b"\x00", string_table_at + name_off)
        name = buf[string_table_at + name_off:end].decode("utf-8")
        self.assertEqual(name, self.entities[0]["name"])
        total = string_table_at + sum(
            len(e["name"].encode("utf-8")) + 1
            for e in {x["name"]: x for x in self.entities}.values()
        )
        self.assertEqual(len(buf), total)

    def test_every_pack_coverage(self):
        for pack_path in sorted((PUBLIC / "packs").glob("pack_*.json")):
            pack = json.loads(pack_path.read_text(encoding="utf-8"))
            answers = pack["round1"]["answers"]
            self.assertGreaterEqual(len(answers), 25, pack_path.name)
            tiers = {a["tier"] for a in answers}
            self.assertEqual(tiers, {"CROWD_PLEASER", "DEEP_CUT"}, pack_path.name)
            self.assertEqual(len(pack["round2"]), 4, pack_path.name)
            zoom = [c for c in pack["round2"] if c["type"] == "ZOOM"]
            self.assertEqual(len(zoom), 1)
            bm = zoom[0]["bitmap"]
            self.assertEqual(len(bm), 16)
            self.assertTrue(all(len(r) == 16 for r in bm))
            self.assertIn(zoom[0]["answer"], zoom[0]["options"])
            self.assertEqual(len(zoom[0]["options"]), 4)
            self.assertTrue(pack["round3"]["wildcardA"])

    def test_trie_shards_match_aliases(self):
        aliases = json.loads(
            (PIPELINE / "output" / "aliases.json").read_text(encoding="utf-8")
        )
        self.assertGreater(len(aliases), 500)
        # spot-check the blueprint's own examples
        mc = json.loads((PUBLIC / "trie_shards" / "mc.json").read_text(encoding="utf-8"))
        self.assertIn("mc", mc["alias_map"])
        minecraft_id = mc["alias_map"]["mc"]
        self.assertEqual(mc["canonical"][str(minecraft_id)]["name"], "Minecraft")
        gta_shard = json.loads((PUBLIC / "trie_shards" / "gt.json").read_text(encoding="utf-8"))
        self.assertIn("gta", gta_shard["alias_map"])

    def test_daily_determinism(self):
        import datetime
        from daily import daily_for

        d = daily_for(datetime.date(2026, 11, 26), self.manifest["packs"])
        self.assertEqual(d["date"], "2026-11-26")
        self.assertEqual(d["packId"], d["seed"] % self.manifest["packs"])
        self.assertTrue(0 <= d["arenaTheme"] < 6)
        self.assertEqual(d, daily_for(datetime.date(2026, 11, 26), self.manifest["packs"]))


if __name__ == "__main__":
    unittest.main()
