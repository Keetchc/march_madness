import { hydrateAuthEnvFromDisk } from "../hydrate-auth-env";
import { serverEnv } from "../server-env";

if (typeof process !== "undefined") {
  hydrateAuthEnvFromDisk();
}

/**
 * Table name prefix (e.g. `mm` → `mm-users`, `mm-dev` → `mm-dev-users`).
 *
 * Amplify: CodeBuild often only receives `DYNAMO_TABLE_PREFIX=mm` (“All branches”) while Lambda may
 * keep that too. `scripts/write-amplify-auth-env.js` writes a **branch-aware** `DYNAMO_TABLE_PREFIX`
 * into `.next/amplify-auth.json` when you set `DYNAMO_TABLE_PREFIX_DEV=mm-dev` on the dev branch
 * (see script). We read that file **before** raw `process.env` so dev deploys use `mm-dev` tables.
 */
function rawEnv(key: string): string | undefined {
  const v = process.env[key];
  return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
}

function normalizePrefix(raw: string): string {
  const normalized = raw.replace(/-+$/, "").trim() || "mm";
  return normalized;
}

function dynamoTablePrefix(): string {
  const raw =
    serverEnv("DYNAMO_TABLE_PREFIX") ??
    rawEnv("DYNAMO_TABLE_PREFIX") ??
    "mm";
  return normalizePrefix(raw);
}

/** For ops/debug routes only (e.g. `/api/runtime-env-check`). */
export function getDynamoTablePrefixForOps(): string {
  return dynamoTablePrefix();
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

