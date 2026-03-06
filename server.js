const http = require("http");
const fs = require("fs");
const path = require("path");
const https = require("https");

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || "";
const POOL_NAME = process.env.POOL_NAME || "Parasite";
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || "60000");
const MEMPOOL_API = "https://mempool.space/api";
const MAX_HISTORY = 50;

// ─── STATE ────────────────────────────────────────────────────────────────────
let lastSeenBlockHash = null;
let blockHistory = [];
let stats = { totalFound: 0, lastChecked: null, monitoringActive: true, startedAt: new Date().toISOString() };
let clients = []; // SSE clients

// ─── FETCH HELPER ─────────────────────────────────────────────────────────────
function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "parasite-monitor/1.0" } }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on("error", reject);
  });
}

// ─── DISCORD ──────────────────────────────────────────────────────────────────
function sendDiscord(block) {
  if (!DISCORD_WEBHOOK_URL) return Promise.resolve();
  const payload = JSON.stringify({
    username: "Parasite Monitor",
    embeds: [{
      title: `⛏️ Parasite mined block #${block.height}!`,
      url: `https://mempool.space/block/${block.id}`,
      color: 0xf7931a,
      fields: [
        { name: "Block Hash", value: `\`${block.id}\``, inline: false },
        { name: "Transactions", value: String(block.tx_count), inline: true },
        { name: "Total Fees", value: formatBTC(block.extras?.totalFees ?? 0), inline: true },
        { name: "Reward", value: formatBTC(block.extras?.reward ?? 0), inline: true },
        { name: "Size", value: `${(block.size / 1024).toFixed(1)} KB`, inline: true },
        { name: "Timestamp", value: new Date(block.timestamp * 1000).toUTCString(), inline: false },
      ],
    }],
  });
  return new Promise((resolve) => {
    const url = new URL(DISCORD_WEBHOOK_URL);
    const req = https.request({ hostname: url.hostname, path: url.pathname + url.search, method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } }, resolve);
    req.on("error", console.error);
    req.write(payload);
    req.end();
  });
}

function formatBTC(sats) { return (sats / 1e8).toFixed(4) + " BTC"; }

// ─── SSE BROADCAST ────────────────────────────────────────────────────────────
function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  clients = clients.filter((res) => { try { res.write(msg); return true; } catch { return false; } });
}

// ─── CORE MONITOR ─────────────────────────────────────────────────────────────
async function checkBlocks() {
  try {
    const blocks = await fetchJSON(`${MEMPOOL_API}/v1/blocks`);
    stats.lastChecked = new Date().toISOString();
    if (!blocks?.length) return;

    if (!lastSeenBlockHash) {
      lastSeenBlockHash = blocks[0].id;
      console.log(`[monitor] Started at block #${blocks[0].height}`);
      broadcast("status", stats);
      return;
    }

    const newBlocks = [];
    for (const b of blocks) {
      if (b.id === lastSeenBlockHash) break;
      newBlocks.push(b);
    }
    if (!newBlocks.length) { broadcast("status", stats); return; }

    lastSeenBlockHash = blocks[0].id;

    for (const block of newBlocks.reverse()) {
      const poolTag = block.extras?.pool?.name ?? block.extras?.coinbaseRaw ?? "";
      const match = poolTag.toLowerCase().includes(POOL_NAME.toLowerCase());
      console.log(`[monitor] Block #${block.height} — ${poolTag || "unknown"}${match ? " ✅ MATCH" : ""}`);

      if (match) {
        stats.totalFound++;
        const entry = { ...block, poolName: poolTag, detectedAt: new Date().toISOString() };
        blockHistory.unshift(entry);
        if (blockHistory.length > MAX_HISTORY) blockHistory.pop();
        await sendDiscord(block);
        broadcast("block", entry);
      }
    }
    broadcast("status", stats);
  } catch (err) {
    console.error("[monitor] Error:", err.message);
  }
}

// ─── HTTP SERVER ──────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  const url = req.url.split("?")[0];

  // SSE endpoint
  if (url === "/events") {
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive", "Access-Control-Allow-Origin": "*" });
    res.write(`event: init\ndata: ${JSON.stringify({ history: blockHistory, stats })}\n\n`);
    clients.push(res);
    req.on("close", () => { clients = clients.filter((c) => c !== res); });
    return;
  }

  // JSON API
  if (url === "/api/blocks") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ blocks: blockHistory, stats }));
    return;
  }

  // Static files
  let filePath = url === "/" ? "/index.html" : url;
  filePath = path.join(__dirname, "public", filePath);
  const ext = path.extname(filePath);
  const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml" }[ext] || "application/octet-stream";

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end("Not found"); return; }
    res.writeHead(200, { "Content-Type": mime });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`[server] Parasite Monitor running on http://localhost:${PORT}`);
  console.log(`[monitor] Watching pool: "${POOL_NAME}" — polling every ${POLL_INTERVAL_MS / 1000}s`);
  checkBlocks();
  setInterval(checkBlocks, POLL_INTERVAL_MS);
});
