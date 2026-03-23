import { hydrateAuthEnvFromDisk } from "../hydrate-auth-env";
import { serverEnv } from "../server-env";

if (typeof process !== "undefined") {
  hydrateAuthEnvFromDisk();
}

/**
 * Table name prefix (e.g. `mm` → `mm-users`, `mm-dev` → `mm-dev-users`).
 * Set `DYNAMO_TABLE_PREFIX` in Amplify (All branches + branch override is OK). It is intentionally
 * **not** packed into `amplify-auth.json` so CodeBuild never freezes the “All branches” value.
 *
 * Resolution order: **runtime `process.env` first**, then `serverEnv` (other keys from amplify-auth.json + env).
 */
/** Bracket access so Next/Webpack does not statically replace `process.env.DYNAMO_*` at build time. */
function runtimeEnvString(key: "DYNAMO_TABLE_PREFIX"): string | undefined {
  const v = process.env[key];
  return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
}

function dynamoTablePrefix(): string {
  const raw = (
    runtimeEnvString("DYNAMO_TABLE_PREFIX") ??
    serverEnv("DYNAMO_TABLE_PREFIX") ??
    "mm"
  ).trim();
  const normalized = raw.replace(/-+$/, "") || "mm";
  return normalized;
}

/** Resolved at access time so scripts and Lambda see the right env. */
export const TABLES = {
  get USERS() {
    return `${dynamoTablePrefix()}-users`;
  },
  get TOURNAMENT() {
    return `${dynamoTablePrefix()}-tournament`;
  },
  get BRACKETS() {
    return `${dynamoTablePrefix()}-brackets`;
  },
  get GROUPS() {
    return `${dynamoTablePrefix()}-groups`;
  },
  get SCORES() {
    return `${dynamoTablePrefix()}-scores`;
  },
  get NEXTAUTH() {
    return `${dynamoTablePrefix()}-next-auth`;
  },
} as const;

