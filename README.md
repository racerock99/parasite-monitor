# ⛏️ Parasite Monitor — Umbrel App

Watches the Bitcoin blockchain and sends Discord alerts whenever **Parasite** mines a block. Includes a live web dashboard.

---

## Quick Install on Umbrel

### 1. SSH into your Umbrel
```bash
ssh umbrel@umbrel.local
```

### 2. Clone / copy the app
```bash
mkdir -p ~/apps/parasite-monitor
cd ~/apps/parasite-monitor
# Copy all files here (server.js, Dockerfile, docker-compose.yml, public/)
```

### 3. Set your Discord webhook (optional)
```bash
export DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/YOUR/WEBHOOK"
```
Or edit `docker-compose.yml` and hardcode it in the `environment` section.

### 4. Build and start
```bash
docker-compose up -d --build
```

### 5. Open the dashboard
Visit `http://umbrel.local:4000` in your browser.

---

## Configuration

| Variable | Default | Description |
|---|---|---|
| `POOL_NAME` | `Parasite` | Pool name to match (case-insensitive) |
| `POLL_INTERVAL_MS` | `60000` | How often to check for new blocks (ms) |
| `DISCORD_WEBHOOK_URL` | _(empty)_ | Discord webhook URL for notifications |
| `PORT` | `4000` | Web UI port |

---

## Useful Commands

```bash
# View logs
docker-compose logs -f

# Restart
docker-compose restart

# Stop
docker-compose down

# Update after code changes
docker-compose up -d --build
```

---

## How It Works

1. Every 60 seconds, the server fetches the latest blocks from `mempool.space/api`
2. Each new block's pool tag is compared to `POOL_NAME`
3. On a match: saves to history, broadcasts to all open browser tabs via SSE, and fires the Discord webhook
4. The web UI connects via Server-Sent Events for real-time updates with no page refresh needed
