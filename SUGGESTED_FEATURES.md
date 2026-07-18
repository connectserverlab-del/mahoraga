# Mahoraga — Suggested Features

Mahoraga is named after the wheel that adapts to anything. These proposed features lean into
that theme: a browser whose agent adapts to every site, workflow, and user.

## 1. Adaptive Site Memory
When the agent completes a task on a site, it stores a local, replayable "adaptation" —
selectors, navigation paths, and quirks it learned. The next run on that site skips
exploration and executes directly, getting faster and more reliable with every use.
All adaptations stay on-device.

## 2. Multi-Tab Agent Orchestration
Run several agents in parallel across tabs (e.g. compare prices on four stores at once),
with a single orchestrator pane showing live progress, per-tab status, and a merged result.

## 3. Prompt-to-Workflow Builder
Turn any successful agent run into a saved workflow with typed inputs ("book a table for
{party_size} at {time}"). Workflows can be re-run from the omnibox, scheduled, or shared
as portable JSON.

## 4. Watch-and-Replay Timeline
Every agent action is recorded as a scrubbable timeline — DOM snapshots, clicks, and
reasoning steps. Users can rewind, fork from any step, or hand control back to the agent
mid-run.

## 5. Local-First Model Routing
An adaptive router that sends simple steps (classification, extraction) to a local model
via Ollama and escalates only complex planning steps to a cloud model — cutting cost and
keeping page content local whenever possible.

## 6. Privacy Dashboard
A per-site view of exactly what the agent read, what left the device, and which model saw
it — with one-click redaction rules (e.g. never send numbers matching a card pattern).

## 7. Scheduled Autonomous Runs
Cron-style background tasks: "check this listing daily and alert me if the price drops."
Runs execute in an isolated profile with results delivered to a local inbox.

## 8. Cross-Device Encrypted Sync
End-to-end encrypted sync of workflows, adaptations, and agent settings between machines —
no server-side plaintext, compatible with self-hosted sync targets.
