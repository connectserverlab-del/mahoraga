# Mahoraga architecture

Mahoraga is organized as a layered stack. The **workflow engine** decides *what*
to do, the **service** turns intents into browser tasks, and the **BrowserOS
kernel** is the single boundary through which every browser action passes down
to a real browser.

```
┌─────────────────────────────────────────────────────────────┐
│  Product surface (roadmap)                                    │
│  Personal Memory · Projects · Knowledge Graph · AI Employees  │
│  Marketplace · Automation Library · Permissions · Analytics   │
├─────────────────────────────────────────────────────────────┤
│  Workflow Engine (n8n)  ·  Planner · Task Queue · Scheduler   │
│      └─ custom node: n8n-nodes-mahoraga                        │
├─────────────────────────────────────────────────────────────┤
│  Mahoraga service  (FastAPI)                                  │
│      POST /v1/tasks → Browser Use Agent                        │
├─────────────────────────────────────────────────────────────┤
│  BrowserOS  (kernel)   ← CDP boundary                          │
├─────────────────────────────────────────────────────────────┤
│  Chrome / Edge / Firefox                                      │
└─────────────────────────────────────────────────────────────┘
```

## Layers implemented today

### Workflow Engine — n8n
[n8n](https://github.com/n8n-io/n8n) is run as a service (not vendored). Mahoraga
ships a community node, [`n8n-nodes-mahoraga`](../integrations/n8n-nodes-mahoraga),
that adds a **Mahoraga → Run Browser Task** step. Any workflow can now include an
AI browser task alongside its other nodes; the Planner / Task Queue / Scheduler
roles in the diagram are n8n's own triggers, queue mode, and cron.

The node calls the Mahoraga service over HTTP using the **Mahoraga API**
credential (base URL + optional `X-API-Key`).

### Service — Mahoraga
A small FastAPI app ([`mahoraga/server.py`](../mahoraga/server.py)):

- `GET /health` — liveness.
- `POST /v1/tasks` — run one natural-language browser task and return
  `{ success, result, provider, model, kernel }`.

It resolves per-request overrides (provider, model, steps, vision, kernel),
then hands off to the Browser Use `Agent`.

### Kernel — BrowserOS
[BrowserOS](https://github.com/browseros-ai/BrowserOS) is a Chromium-based
agentic browser. Because it is Chromium-based it exposes a **Chrome DevTools
Protocol** endpoint, and that endpoint is the kernel boundary: when
`BROWSEROS_CDP_URL` (or `MAHORAGA_CDP_URL`) is set, the engine
([`mahoraga/engine.py`](../mahoraga/engine.py)) **attaches** to the running
BrowserOS over CDP with `is_local=False` and never launches or kills a browser
itself. Every page navigation, click, and extraction the agent performs is
mediated by BrowserOS, which in turn drives Chrome / Edge / Firefox.

Without a kernel configured, the engine falls back to launching a local
Chromium — useful for development, but the kernel path is the intended
production topology.

## Why n8n is integrated, not vendored

n8n is a large, independently released monorepo. Copying it into this repo would
be unmaintainable and would fork us off upstream security updates. The supported
extension model is a **community node**, so that is what Mahoraga provides. You
run stock n8n (via the bundled `docker-compose.yml` or your own) and drop in the
Mahoraga node.

## Running the stack

```bash
# 1. Build the n8n node
cd integrations/n8n-nodes-mahoraga && npm install && npm run build && cd -

# 2. Bring up kernel + service + engine
export ANTHROPIC_API_KEY=...        # or OPENAI_API_KEY / GOOGLE_API_KEY
docker compose up --build
```

- n8n UI: http://localhost:5678 — add the **Mahoraga API** credential
  (base URL `http://mahoraga:8080`) and use the **Mahoraga** node.
- Service: http://localhost:8080/health
- Kernel: the `browseros` container's CDP endpoint (`http://browseros:9222`).

Swap the `browseros` service image for a real BrowserOS image to use the full
agentic browser as the kernel.
