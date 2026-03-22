/**
 * ESPN Polling Script
 *
 * Calls our /api/espn/sync endpoint on a schedule.
 * Run this during the tournament to auto-update game results.
 *
 * Usage (local):
 *   npm run poll
 *
 * On AWS: use EventBridge Scheduler to call the sync endpoint directly
 * every 60 seconds during tournament hours (no need to run this script in prod).
 */

import * as https from "https";
import * as http from "http";

const APP_URL    = process.env.APP_URL ?? "http://localhost:3000";
const SYNC_SECRET = process.env.ESPN_SYNC_SECRET ?? "dev-sync-secret";
const INTERVAL_MS = parseInt(process.env.ESPN_POLL_INTERVAL_MS ?? "60000", 10);

// Only poll during tournament hours (saves API calls at 3am)
function isTournamentHours(): boolean {
  const now = new Date();
  const hour = now.getUTCHours(); // 11am–midnight ET = 15:00–04:00 UTC
  return hour >= 15 || hour <= 4;
}

function postSync(): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = new URL(`${APP_URL}/api/espn/sync`);
    const lib = url.protocol === "https:" ? https : http;

    const req = lib.request(
      { hostname: url.hostname, port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: url.pathname, method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SYNC_SECRET}` },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            const data = JSON.parse(body);
            const ts = new Date().toLocaleTimeString();
            if (data.updated > 0) {
              console.log(`[${ts}] ✅ Updated ${data.updated} game(s): ${data.updatedIds.join(", ")}`);
            } else {
              console.log(`[${ts}] — Checked ${data.checked} games, no updates`);
            }
            if (data.errors?.length) {
              console.warn(`[${ts}] ⚠️  Errors: ${data.errors.join("; ")}`);
            }
          } catch {
            console.error("Failed to parse sync response:", body.slice(0, 200));
          }
          resolve();
        });
      }
    );

    req.on("error", reject);
    req.setTimeout(15_000, () => { req.destroy(); reject(new Error("Request timeout")); });
    req.end();
  });
}

async function poll() {
  if (!isTournamentHours()) {
    console.log(`[${new Date().toLocaleTimeString()}] Outside tournament hours, skipping poll.`);
    return;
  }
  try {
    await postSync();
  } catch (err) {
    console.error(`[${new Date().toLocaleTimeString()}] Poll error:`, err);
  }
}

console.log(`🏀 ESPN Poller started`);
console.log(`   App: ${APP_URL}`);
console.log(`   Interval: ${INTERVAL_MS / 1000}s`);
console.log(`   (Polls between 11am–midnight ET)\n`);

// Run immediately then on schedule
poll();
setInterval(poll, INTERVAL_MS);

