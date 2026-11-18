"""Source and captured-evidence checks for a standalone public visual."""

from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]


class PublicPreviewSourceTests(unittest.TestCase):
    def test_browser_capture_is_png(self):
        path = ROOT / "docs" / "preview-still.png"
        self.assertTrue(path.is_file())
        self.assertGreater(path.stat().st_size, 30000)
        self.assertEqual(b"\x89PNG\r\n\x1a\n", path.read_bytes()[:8])

    def test_interface_has_bounded_playback_controls(self):
        html = (ROOT / "docs" / "index.html").read_text(encoding="utf-8")
        script = (ROOT / "docs" / "site.js").read_text(encoding="utf-8")
        for term in ('id="field"', 'id="play"', 'id="pause"', 'id="stop"', 'aria-live="polite"', "SIGNAL-001"):
            self.assertIn(term, html)
        for term in ('MAX_DURATION_MS = 12000', 'FRAME_MS = 1000/30', "visibilitychange", "cancelAnimationFrame", "prefers-reduced-motion"):
            self.assertIn(term, script)
        for term in ("fetch(", "XMLHttpRequest", "WebSocket", "localStorage"):
            self.assertNotIn(term, script)

    def test_no_private_project_name_in_public_readme(self):
        text = (ROOT / "README.md").read_text(encoding="utf-8")
        self.assertIn("I code sometimes.", text)
        self.assertIn("SIGNAL-001", text)
        self.assertIn("owner", text.lower())


if __name__ == "__main__":
    unittest.main()