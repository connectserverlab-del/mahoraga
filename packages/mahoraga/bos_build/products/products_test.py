#!/usr/bin/env python3
"""Golden tests for shipped product descriptors and define() conventions."""

import unittest

from bos_build.core.products import (
    LinuxProductIdentity,
    MacProductIdentity,
    ProductDescriptor,
    WindowsProductIdentity,
    _replacements,
    get_product_descriptor,
)
from bos_build.products import DEFAULT_PRODUCT_ID, PRODUCTS

MAHORAGA_AGENT_EXTENSION_ID = "bflpfmnmnokmjhmgnolecpppdbdophmk"
MAHORAGA_BUG_REPORTER_EXTENSION_ID = "adlpneommgkgeanpaekgoaolcpncohkf"
BROWSERCLAW_EXTENSION_ID = "pjimfkbpehlcllblajnpfamdfjhhlgkc"

EXPECTED_MAHORAGA = ProductDescriptor(
    id="mahoraga",
    gn_product="mahoraga",
    display_name="Mahoraga",
    dev_display_name="Mahoraga Dev",
    company_full_name="Mahoraga",
    company_short_name="Mahoraga",
    installer_full_name="Mahoraga Installer",
    dev_installer_full_name="Mahoraga Dev Installer",
    app_base_name="Mahoraga",
    artifact_prefix="Mahoraga",
    release_prefix="mahoraga",
    homepage_url="https://www.mahoraga.com/",
    support_url="https://docs.mahoraga.com/",
    bugtracker_url="https://github.com/connectserverlab-del/mahoraga/issues",
    summary="The open source agentic browser",
    description="Mahoraga is a privacy-focused web browser built on Chromium.",
    string_replacements=_replacements("Mahoraga"),
    required_extension_ids=(
        (MAHORAGA_AGENT_EXTENSION_ID, "Mahoraga agent"),
        (MAHORAGA_BUG_REPORTER_EXTENSION_ID, "Mahoraga bug reporter"),
    ),
    server_bundle_ids=("mahoraga-server",),
    mac=MacProductIdentity(
        bundle_id="com.mahoraga.Mahoraga",
        dev_bundle_id="com.mahoraga.dev.Mahoraga",
        signing_identifier="com.mahoraga.Mahoraga",
        dev_signing_identifier="com.mahoraga.dev.Mahoraga",
        framework_name="Mahoraga Framework.framework",
        dev_framework_name="Mahoraga Dev Framework.framework",
        dmg_volume_name="Mahoraga",
    ),
    linux=LinuxProductIdentity(
        package_name="mahoraga",
        launcher_name="mahoraga",
        desktop_id="mahoraga.desktop",
        icon_name="mahoraga",
        lib_dir="/usr/lib/mahoraga",
        appimage_dir="/opt/mahoraga",
        apparmor_profile_name="mahoraga",
        metainfo_id="mahoraga.desktop",
    ),
    windows=WindowsProductIdentity(
        app_user_model_id="Mahoraga.Mahoraga",
        installer_app_id="{5d8d08af-2df9-4da2-86c1-eac353a0ca32}",
    ),
)

EXPECTED_BROWSERCLAW = ProductDescriptor(
    id="browserclaw",
    gn_product="browserclaw",
    display_name="BrowserClaw",
    dev_display_name="BrowserClaw Dev",
    company_full_name="Mahoraga",
    company_short_name="Mahoraga",
    installer_full_name="BrowserClaw Installer",
    dev_installer_full_name="BrowserClaw Dev Installer",
    app_base_name="BrowserClaw",
    artifact_prefix="BrowserClaw",
    release_prefix="browserclaw",
    homepage_url="https://www.mahoraga.com/",
    support_url="https://docs.mahoraga.com/",
    bugtracker_url="https://github.com/connectserverlab-del/mahoraga/issues",
    summary="The open source browser for web agents",
    description="BrowserClaw is a Chromium-based browser for agent workflows.",
    string_replacements=_replacements("BrowserClaw"),
    required_extension_ids=(
        (BROWSERCLAW_EXTENSION_ID, "BrowserClaw app"),
        (MAHORAGA_BUG_REPORTER_EXTENSION_ID, "Mahoraga bug reporter"),
    ),
    server_bundle_ids=("browserclaw-server",),
    mac=MacProductIdentity(
        bundle_id="com.mahoraga.BrowserClaw",
        dev_bundle_id="com.mahoraga.dev.BrowserClaw",
        signing_identifier="com.mahoraga.BrowserClaw",
        dev_signing_identifier="com.mahoraga.dev.BrowserClaw",
        framework_name="BrowserClaw Framework.framework",
        dev_framework_name="BrowserClaw Dev Framework.framework",
        dmg_volume_name="BrowserClaw",
    ),
    linux=LinuxProductIdentity(
        package_name="browserclaw",
        launcher_name="browserclaw",
        desktop_id="browserclaw.desktop",
        icon_name="browserclaw",
        lib_dir="/usr/lib/browserclaw",
        appimage_dir="/opt/browserclaw",
        apparmor_profile_name="browserclaw",
        metainfo_id="browserclaw.desktop",
    ),
    windows=WindowsProductIdentity(
        app_user_model_id="Mahoraga.BrowserClaw",
        installer_app_id="{FA2AFFF8-647B-477C-A5D2-905BA8DB9B82}",
    ),
)


class DefineGoldenTest(unittest.TestCase):
    def test_mahoraga_matches_expected_descriptor(self):
        self.assertEqual(get_product_descriptor("mahoraga"), EXPECTED_MAHORAGA)

    def test_browserclaw_matches_expected_descriptor(self):
        self.assertEqual(get_product_descriptor("browserclaw"), EXPECTED_BROWSERCLAW)


class DefineBehaviorTest(unittest.TestCase):
    def _minimal(self, **overrides):
        return ProductDescriptor.define(
            id="acmefox",
            display_name="AcmeFox",
            windows_installer_guid="{00000000-0000-0000-0000-000000000000}",
            summary="s",
            description="d",
            **overrides,
        )

    def test_derivations_for_new_product(self):
        p = self._minimal()
        self.assertEqual(p.dev_display_name, "AcmeFox Dev")
        self.assertEqual(p.mac.bundle_id, "com.mahoraga.AcmeFox")
        self.assertEqual(p.mac.dev_bundle_id, "com.mahoraga.dev.AcmeFox")
        self.assertEqual(p.mac.framework_name, "AcmeFox Framework.framework")
        self.assertEqual(p.linux.lib_dir, "/usr/lib/acmefox")
        self.assertEqual(p.windows.app_user_model_id, "Mahoraga.AcmeFox")
        self.assertEqual(p.server_bundle_ids, ("acmefox-server",))
        self.assertEqual(p.release_prefix, "acmefox")
        self.assertEqual(p.required_extension_ids, ())

    def test_override_wins_over_derivation(self):
        p = self._minimal(artifact_prefix="Acme")
        self.assertEqual(p.artifact_prefix, "Acme")
        self.assertEqual(p.app_base_name, "AcmeFox")

    def test_unknown_override_raises(self):
        with self.assertRaisesRegex(TypeError, "Unknown ProductDescriptor override"):
            self._minimal(dmg_name="X")


class RegistryTest(unittest.TestCase):
    def test_registry_has_both_products_and_default(self):
        self.assertEqual(set(PRODUCTS), {"mahoraga", "browserclaw"})
        self.assertEqual(DEFAULT_PRODUCT_ID, "mahoraga")

    def test_unknown_product_raises(self):
        with self.assertRaisesRegex(ValueError, "Unknown build.product"):
            get_product_descriptor("netscape")


if __name__ == "__main__":
    unittest.main()
