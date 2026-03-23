import { serverEnv } from "../server-env";

/**
 * Table name prefix (e.g. `mm` → `mm-users`, `mm-dev` → `mm-dev-users`).
 * Set `DYNAMO_TABLE_PREFIX` on each Amplify branch (e.g. prod `mm`, dev `mm-dev`).
 * Also listed in `scripts/write-amplify-auth-env.js` so Lambda reads the bundle when needed.
 */
function dynamoTablePrefix(): string {
  const raw = (serverEnv("DYNAMO_TABLE_PREFIX") ?? process.env.DYNAMO_TABLE_PREFIX ?? "mm").trim();
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

