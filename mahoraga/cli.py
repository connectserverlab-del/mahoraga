"""Mahoraga command-line interface.

Usage:
    mahoraga run "Find the top 3 trending Python repos on GitHub"
    mahoraga "Fill out the demo form at ..."          # 'run' is implied
    mahoraga --provider openai --model gpt-5.5 "Compare prices for ..."
    mahoraga serve --host 0.0.0.0 --port 8080         # HTTP service for n8n
"""

from __future__ import annotations

import argparse
import sys

from dotenv import load_dotenv

from mahoraga.config import DEFAULT_MODELS, Settings

_SUBCOMMANDS = {"run", "serve"}


def _add_run_arguments(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("task", help="What the agent should do, in plain English")
    parser.add_argument(
        "--provider",
        choices=sorted(DEFAULT_MODELS),
        help="LLM provider (default: auto-detected from available API keys)",
    )
    parser.add_argument("--model", help="Model name (default: provider-specific)")
    parser.add_argument("--max-steps", type=int, help="Maximum agent steps (default: 50)")
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
    parser.add_argument("--chromium-path", help="Path to a Chromium/Chrome binary to use")
    parser.add_argument(
        "--cdp-url",
        help="Attach to a BrowserOS kernel at this CDP URL instead of launching a browser",
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="mahoraga",
        description="Adaptive web automation, driven through a BrowserOS kernel.",
    )
    sub = parser.add_subparsers(dest="command")

    run_parser = sub.add_parser("run", help="Run a single browser task")
    _add_run_arguments(run_parser)

    serve_parser = sub.add_parser("serve", help="Start the HTTP service (for n8n, etc.)")
    serve_parser.add_argument("--host", default="0.0.0.0", help="Bind host (default: 0.0.0.0)")
    serve_parser.add_argument("--port", type=int, default=8080, help="Bind port (default: 8080)")

    return parser


def _settings_from_run_args(args: argparse.Namespace) -> Settings:
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
    if args.cdp_url:
        settings.cdp_url = args.cdp_url
    return settings.resolve()


def _run(args: argparse.Namespace) -> int:
    settings = _settings_from_run_args(args)
    kernel = settings.cdp_url or "local browser"
    print(
        f"mahoraga: provider={settings.provider} model={settings.model} kernel={kernel}",
        file=sys.stderr,
    )
    from mahoraga.engine import run_task

    result = run_task(args.task, settings)
    if result is None:
        print("mahoraga: agent finished without a final result", file=sys.stderr)
        return 1
    print(result)
    return 0


def main(argv: list[str] | None = None) -> int:
    load_dotenv()
    raw = list(sys.argv[1:] if argv is None else argv)
    # Make 'run' the default: if the first token isn't a subcommand or -h, imply it.
    if raw and raw[0] not in _SUBCOMMANDS and raw[0] not in ("-h", "--help"):
        raw = ["run", *raw]

    args = build_parser().parse_args(raw)
    if args.command == "serve":
        from mahoraga.server import serve

        serve(host=args.host, port=args.port)
        return 0
    if args.command == "run":
        return _run(args)

    build_parser().print_help()
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
