# mahoraga-cli

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](../../../../LICENSE)

Command-line interface for controlling Mahoraga — launch and automate the browser from the terminal or from AI coding agents like Claude Code and Gemini CLI. The installed `bos` command is a short alias for `mahoraga-cli`.

Communicates with the Mahoraga MCP server over JSON-RPC 2.0 / StreamableHTTP and maps the core Mahoraga automation tools to CLI commands.

## Install

### macOS / Linux

```bash
curl -fsSL https://cdn.mahoraga.com/cli/install.sh | bash
```

### Windows

```powershell
irm https://cdn.mahoraga.com/cli/install.ps1 | iex
```

### Build from Source

Requires Go 1.25+.

```bash
make            # Build binary
make install    # Install to $GOPATH/bin
```

## Quick Start

```bash
# If Mahoraga is not installed yet, download it from https://mahoraga.com

# If Mahoraga is installed but not running
mahoraga-cli launch                 # opens Mahoraga, waits for server

# Configure the CLI with the Server URL from Mahoraga settings
mahoraga-cli init http://127.0.0.1:9000/mcp

# Verify connection
mahoraga-cli health
```

## Agent workflow

Run `mahoraga-cli --llm-txt` for a concise, copy-pasteable agent guide to the whole CLI (printed
from the binary, so it always matches the installed version).

Agents should capture a page id from `open` or `tabs`, then pass it explicitly with `-p`.

```bash
page=$(mahoraga-cli open --json https://example.com | jq -r .page)
mahoraga-cli -p "$page" snapshot
mahoraga-cli -p "$page" read --links
mahoraga-cli -p "$page" find text "Search" click
mahoraga-cli -p "$page" press Enter
mahoraga-cli -p "$page" snapshot
mahoraga-cli -p "$page" close
```

### Other init modes

```bash
mahoraga-cli init <url>             # non-interactive — pass URL directly
mahoraga-cli init                   # interactive — prompts for URL
```

Config is saved to `~/.config/mahoraga-cli/config.yaml`. If `mahoraga-cli health` cannot connect, copy the current Server URL from Mahoraga Settings > Mahoraga MCP and run `mahoraga-cli init <Server URL>` again.

### CLI updates

The CLI checks for a newer Mahoraga CLI release in the background about once per day and will suggest an update on a later run when one is available.

```bash
mahoraga-cli update         # check and apply the latest CLI release
mahoraga-cli update --check # check only
mahoraga-cli update --yes   # apply without prompting
```

### Release flow

CLI releases are cut from annotated git tags. The tag is the source of truth for the release version; do not commit a version bump or add a checked-in version file.

```bash
git tag -a cli/v0.2.3 -m "mahoraga-cli v0.2.3"
git push origin cli/v0.2.3
```

Pushing `cli/vX.Y.Z` starts the CLI release workflow. The workflow rejects tags that are not newer than production latest or whose target commit is not reachable from the repository default branch.

The `NPM_TOKEN` release secret must authenticate as an npm owner of `mahoraga-cli`; the workflow checks this before uploading CDN assets or creating the GitHub release.

Inspect versions with:

```bash
mahoraga-cli --version
curl -fsSL https://cdn.mahoraga.com/cli/latest/version.txt
curl -fsSL https://cdn.mahoraga.com/cli/latest/manifest.json
git tag -l 'cli/v*' --sort=-v:refname
git tag -l 'mahoraga-cli-v*' --sort=-v:refname
```

## Usage

```bash
# Check connection
mahoraga-cli health
mahoraga-cli status

# Tabs
mahoraga-cli tabs                  # List all tabs
mahoraga-cli active                # Show active tab
mahoraga-cli open --json https://example.com
mahoraga-cli -p 42 close

# Navigation
mahoraga-cli -p 42 nav https://example.com
mahoraga-cli -p 42 back
mahoraga-cli -p 42 forward
mahoraga-cli -p 42 reload

# Observation
mahoraga-cli -p 42 snapshot        # Accessibility tree snapshot
mahoraga-cli -p 42 read            # Extract page as markdown
mahoraga-cli -p 42 read --links    # Extract all links
mahoraga-cli -p 42 grep "Submit"   # Search snapshot lines
mahoraga-cli -p 42 eval "document.title" # Run JavaScript

# Input
mahoraga-cli -p 42 click @e5       # Click element by ref
mahoraga-cli -p 42 click-at 100 200
mahoraga-cli -p 42 fill @e12 "hello"
mahoraga-cli -p 42 press Enter
mahoraga-cli -p 42 type "hello"
mahoraga-cli -p 42 find role button --name "Submit" click
mahoraga-cli -p 42 hover @e3
mahoraga-cli -p 42 scroll down 500

# Screenshots & export
mahoraga-cli -p 42 screenshot
mahoraga-cli -p 42 screenshot -o shot.png
mahoraga-cli -p 42 pdf page.pdf

# Batch multiple steps through one MCP session
mahoraga-cli -p 42 batch --bail "find role searchbox fill query" "press Enter"

# Resource management (grouped commands)
mahoraga-cli window list
mahoraga-cli bookmark search "github"
mahoraga-cli history recent
mahoraga-cli group list
```

`batch` supports page-scoped browser steps that map directly to MCP calls: `nav`, `back`, `forward`, `reload`, `eval`, `snapshot`, `read`, `grep`, `find`, `click`, `fill`, `press`, `type`, `hover`, `check`, `uncheck`, `focus`, and `select`.

## Use as MCP Server

Mahoraga exposes an MCP server that AI coding agents can connect to directly. The CLI is the easiest way to verify the connection and interact with tools from the terminal.

To connect Claude Code, Gemini CLI, or any MCP client, see the [MCP setup guide](https://docs.mahoraga.com/features/use-with-claude-code).

## Global Flags

| Flag | Env Var | Description |
|------|---------|-------------|
| `--server, -s` | `MAHORAGA_URL` | Server URL (default: from config) |
| `--page, -p` | | Required page ID for page-scoped commands |
| `--json` | `BOS_JSON=1` | JSON output (outputs structuredContent) |
| `--debug` | `BOS_DEBUG=1` | Debug output |
| `--timeout, -t` | | Request timeout (default: 2m) |

Priority for server URL: `--server` flag > `MAHORAGA_URL` env > config file

If no server URL is configured, the CLI exits with setup instructions pointing to `launch` and `init <Server URL>`.

## Testing

Integration tests require a running Mahoraga server with the dev build (for structured content support).

```bash
# 1. Start the dev server from the monorepo root
bun run dev:watch:new

# 2. Configure the CLI to point at the dev server
./mahoraga-cli init
# Enter the Server URL shown in Mahoraga settings

# 3. Run integration tests
make test

# Or with a custom server URL
MAHORAGA_URL=http://127.0.0.1:9105 go test -tags integration -v ./...
```

Tests skip gracefully if no server is reachable — they won't fail in environments without Mahoraga.

The integration tests (`integration_test.go`) cover:
- Health check and version
- Page lifecycle: open → read → snapshot → eval → screenshot → nav → reload → close
- Active page query
- Info command
- Error handling (invalid page ID, JS errors)

## Build

```bash
make                    # Build binary
make vet                # Run go vet
make test               # Run integration tests
make install            # Install to $GOPATH/bin
make clean              # Remove binary
VERSION=1.0 make        # Build with version
```

## Architecture

```
apps/cli/
├── main.go             # Entry point
├── Makefile            # Build targets
├── config/
│   └── config.go       # Config file (~/.config/mahoraga-cli/config.yaml)
├── cmd/
│   ├── root.go         # Root command, global flags
│   ├── init.go         # Server URL configuration (URL arg or interactive)
│   ├── launch.go       # launch (find and start Mahoraga, wait for server)
│   ├── open.go         # open (new_page / new_hidden_page)
│   ├── nav.go          # nav, back, forward, reload
│   ├── tabs.go         # tabs/pages alias, active, close
│   ├── snap.go         # snapshot/snap
│   ├── text.go         # read, text, links, grep
│   ├── find.go         # find (grep + act)
│   ├── batch.go        # batch command runner
│   ├── screenshot.go   # screenshot/ss
│   ├── eval.go         # eval (evaluate_script)
│   ├── click.go        # click, click-at
│   ├── fill.go         # fill, clear, key
│   ├── interact.go     # hover, focus, check, uncheck, select, drag, upload
│   ├── scroll.go       # scroll
│   ├── wait.go         # wait (wait_for)
│   ├── file_actions.go # pdf, download
│   ├── window.go       # window {list,create,close,activate}
│   ├── bookmark.go     # bookmark {list,create,remove,update,move,search}
│   ├── history.go      # history {search,recent,delete,delete-range}
│   ├── group.go        # group {list,create,update,ungroup,close}
│   ├── health.go       # health, status (REST endpoints)
│   └── info.go         # info (mahoraga_info)
├── mcp/
│   ├── client.go       # MCP JSON-RPC 2.0 client (initialize + tools/call)
│   └── types.go        # JSON-RPC and MCP type definitions
└── output/
    └── printer.go      # Human-readable and JSON output formatting
```

Normal CLI commands initialize an MCP session, call the requested tool, and close the session. `batch` keeps one MCP session open for all subcommands in that invocation.

## Links

- [Documentation](https://docs.mahoraga.com)
- [MCP Setup Guide](https://docs.mahoraga.com/features/use-with-claude-code)
- [Changelog](./CHANGELOG.md)
