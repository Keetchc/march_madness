/**
 * Resolve auth-related config for Node server routes.
 *
 * 1) `.next/amplify-auth.json` — written during Amplify build (see scripts/write-amplify-auth-env.js).
 *    Lambda often deploys only `.next/`; runtime `process.env` may omit console vars, but this file ships.
 * 2) `node:process` env — local dev and hosts that inject env correctly.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { env as nodeEnv } from "node:process";

type Bundle = Record<string, string>;

let bundleCache: Bundle | null | undefined;

function loadBundle(): Bundle | null {
  if (bundleCache !== undefined) return bundleCache;
  bundleCache = null;

  const candidates = [
    join(process.cwd(), "amplify-auth.json"),
    join(process.cwd(), ".next", "amplify-auth.json"),
  ];

  for (const file of candidates) {
    try {
      if (!existsSync(file)) continue;
      const parsed = JSON.parse(readFileSync(file, "utf8")) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        bundleCache = parsed as Bundle;
        return bundleCache;
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

export function serverEnv(key: string): string | undefined {
  const fromFile = loadBundle()?.[key];
  if (fromFile !== undefined && fromFile !== "") return fromFile;

  const v = nodeEnv[key];
  if (v === undefined || v === "") return undefined;
  return v;
}
