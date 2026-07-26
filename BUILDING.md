# Building a downloadable Mahoraga browser

How to turn `packages/mahoraga` (the Chromium fork) into an installable,
Mahoraga-branded browser. No published binaries exist yet — this is the path to
making one. For the agent/automation stack, see the [README](README.md) instead;
it runs with `docker compose up` and needs none of this.

## 0. Machine requirements

| | Minimum | Comfortable |
|---|---|---|
| CPU | 8 cores | 16–32 cores |
| RAM | 16 GB | 32–64 GB |
| Disk | **200 GB free SSD** (~100 GB checkout + build output) | 300 GB NVMe |
| OS | macOS 13+, Ubuntu 22.04+, Windows 11 | macOS (matches upstream nightly CI) |

A 32-vCPU cloud VM compiles in roughly 1–3 hours; a laptop can take 6+.
Install `git`, Python 3.11+, and [`uv`](https://docs.astral.sh/uv). Toolchains:
macOS needs full Xcode; Linux deps are installed in step 3; Windows needs
Visual Studio 2022 + Windows SDK and `DEPOT_TOOLS_WIN_TOOLCHAIN=0`.

## 1. Set up the build CLI

```bash
cd packages/mahoraga
uv sync
cp .env.example .env   # leave signing/R2 fields empty for a personal build
```

Run everything below as `uv run mahoraga …` from this directory. This is the
build CLI (`bos_build`) — not the Python agent CLI at the repo root that shares
the name.

## 2. Preflight

```bash
uv run mahoraga build --preset release --show-plan   # steps + required env vars; works without a checkout
uv run mahoraga dev doctor                           # verifies the patch stack
```

`--show-plan` shows which steps need secrets you don't have (signing, upload);
skip those in step 4.

## 3. Fetch Chromium

The fork pins the Chromium version in [`CHROMIUM_VERSION`](packages/mahoraga/CHROMIUM_VERSION).
The checkout is ~100 GB.

```bash
export CHROMIUM_ROOT=~/chromium
uv run mahoraga source ensure --root "$CHROMIUM_ROOT" --step checkout
uv run mahoraga source ensure --root "$CHROMIUM_ROOT" --step sync
```

Linux only, once after sync: `$CHROMIUM_ROOT/src/build/install-build-deps.sh`.

## 4. Build

```bash
uv run mahoraga build \
  --preset release \
  --product mahoraga \
  --chromium-src "$CHROMIUM_ROOT/src" \
  --skip sign_macos,upload      # Windows: --skip sign_windows,upload
```

Applies the Mahoraga patches and branding, configures GN, compiles, and
packages an unsigned but fully functional installer. On macOS pick one arch
(`--arch arm64` or `--arch x64`); `universal` runs three sequential builds.

Useful recovery flags:

- `--from <step>` resumes after a failure without recompiling (e.g. `--from package_macos`)
- `uv run mahoraga build --list` shows every step name
- `--preset debug` for faster iteration builds

## 5. Collect and run

The packaging step's log names the artifact path — `Mahoraga.dmg` on macOS, an
installer `.exe` on Windows, a package on Linux.

- macOS (unsigned): right-click → Open once, or
  `xattr -dr com.apple.quarantine /Applications/Mahoraga.app`
- Windows (unsigned): SmartScreen → "More info" → "Run anyway"

## Notes

- The first build is the expensive one; incremental rebuilds take minutes.
- The patch stack is pinned to the Chromium version above. If `dev doctor` or
  the `series_patches` step reports conflicts, file an issue rather than
  hand-editing patches.
- Personal builds don't need signing. To distribute installers without OS
  warnings you need an Apple Developer ID and a Windows code-signing
  certificate — they slot into the `.env` fields left empty in step 1.
- Full CLI reference: [`packages/mahoraga/bos_build/docs/build-cli.md`](packages/mahoraga/bos_build/docs/build-cli.md).
