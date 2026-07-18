# mahoraga-dogfood

Internal Mahoraga dogfooding CLI for running Mahoraga or BrowserClaw against a copied Mahoraga profile.

## What It Does

`mahoraga-dogfood` makes it easy for the team to alpha test the latest dev branch with the smallest possible effort.

High level:

- You point it at a Mahoraga repo clone used for alpha dogfooding.
- It tracks a configured branch for that clone and switches to it before builds and update commands.
- It imports your normal Mahoraga profile into a target-specific dogfood profile.
- It keeps Mahoraga and BrowserClaw state separate from your normal app state and from each other.
- For Mahoraga, it builds the local extension, starts the local server, and launches the installed Mahoraga app with the alpha Dock icon against them.
- For BrowserClaw, it starts the BrowserClaw WXT app and standalone Claw server against the installed BrowserClaw app, falling back to Mahoraga when BrowserClaw is not installed.
- It does not auto-pull on `start`; you choose when to update the checkout.

## Requirements

- macOS.
- Go.
- Bun.
- Mahoraga installed at `/Applications/Mahoraga.app`; BrowserClaw optionally installed at `/Applications/BrowserClaw.app`.
- A separate Mahoraga monorepo checkout for alpha dogfood.

## Install

From the Mahoraga monorepo root:

```bash
cd packages/mahoraga-agent/tools/dogfood
make install
```

This installs `mahoraga-dogfood` globally on your machine.

Check the binary:

```bash
mahoraga-dogfood --help
```

## First-Time Setup

Run one or both target setup commands:

```bash
mahoraga-dogfood --mahoraga init
mahoraga-dogfood --claw init
```

`init` asks for:

- `Repo path`: the full path to the root Mahoraga git repo clone.
- `Branch`: the branch dogfood should track. It defaults to the selected repo's current branch, or `main`.
- `Mahoraga binary`: defaults to `/Applications/Mahoraga.app/Contents/MacOS/Mahoraga`; Claw start resolves to BrowserClaw at launch time when available.
- `Source profile`: your main installed Mahoraga profile.

Use a separate clone for the repo path. This clone is what `mahoraga-dogfood` uses to run alpha dogfood builds, so ideally it is not the same checkout you use for actual dev work. Give the full root repo path, for example `/Users/you/code/mahoraga-alpha`.

If you have multiple Mahoraga profiles, `init` reads them and shows their real names. Pick your main profile, the one with your data, so alpha dogfood starts with the right imported profile.

## Daily Use

```bash
mahoraga-dogfood --mahoraga start
mahoraga-dogfood --claw start
```

`start` is sync: it runs in your terminal. Press `Ctrl+C` to cancel and stop the selected target environment.

For async mode:

```bash
mahoraga-dogfood --mahoraga start-background
mahoraga-dogfood --claw start-background
```

`start-background` keeps running after the command returns. Use the CLI to manage it:

```bash
mahoraga-dogfood --claw status
mahoraga-dogfood --claw pull
mahoraga-dogfood --claw restart
mahoraga-dogfood --claw restart --pull
mahoraga-dogfood --claw logs
mahoraga-dogfood --claw logs tail
mahoraga-dogfood --claw stop
```

- `start` switches a clean checkout to the configured branch before building. It still does not pull.
- `pull` switches to the configured branch and updates the configured repo for the next sync start.
- `restart --pull` switches to the configured branch, updates the configured repo, rebuilds, and restarts when new changes land upstream.
- `logs` prints log file paths; `logs tail` follows background dogfood, browser/app, and server logs.
- Mahoraga and BrowserClaw use separate locks, sockets, state files, profiles, and logs.

## State And Profile Safety

`mahoraga-dogfood` keeps alpha dogfood separate from normal Mahoraga:

- Mahoraga state, including the local server state and VM data, lives under `~/.mahoraga-dogfood`.
- BrowserClaw state lives under `~/.mahoraga-claw-dogfood`.
- The imported Mahoraga dogfood profile lives under `~/.config/mahoraga-dogfood/mahoraga/profile`.
- The imported BrowserClaw dogfood profile lives under `~/.config/mahoraga-dogfood/claw/profile`.
- Your installed Mahoraga profile is only used as the source import. It is not where alpha dogfood runs.
- Installed extensions, extension-specific settings/state, and extension-owned IndexedDB data are copied so dogfood sessions keep extension setup close to your normal profile.
- Cache and broad site storage directories are not copied.

To re-import your main profile:

```bash
mahoraga-dogfood --mahoraga start --refresh-profile
mahoraga-dogfood --claw start --refresh-profile
```

If Mahoraga appears to be using the source profile during import, the CLI asks you to quit Mahoraga and press Enter before copying. You can type `continue` if the lock files are stale and you want to import anyway.

## Config

```bash
mahoraga-dogfood config edit
```

Config lives at `~/.config/mahoraga-dogfood/config.yaml`. Most people should only need to edit it when changing the alpha repo clone, tracked branch, ports, or env values.

Browser launch passes `--mahoraga-dock-icon=alpha` so dogfood sessions are visually distinct in the Dock.
