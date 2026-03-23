/**
 * Hydrate `process.env` from `.next/amplify-auth.json` on the Node server so NextAuth and any code
 * that reads `process.env.NEXTAUTH_URL` (not only `serverEnv()`) see the production URL on Lambda.
 *
 * Use `fs` / `path` (not `node:fs`) so webpack can bundle the instrumentation hook.
 */
import { existsSync, readFileSync } from "fs";
import { join } from "path";

export function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;

  try {
    const candidates = [
      join(process.cwd(), "amplify-auth.json"),
      join(process.cwd(), ".next", "amplify-auth.json"),
    ];

    for (const file of candidates) {
      if (!existsSync(file)) continue;
      const data = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
      for (const [key, value] of Object.entries(data)) {
        if (typeof value !== "string" || value === "") continue;
        const cur = process.env[key];
        if (cur === undefined || cur === "") {
          process.env[key] = value;
        }
      }
      break;
    }
  } catch {
    /* ignore */
  }
}
