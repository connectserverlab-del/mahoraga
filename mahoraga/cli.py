"""Mahoraga command-line interface.

Usage:
    mahoraga "Find the top 3 trending Python repos on GitHub"
    mahoraga --provider openai --model gpt-5.5 "Fill out the demo form at ..."
"""

from __future__ import annotations

import argparse
import sys

from dotenv import load_dotenv

from mahoraga.config import DEFAULT_MODELS, Settings


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="mahoraga",
        description="Run a natural-language web automation task with Browser Use.",
    )
    parser.add_argument("task", help="What the agent should do, in plain English")
    parser.add_argument(
        "--provider",
        choices=sorted(DEFAULT_MODELS),
        help="LLM provider (default: auto-detected from available API keys)",
    )
    parser.add_argument("--model", help="Model name (default: provider-specific)")
    parser.add_argument(
        "--max-steps", type=int, help="Maximum agent steps (default: 50)"
    )
    parser.add_argument(
        "--headed",
        action="store_true",
        help="Show the browser window instead of running headless",
    )
    parser.add_argument(
        "--no-vision",
        action="store_true",
        help="Disable screenshots being sent to the LLM (cheaper, less capable)",
    )
    parser.add_argument(
        "--chromium-path", help="Path to a Chromium/Chrome binary to use"
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    load_dotenv()
    args = build_parser().parse_args(argv)

    settings = Settings()
    if args.provider:
        settings.provider = args.provider
    if args.model:
        settings.model = args.model
    if args.max_steps:
        settings.max_steps = args.max_steps
    if args.headed:
        settings.headless = False
    if args.no_vision:
        settings.use_vision = False
    if args.chromium_path:
        settings.chromium_path = args.chromium_path
    settings.resolve()

    print(f"mahoraga: provider={settings.provider} model={settings.model}", file=sys.stderr)

    from mahoraga.engine import run_task

    result = run_task(args.task, settings)
    if result is None:
        print("mahoraga: agent finished without a final result", file=sys.stderr)
        return 1
    print(result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
