#!/usr/bin/env python3
"""Tests for mcp/mavedb_provider.py. Run: npm run test:mavedb."""

import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "mcp"))

import mavedb_provider as mv  # noqa: E402

CSV = """accession,hgvs_nt,hgvs_splice,hgvs_pro,score,std,uniqueBarcodes
urn:test#1,NA,NA,p.[Ala1Gly;Asp3Glu],1.0,NA,2
urn:test#2,NA,NA,p.Ala1Val,2.0,NA,1
urn:test#3,NA,NA,p.Asp3Ala,3.0,NA,1
urn:test#4,NA,NA,p.Glu5Asp,4.0,NA,1
urn:test#5,NA,NA,p.=,5.0,NA,1
urn:test#6,NA,NA,NA,6.0,NA,1
"""

SEQUENCE = "ACDEFGHIKLMNPQRSTVWY"


class MaveDBTests(unittest.TestCase):
    def test_hgvs_parsing(self):
        self.assertEqual(len(mv.parse_hgvs_pro("p.[Tyr91Phe;Lys130Arg]")), 2)
        one = mv.parse_hgvs_pro("p.(Ala1Gly)")
        self.assertEqual(one, [{"pos": 1, "wt": "A", "mut": "G"}])
        self.assertEqual(mv.parse_hgvs_pro("p."), [])
        self.assertEqual(mv.parse_hgvs_pro("NA"), [])

    def test_csv_parsing(self):
        rows = mv.parse_scores_csv(CSV)
        self.assertEqual(len(rows), 4)
        self.assertEqual(len(rows[0]["substitutions"]), 2)

    def test_combined_residues(self):
        rows = mv.parse_scores_csv(CSV)
        result = mv.combined_residues(rows, SEQUENCE, weights={"coverage": 0.3, "effect": 0.4, "deleterious": 0.3}, window=3, min_variants=1)
        self.assertTrue(result["ok"])
        self.assertEqual(result["sequence_length"], 20)
        self.assertEqual(result["rows"], 4)
        self.assertAlmostEqual(result["residues"][0]["coverage"], 2 / 19.0, places=6)
        self.assertEqual(result["residues"][0]["n"], 2)
        self.assertTrue(result["top_clusters"])
        self.assertGreater(result["top_clusters"][0]["score"], 0)
        self.assertIn("Top cluster", result["summary"])

    def test_weight_normalization(self):
        weights = mv.normalize_weights({"coverage": 1, "effect": 1, "deleterious": 2})
        self.assertAlmostEqual(sum(weights.values()), 1.0, places=6)
        self.assertAlmostEqual(weights["deleterious"], 0.5, places=6)

    def test_translate_and_align(self):
        self.assertEqual(mv.translate_dna("ATGAGCAAAGGC"), "MSKG")
        mapping, ratio = mv.align_positions("SKGE", "MSKGE")
        self.assertEqual(mapping.get(1), 2)
        self.assertEqual(mapping.get(4), 5)
        self.assertGreater(ratio, 0.8)

    def test_cache_only(self):
        with tempfile.TemporaryDirectory(prefix="mavedb-") as tmp:
            cache = Path(tmp)
            csv_path = cache / (mv._safe_name(mv.DEFAULT_URN) + ".csv")
            csv_path.write_text(CSV, encoding="utf-8")
            (cache / (mv._safe_name(mv.DEFAULT_URN) + ".json")).write_text(
                json.dumps({"title": "Test GFP", "numVariants": 4, "license": {"shortName": "CC0"}}),
                encoding="utf-8",
            )
            result = mv.analyze_mavedb(sequence=SEQUENCE, cache_dir=cache, cache_only=True, min_variants=1)
            self.assertTrue(result["ok"])
            self.assertEqual(result["title"], "Test GFP")
            self.assertEqual(result["license"], "CC0")
            self.assertTrue(result["top_clusters"])

    def test_mismatch_reporting(self):
        rows = mv.parse_scores_csv(CSV)
        result = mv.combined_residues(rows, "M" * 20, min_variants=1, window=3)
        self.assertTrue(result["ok"])
        self.assertGreater(result["wt_mismatches"], 0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
