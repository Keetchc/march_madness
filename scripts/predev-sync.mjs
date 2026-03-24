/**
 * When SYNC_DYNAMO_ON_DEV=1, runs pull-dev-to-local before `next dev` (via npm predev).
 * Reads `.env.local` so the flag can live next to your other dev env vars.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import dotenv from "dotenv";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env.local") });

if (process.env.SYNC_DYNAMO_ON_DEV !== "1") {
  process.exit(0);
}

const r = spawnSync("npm", ["run", "pull-dev-to-local"], {
  cwd: root,
  stdio: "inherit",
  shell: true,
});

process.exit(r.status === null ? 1 : r.status);
