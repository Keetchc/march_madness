/**
 * Resolve auth-related config for Node server routes.
 *
 * 1) `.next/amplify-auth.json` — written during Amplify build (see scripts/write-amplify-auth-env.js).
 * 2) `process.env` — local dev and hosts that inject env correctly.
 *
 * Use `fs` / `path` without `node:` so webpack resolves modules during build.
 */
import { existsSync, readFileSync } from "fs";
import { join } from "path";

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

  const v = process.env[key];
  if (v === undefined || v === "") return undefined;
  return v;
}

/** amplify-auth.json only — ignores `process.env` (used so Lambda’s `mm` does not beat branch-resolved file). */
export function serverEnvFromArtifactOnly(key: string): string | undefined {
  const fromFile = loadBundle()?.[key];
  if (fromFile !== undefined && fromFile !== "") return fromFile;
  return undefined;
}
