# Mahoraga

Adaptive web automation agent powered by [Browser Use](https://github.com/browser-use/browser-use).
Give it a task in plain English and it drives a real Chromium browser to complete it.

## Setup

Requires Python 3.11+.

```bash
# with uv (recommended)
uv venv && source .venv/bin/activate
uv pip install -e .

# or with pip
python -m venv .venv && source .venv/bin/activate
pip install -e .
```

Copy `.env.example` to `.env` and set at least one LLM API key (Anthropic,
OpenAI, Google, Browser Use cloud, Groq, or a local Ollama host).

## Usage

### CLI

```bash
mahoraga "Find the number of stars of the browser-use repo"

# pick a provider/model explicitly
mahoraga --provider anthropic --model claude-sonnet-5 "Compare prices for ..."

# watch the browser while it works
mahoraga --headed "Fill out the contact form on example.com"
```

The agent's final answer is printed to stdout, so it composes with shell
pipelines; progress logs go to stderr.

### Python API

```python
from mahoraga import Settings, run_task

result = run_task(
    "Find the top 3 trending Python repos on GitHub and list their names",
    Settings(provider="anthropic", max_steps=30),
)
print(result)
```

## Configuration

Every setting is an environment variable (loadable from `.env`) with a
matching CLI flag:

| Env var | CLI flag | Default | Meaning |
| --- | --- | --- | --- |
| `MAHORAGA_LLM_PROVIDER` | `--provider` | auto-detected from API keys | `anthropic`, `openai`, `google`, `browser-use`, `groq`, `ollama` |
| `MAHORAGA_MODEL` | `--model` | per-provider default | Model name |
| `MAHORAGA_HEADLESS` | `--headed` (inverts) | `true` | Run Chromium without a window |
| `MAHORAGA_MAX_STEPS` | `--max-steps` | `50` | Step budget per task |
| `MAHORAGA_USE_VISION` | `--no-vision` (inverts) | `true` | Send screenshots to the LLM |
| `MAHORAGA_CHROMIUM_PATH` | `--chromium-path` | auto-detected | Chromium/Chrome binary to use |

If a system Chromium is found (e.g. a Playwright install or `/usr/bin/chromium`),
Mahoraga uses it instead of letting Browser Use download its own copy — handy in
containers and CI.
