# mahoraga-cli

Command-line interface for controlling Mahoraga -- launch and automate the browser from the terminal or AI agents. The package installs both `mahoraga-cli` and `bos`.

## Installation

**Zero install (recommended):**

```bash
npx mahoraga-cli --help
```

**Global install:**

```bash
npm install -g mahoraga-cli
```

**Shell script fallback:**

```bash
curl -fsSL https://cdn.mahoraga.com/cli/install.sh | bash
```

## Quick Start

```bash
# Download Mahoraga from https://mahoraga.com

# Start Mahoraga
mahoraga-cli launch

# Configure MCP settings with the Server URL from Mahoraga settings
mahoraga-cli init http://127.0.0.1:9000/mcp

# Verify everything is working
mahoraga-cli health
```

## Usage

### Agent loop

```bash
page=$(mahoraga-cli open --json https://example.com | jq -r .page)
mahoraga-cli -p "$page" snapshot
mahoraga-cli -p "$page" read --links
mahoraga-cli -p "$page" find text "Search" click
mahoraga-cli -p "$page" press Enter
mahoraga-cli -p "$page" screenshot -o shot.png
mahoraga-cli -p "$page" close
```

`batch` can run shared-session browser steps for navigation, eval, snapshot/read/grep/find, and direct element actions like click/fill/press/type.

## Documentation

Full documentation is available at [mahoraga.com](https://mahoraga.com).

## License

MIT
