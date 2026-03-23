/**
 * Packs auth-related env into `.next/amplify-auth.json` for Lambda (artifact is only `.next/`).
 * Run `prebuild` before `next build` so metadata/layout can resolve NEXTAUTH_URL; run again after
 * build so a fresh `.next` still contains the file.
 *
 * `DYNAMO_TABLE_PREFIX` in the artifact is derived from **AWS_BRANCH** (set by Amplify per build —
 * no branch-scoped env UI required). Set the same values on **all branches**:
 *   - `DYNAMO_TABLE_PREFIX=mm`
 *   - `DYNAMO_TABLE_DEV_BRANCHES=dev` (comma-separated Git branch names that use dev tables; default `dev`)
 * Optional same-everywhere override for the dev prefix string: `DYNAMO_TABLE_DEV_PREFIX=mm-dev`
 * (otherwise dev prefix is `{DYNAMO_TABLE_PREFIX}-dev`, e.g. `mm-dev`).
 */
const fs = require("fs");
const path = require("path");

function resolveDynamoTablePrefixForArtifact() {
  const branch = (process.env.AWS_BRANCH || "").trim().toLowerCase();
  const devBranches = (process.env.DYNAMO_TABLE_DEV_BRANCHES || "dev")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const base =
    (process.env.DYNAMO_TABLE_PREFIX || "mm").trim().replace(/-+$/, "") || "mm";

  if (branch && devBranches.includes(branch)) {
    const explicit = process.env.DYNAMO_TABLE_DEV_PREFIX?.trim();
    if (explicit) {
      return explicit.replace(/-+$/, "") || `${base}-dev`;
    }
    return `${base}-dev`;
  }

  return base;
}

const KEYS = [
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
  "NEXT_PUBLIC_SITE_URL",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "NEXTAUTH_DEBUG",
  "ADMIN_EMAILS",
];

const label = process.argv[2] === "prebuild" ? "prebuild" : "postbuild";

const out = {};
for (const k of KEYS) {
  const v = process.env[k];
  if (v !== undefined && v !== "") out[k] = v;
}

out.DYNAMO_TABLE_PREFIX = resolveDynamoTablePrefixForArtifact();
const dynamoPrefix = out.DYNAMO_TABLE_PREFIX;

const dir = path.join(process.cwd(), ".next");
const target = path.join(dir, "amplify-auth.json");

fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(target, JSON.stringify(out), "utf8");
console.log(
  "[write-amplify-auth-env]",
  label,
  "DYNAMO_TABLE_PREFIX in artifact:",
  dynamoPrefix,
  "(AWS_BRANCH=" + (process.env.AWS_BRANCH || "") + ")"
);
console.log(
  "[write-amplify-auth-env]",
  label,
  "→",
  target,
  "keys:",
  Object.keys(out).length ? Object.keys(out).join(", ") : "(none)"
);
