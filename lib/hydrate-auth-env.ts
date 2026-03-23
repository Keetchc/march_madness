/**
 * Merge `.next/amplify-auth.json` into `process.env` once (Node server only).
 * Not usable from `instrumentation.ts` (webpack can't resolve `fs` there). Import from root `layout`
 * and the NextAuth route so NextAuth internals see `NEXTAUTH_URL` on Amplify.
 */
import { existsSync, readFileSync } from "fs";
import { join } from "path";

let done = false;

export function hydrateAuthEnvFromDisk(): void {
  if (done) return;
  if (process.env.NEXT_RUNTIME === "edge") return;
  done = true;

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
