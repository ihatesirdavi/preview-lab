"""Behavioral contract for the public preview catalog."""

import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from validate_preview import validate


class PreviewCatalogTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        (self.root / "previews").mkdir()
        (self.root / "docs").mkdir()
        (self.root / "docs" / "index.html").write_text("<html lang='en'></html>", encoding="utf-8")
        self.data = {
            "schema_version": 1,
            "previews": [{
                "id": "signal-field",
                "title": "Signal Field",
                "asset": "docs/index.html",
                "classification": "standalone-public",
                "state": "prototype",
                "checks": {
                    "source": "passed",
                    "browser": "not_run",
                    "owner_review": "pending",
                    "packaging": "not_packaged"
                }
            }]
        }

    def run_validation(self):
        (self.root / "previews" / "index.json").write_text(json.dumps(self.data), encoding="utf-8")
        return validate(self.root)

    def test_valid_preview(self):
        self.assertEqual([], self.run_validation())

    def test_rejects_path_escape(self):
        self.data["previews"][0]["asset"] = "../private/internal.txt"
        self.assertTrue(self.run_validation())

    def test_rejects_absolute_path(self):
        self.data["previews"][0]["asset"] = "/etc/passwd"
        self.assertTrue(self.run_validation())

    def test_rejects_missing_asset(self):
        self.data["previews"][0]["asset"] = "docs/absent.html"
        self.assertTrue(self.run_validation())

    def test_rejects_duplicate_ids(self):
        self.data["previews"].append(dict(self.data["previews"][0]))
        self.assertTrue(self.run_validation())

    def test_rejects_unsupported_state(self):
        self.data["previews"][0]["state"] = "production-ready"
        self.assertTrue(self.run_validation())

    def test_rejects_claimed_owner_review_without_receipt(self):
        self.data["previews"][0]["checks"]["owner_review"] = "passed"
        self.assertTrue(self.run_validation())

    def test_rejects_nonpublic_classification(self):
        self.data["previews"][0]["classification"] = "private-mirror"
        self.assertTrue(self.run_validation())

    def test_rejects_unknown_fields(self):
        self.data["previews"][0]["internal_endpoint"] = "http://local.invalid"
        self.assertTrue(self.run_validation())


if __name__ == "__main__":
    unittest.main()
