#!/usr/bin/env python3
"""
Mahoraga Build System - Main Entry Point

Unified CLI for building, developing, and releasing Mahoraga browser.

Usage:
    # As installed command:
    mahoraga build --help

    # As module:
    python -m bos_build.mahoraga build --help
"""
import typer

from .cli import build, dev, ext, ota, product, release, source

app = typer.Typer(
    help="Mahoraga Build System",
    pretty_exceptions_enable=False,
    pretty_exceptions_show_locals=False,
)

build_app = typer.Typer(
    pretty_exceptions_enable=False,
    pretty_exceptions_show_locals=False,
)
build_app.callback(invoke_without_command=True)(build.main)

app.add_typer(build_app, name="build", help="Build Mahoraga browser")
app.add_typer(source.app, name="source", help="Chromium checkout provisioning")
app.add_typer(product.app, name="product", help="Product definitions")
app.add_typer(dev.app, name="dev", help="Dev patch management")
app.add_typer(release.app, name="release", help="Release automation")
app.add_typer(ext.app, name="ext", help="Extension packaging & release")
app.add_typer(ota.app, name="ota", help="OTA update automation")


if __name__ == "__main__":
    app()
