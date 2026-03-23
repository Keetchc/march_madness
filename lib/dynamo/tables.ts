import { hydrateAuthEnvFromDisk } from "../hydrate-auth-env";
import { serverEnv, serverEnvFromArtifactOnly } from "../server-env";

if (typeof process !== "undefined") {
  hydrateAuthEnvFromDisk();
}

/**
 * Table name prefix (e.g. `mm` → `mm-users`, `mm-dev` → `mm-dev-users`).
 *
 * Amplify: `write-amplify-auth-env.js` embeds branch-aware `DYNAMO_TABLE_PREFIX` using **AWS_BRANCH**
 * (automatic) + `DYNAMO_TABLE_DEV_BRANCHES` / `DYNAMO_TABLE_DEV_PREFIX` (same value on **all** branches).
 * Read artifact **before** Lambda `process.env.DYNAMO_TABLE_PREFIX` (often only `mm`).
 */
function rawEnv(key: string): string | undefined {
  const v = process.env[key];
  return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
}

function normalizePrefix(raw: string): string {
  const normalized = raw.replace(/-+$/, "").trim() || "mm";
  return normalized;
}

/** Keep in sync with `scripts/write-amplify-auth-env.js` → `resolveDynamoTablePrefixForArtifact`. */
function inferDynamoPrefixFromAmplifyBranch(): string | undefined {
  const branch = (rawEnv("AWS_BRANCH") ?? "").toLowerCase();
  if (!branch) return undefined;
  const devBranches = (rawEnv("DYNAMO_TABLE_DEV_BRANCHES") ?? "dev")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (!devBranches.includes(branch)) return undefined;

  const base =
    (rawEnv("DYNAMO_TABLE_PREFIX") ?? "mm").replace(/-+$/, "").trim() || "mm";
  const explicit = rawEnv("DYNAMO_TABLE_DEV_PREFIX");
  if (explicit) {
    return normalizePrefix(explicit);
  }
  return normalizePrefix(`${base}-dev`);
}

function dynamoTablePrefix(): string {
  const fromArtifact = serverEnvFromArtifactOnly("DYNAMO_TABLE_PREFIX");
  if (fromArtifact) {
    return normalizePrefix(fromArtifact);
  }
  const inferred = inferDynamoPrefixFromAmplifyBranch();
  if (inferred) {
    return inferred;
  }
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

