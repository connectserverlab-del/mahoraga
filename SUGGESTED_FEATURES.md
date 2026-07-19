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

## 9. Workflow Marketplace
A community hub for sharing and installing agent workflows ("book flights", "triage GitHub
issues", "collect invoices"). Workflows are signed, sandboxed, reviewed like extensions,
and declare exactly which domains and capabilities they need before install.

## 10. Per-Site Agent Permissions
A capability sandbox for the agent, modeled on site permissions: per-domain rules for what
the agent may read, click, submit, or purchase. A "requires approval" tier pauses the agent
before sensitive actions like payments, logins, or sending messages.

## 11. Research Mode
Select any number of tabs and ask one question across all of them. The agent reads every
page, synthesizes an answer with inline citations that link back to the exact passage, and
can export the result as Markdown or a shareable page.

## 12. Page Watchers
Point the agent at any region of a page — a price, a stock status, a changelog — and it
monitors for changes in the background, with smart diffing that ignores noise and notifies
only on meaningful change. A lighter-weight sibling of Scheduled Autonomous Runs.

## 13. Form Autopilot with Local Vault
A local encrypted vault of structured personal data (addresses, company details, travel
documents). The agent fills long forms end-to-end, shows a review diff before submitting,
and never sends vault contents to a cloud model.

## 14. Voice Control
Push-to-talk browsing: speak a task, watch the agent do it. Uses local speech-to-text where
available, with the same permission model as typed prompts.

## 15. Smart Tab Triage
One click to have the agent cluster, label, and collapse a wall of open tabs into named
groups — with a "close what I'll never come back to" suggestion list you approve in bulk.

## 16. Agent Time Machine
Automatic lightweight snapshots of browsing sessions before an agent run touches them, so
any automated action on your open tabs can be rolled back to the pre-run state.
