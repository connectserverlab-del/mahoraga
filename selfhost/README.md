# Run Mahoraga on a server, use it from your phone

This stack runs a Mahoraga browser session on any Linux server and streams it to your
phone's browser. Nothing to install on the phone — open a URL, log in, and you have the
full desktop browser with the Mahoraga agent, rendered remotely.

> **How it works today:** upstream publishes no Linux build of the full Chromium fork yet,
> so the container runs stock Chromium (streamed via KasmVNC) with the **Mahoraga agent
> extension** built from this repo loaded into it. When a native Mahoraga Linux build is
> released, swap the image and keep the same access flow — see
> [Swapping in a native build](#swapping-in-a-native-build).

## Requirements

- A Linux server (VPS or home machine), 2+ vCPU / 4 GB RAM recommended
- Docker with the compose plugin
- [bun](https://bun.sh) on the machine where you build the extension
- Optional but strongly recommended: [Tailscale](https://tailscale.com) on both the
  server and your phone

## Setup

```bash
git clone https://github.com/connectserverlab-del/mahoraga.git
cd mahoraga/selfhost

# 1. Build the agent extension into selfhost/extension/
./build-extension.sh

# 2. Set your login credentials
cat > .env <<'ENV'
MAHORAGA_USER=mahoraga
MAHORAGA_PASSWORD=change-me-to-something-long
ENV

# 3. Start
docker compose up -d
```

## Connect from your phone

1. Install Tailscale on the server (`curl -fsSL https://tailscale.com/install.sh | sh && tailscale up`)
   and on your phone (App Store / Play Store), signed into the same tailnet.
2. On your phone, open `https://<server-tailscale-name>:3001` (accept the self-signed
   certificate) and log in with the credentials from `.env`.
3. **Add it to your home screen** (Share → Add to Home Screen on iOS, ⋮ → Add to Home
   screen on Android). It then launches fullscreen like a native app.

Touch controls map to the remote session: tap to click, drag to scroll, pinch to zoom,
and the on-screen keyboard works in page inputs.

### Without Tailscale

If you must expose the server directly, do **not** publish port 3000 (plain HTTP). Put
port 3001 behind a reverse proxy with a real certificate (Caddy, Traefik, nginx +
Let's Encrypt) and keep the login password long. The KasmVNC login is the only thing
between the internet and a full browser running on your server.

## Day-to-day

- The session is persistent: close your phone, reconnect later, and your tabs are as you
  left them. State lives in `selfhost/data/`.
- Sign into the agent's AI provider inside the streamed browser once; it stays signed in.
- Update: `docker compose pull && docker compose up -d` (re-run `./build-extension.sh`
  after pulling new repo changes to refresh the agent).

## Swapping in a native build

When a Mahoraga (or upstream BrowserOS) Linux `.deb` is published, replace the stock
browser inside the container:

1. Drop the `.deb` in `selfhost/` and add under the service in `docker-compose.yml`:
   ```yaml
   volumes:
     - ./mahoraga.deb:/mahoraga.deb:ro
   ```
2. Use the image's install hook to swap the binary, or build a small derived image:
   ```dockerfile
   FROM lscr.io/linuxserver/chromium:latest
   COPY mahoraga.deb /tmp/
   RUN apt-get update && apt-get install -y /tmp/mahoraga.deb && rm /tmp/mahoraga.deb
   ```
   then point `CHROME_BINARY` at the installed `mahoraga` binary.

The phone-side flow (Tailscale + KasmVNC + home-screen app) is unchanged.
