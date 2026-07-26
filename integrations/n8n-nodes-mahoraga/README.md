# n8n-nodes-mahoraga

An [n8n](https://n8n.io) community node that runs **Mahoraga** AI browser-automation
tasks from inside a workflow. Each task is executed by [Browser Use](https://github.com/browser-use/browser-use)
and driven through a **BrowserOS kernel**.

This node turns "drive a browser and figure it out" into a single workflow step:
give it a plain-English task, get the agent's result back as JSON.

## Prerequisites

A running Mahoraga HTTP service (`mahoraga serve`, or the `mahoraga` service in
the repo's `docker-compose.yml`).

## Install

Community nodes (n8n **Settings → Community Nodes**):

```
n8n-nodes-mahoraga
```

Or build from source:

```bash
cd integrations/n8n-nodes-mahoraga
npm install
npm run build
```

Then point `N8N_CUSTOM_EXTENSIONS` at this folder, or `npm link` it into your
n8n installation.

## Credentials

**Mahoraga API**:

- **Base URL** — where the service is reachable (default `http://mahoraga:8080`,
  the service name in the bundled compose file).
- **API Key** — only needed if the service is started with `MAHORAGA_API_KEY`.
  Sent as the `X-API-Key` header.

## Node: Mahoraga → Run Browser Task

| Field | Description |
| --- | --- |
| Task | What the agent should do, in plain English |
| LLM Provider / Model | Override the service defaults |
| Max Steps | Step budget for the agent |
| Use Vision | Send screenshots to the LLM |
| BrowserOS Kernel CDP URL | Drive a specific kernel for this task |

The node returns the service response: `{ success, result, provider, model, kernel }`.
