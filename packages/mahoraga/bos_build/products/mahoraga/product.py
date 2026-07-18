#!/usr/bin/env python3
"""Mahoraga — the flagship product."""

from pathlib import Path

from ...core.products import (
    MAHORAGA_AGENT_EXTENSION_ID,
    MAHORAGA_BUG_REPORTER_EXTENSION_ID,
    ProductDescriptor,
)
from ..server_binaries import ServerBundle, SignSpec

MAHORAGA_PRODUCT = ProductDescriptor.define(
    id="mahoraga",
    display_name="Mahoraga",
    windows_installer_guid="{5d8d08af-2df9-4da2-86c1-eac353a0ca32}",
    summary="The open source agentic browser",
    description="Mahoraga is a privacy-focused web browser built on Chromium.",
    required_extensions=(
        (MAHORAGA_AGENT_EXTENSION_ID, "Mahoraga agent"),
        (MAHORAGA_BUG_REPORTER_EXTENSION_ID, "Mahoraga bug reporter"),
    ),
)

MAHORAGA_SERVER_BUNDLE = ServerBundle(
    id="mahoraga-server",
    name="Mahoraga Server",
    product_ids=("mahoraga",),
    chromium_output_root="MahoragaServer",
    local_resources_root=Path("resources/binaries/mahoraga_server"),
    chromium_resources_root=Path("chrome/browser/mahoraga/server/resources"),
    macos_bundle_resources_root=Path(
        "Contents/Resources/MahoragaServer/default/resources"
    ),
    windows_bundle_resources_root=Path("MahoragaServer/default/resources"),
    macos_binaries={
        "mahoraga_server": SignSpec(
            "mahoraga_server", "runtime", "mahoraga-executable-entitlements.plist"
        ),
        "bun": SignSpec("bun", "runtime", "mahoraga-executable-entitlements.plist"),
        "rg": SignSpec("rg", "runtime"),
    },
    windows_binaries=("mahoraga_server.exe",),
)
