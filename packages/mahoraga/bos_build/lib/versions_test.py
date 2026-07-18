#!/usr/bin/env python3
"""Tests for version parsing and derivation."""

import tempfile
import unittest
from pathlib import Path

from bos_build.lib import versions


class VersionsTest(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name)

    def test_chromium_version_parses_pin_file(self):
        (self.root / "CHROMIUM_VERSION").write_text(
            "MAJOR=148\nMINOR=0\nBUILD=7402\nPATCH=57\n"
        )
        version, parts = versions.load_chromium_version(self.root)
        self.assertEqual(version, "148.0.7402.57")
        self.assertEqual(parts["BUILD"], "7402")

    def test_chromium_version_missing_file_is_empty(self):
        self.assertEqual(versions.load_chromium_version(self.root), ("", {}))

    def test_build_offset(self):
        offset_file = self.root / "bos_build" / "config" / "MAHORAGA_BUILD_OFFSET"
        offset_file.parent.mkdir(parents=True)
        offset_file.write_text("80\n")
        self.assertEqual(versions.load_build_offset(self.root), "80")

    def test_semantic_version_patch_only_when_nonzero(self):
        res = self.root / "resources"
        res.mkdir()
        f = res / "MAHORAGA_VERSION"

        f.write_text(
            "MAHORAGA_MAJOR=0\nMAHORAGA_MINOR=31\nMAHORAGA_BUILD=0\nMAHORAGA_PATCH=0\n"
        )
        self.assertEqual(versions.load_semantic_version(self.root), "0.31.0")

        f.write_text(
            "MAHORAGA_MAJOR=0\nMAHORAGA_MINOR=31\nMAHORAGA_BUILD=2\nMAHORAGA_PATCH=0\n"
        )
        self.assertEqual(versions.load_semantic_version(self.root), "0.31.2")

        f.write_text(
            "MAHORAGA_MAJOR=0\nMAHORAGA_MINOR=31\nMAHORAGA_BUILD=2\nMAHORAGA_PATCH=5\n"
        )
        self.assertEqual(versions.load_semantic_version(self.root), "0.31.2.5")

    def test_mahoraga_chromium_version_adds_offset_to_build(self):
        parts = {"MAJOR": "148", "MINOR": "0", "BUILD": "7402", "PATCH": "57"}
        self.assertEqual(
            versions.derive_mahoraga_chromium_version(parts, "80"),
            "148.0.7482.57",
        )
        self.assertEqual(versions.derive_mahoraga_chromium_version({}, "80"), "")
        self.assertEqual(versions.derive_mahoraga_chromium_version(parts, ""), "")

    def test_mahoraga_version_parts_parsed_as_ints(self):
        res = self.root / "resources"
        res.mkdir(exist_ok=True)
        (res / "MAHORAGA_VERSION").write_text(
            "MAHORAGA_MAJOR=0\nMAHORAGA_MINOR=47\nMAHORAGA_BUILD=0\nMAHORAGA_PATCH=2\n"
        )
        self.assertEqual(
            versions.load_mahoraga_version_parts(self.root), (0, 47, 0, 2)
        )
        self.assertEqual(versions.load_mahoraga_version_parts(self.root / "x"), ())

    def test_update_feed_version_is_epoch_prefixed(self):
        # parity with main's update-feed scheme (PR #1496)
        self.assertEqual(
            versions.update_feed_version((0, 47, 0, 2)), "10000.0.47.0.2"
        )
        with self.assertRaises(ValueError):
            versions.update_feed_version(())


if __name__ == "__main__":
    unittest.main()
