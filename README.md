# Mahoraga

Adaptive web automation agent powered by [Browser Use](https://github.com/browser-use/browser-use).
Give it a task in plain English and it drives a real browser to complete it.

Mahoraga is a layered stack: an **n8n** workflow engine orchestrates tasks, the
**Mahoraga service** turns them into browser work, and a **BrowserOS kernel**
mediates every browser action down to Chrome / Edge / Firefox. You can use just
the CLI, or run the whole stack — see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

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

### The Wheel of Dharma — adaptive automation + console

Mahoraga incorporates n8n-style workflow automation natively as the **Wheel of
Dharma**: its memory of adaptations. The Wheel closes a loop —

```
recognize → (known?) replay a workflow  ·  (new?) improvise with the agent → crystallize
```

The first time Mahoraga solves a task it improvises (live agent). On success it
**crystallizes** the solve into a stored workflow. Next time it recognizes the
task and **replays** that workflow — deterministic, no LLM. It doesn't get hit
by the same thing twice.

Start the service and open the console at `http://localhost:8080/`:

```bash
mahoraga serve --host 0.0.0.0 --port 8080
```

The console is one cohesive surface: **Turn the Wheel** (run a task), the
**Workflow** canvas (an n8n-flavored node editor), and **Adaptations** (the
crystallized workflows). Workflow nodes: `navigate`, `extract`, `agent`,
`http`, `set`, `log`.

Service endpoints:

- `GET /health`
- `POST /v1/tasks` — one-shot browser task → `{ success, result, provider, model, kernel }`
- `POST /v1/wheel/run` — run through the Wheel → `{ path: replay|improvise, success, result, workflow_id, crystallized }`
- `GET/POST /v1/workflows`, `GET/DELETE /v1/workflows/{id}`, `POST /v1/workflows/{id}/run`

Set `MAHORAGA_API_KEY` to require an `X-API-Key` header on mutating endpoints.

### n8n workflow engine

The [`n8n-nodes-mahoraga`](integrations/n8n-nodes-mahoraga) community node adds a
**Mahoraga → Run Browser Task** step to n8n, so any workflow can dispatch an AI
browser task. The bundled [`docker-compose.yml`](docker-compose.yml) brings up
n8n + the service + a BrowserOS kernel together:

```bash
cd integrations/n8n-nodes-mahoraga && npm install && npm run build && cd -
export ANTHROPIC_API_KEY=...
docker compose up --build   # n8n at :5678, service at :8080
```

### BrowserOS kernel

Point Mahoraga at a running BrowserOS (or any CDP-speaking browser) and it
attaches over the DevTools Protocol instead of launching its own browser — the
kernel owns the browser lifecycle:

```bash
mahoraga --cdp-url http://localhost:9222 "Summarize my open tabs"
# or: export BROWSEROS_CDP_URL=http://localhost:9222
```

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
| `BROWSEROS_CDP_URL` / `MAHORAGA_CDP_URL` | `--cdp-url` | none (launch local) | Attach to a BrowserOS kernel over CDP |
| `MAHORAGA_API_KEY` | — | none | Require `X-API-Key` on the HTTP service |
| `MAHORAGA_WHEEL_DIR` | — | `~/.mahoraga/wheel` | Where crystallized workflows are stored |

If a system Chromium is found (e.g. a Playwright install or `/usr/bin/chromium`),
Mahoraga uses it instead of letting Browser Use download its own copy — handy in
containers and CI.
