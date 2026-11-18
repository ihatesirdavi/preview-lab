"""Catalog, security boundary, and real capture checks for DYNAMICS-002."""

import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]


class DynamicsPreviewTests(unittest.TestCase):
    def test_codename_and_owner_gates_are_retained(self):
        catalog = json.loads((ROOT / "previews" / "index.json").read_text(encoding="utf-8"))
        self.assertEqual(1, catalog["schema_version"])
        self.assertEqual({"signal-field", "dynamics-002"}, {item["id"] for item in catalog["previews"]})
        dynamics = next(item for item in catalog["previews"] if item["id"] == "dynamics-002")
        self.assertEqual("standalone-public", dynamics["classification"])
        self.assertEqual("prototype", dynamics["state"])
        self.assertEqual("passed", dynamics["checks"]["source"])
        self.assertEqual("passed", dynamics["checks"]["browser"])
        self.assertEqual("pending", dynamics["checks"]["owner_review"])
        self.assertEqual("not_packaged", dynamics["checks"]["packaging"])
        self.assertIn("browser_smoke.py", dynamics["browser_receipt"])

    def test_dynamics_page_reuses_site_without_private_modules(self):
        page = (ROOT / "docs" / "dynamics.html").read_text(encoding="utf-8")
        self.assertIn("DYNAMICS-002", page)
        self.assertIn('src="dynamics-core.js"', page)
        self.assertIn('src="dynamics.js"', page)
        self.assertIn('id="orbit-canvas"', page)
        for element in ('id="orbit-play"', 'id="orbit-pause"', 'id="orbit-stop"',
                        'id="energy-drift"', 'data-budget="quality"', 'data-budget="efficiency"'):
            self.assertIn(element, page)
        for prohibited in ("http://localhost", "127.0.0.1:", "private/repo", "remote/desktop"):
            self.assertNotIn(prohibited, page)

    def test_live_runtime_is_bounded_and_pausable(self):
        code = (ROOT / "docs" / "dynamics.js").read_text(encoding="utf-8")
        for term in ("MAX_WALL_MS=12000", "DT=.002", "visibilitychange",
                     "pagehide", "cancelAnimationFrame", "requestAnimationFrame",
                     "fps:60", "fps:30"):
            self.assertIn(term, code)
        for prohibited in ("fetch(", "XMLHttpRequest", "WebSocket", "localStorage"):
            self.assertNotIn(prohibited, code)

    def test_original_chrome_screenshot_exists_and_is_png(self):
        path = ROOT / "docs" / "dynamics-still.png"
        self.assertTrue(path.is_file())
        self.assertGreater(path.stat().st_size, 50000)
        self.assertEqual(b"\x89PNG\r\n\x1a\n", path.read_bytes()[:8])

    def test_index_links_to_second_study(self):
        page = (ROOT / "docs" / "index.html").read_text(encoding="utf-8")
        self.assertIn('href="dynamics.html"', page)
        self.assertIn('src="dynamics-still.png"', page)
        self.assertIn("DYNAMICS-002", page)


if __name__ == "__main__":
    unittest.main()