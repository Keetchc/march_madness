/**
 * Packs auth-related env into `.next/amplify-auth.json` for Lambda (artifact is only `.next/`).
 * Run `prebuild` before `next build` so metadata/layout can resolve NEXTAUTH_URL; run again after
 * build so a fresh `.next` still contains the file.
 *
 * `DYNAMO_TABLE_PREFIX` is written using branch-aware rules (see `resolveDynamoTablePrefixForArtifact`).
 * CodeBuild often only sees the “All branches” value (`mm`) for `DYNAMO_TABLE_PREFIX`; set
 * `DYNAMO_TABLE_PREFIX_DEV=mm-dev` on the dev branch so dev builds embed the correct prefix. Optional:
 * `DYNAMO_TABLE_DEV_BRANCHES` (comma-separated, default `dev`) if your Git branch name is not `dev`.
 */
const fs = require("fs");
const path = require("path");

function resolveDynamoTablePrefixForArtifact() {
  const branch = (process.env.AWS_BRANCH || "").trim().toLowerCase();
  const devBranches = (process.env.DYNAMO_TABLE_DEV_BRANCHES || "dev")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const devPrefix = process.env.DYNAMO_TABLE_PREFIX_DEV?.trim();
  if (devPrefix && devBranches.includes(branch)) {
    return devPrefix;
  }
  const fallback = process.env.DYNAMO_TABLE_PREFIX?.trim();
  return fallback || undefined;
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

const dynamoPrefix = resolveDynamoTablePrefixForArtifact();
if (dynamoPrefix) {
  out.DYNAMO_TABLE_PREFIX = dynamoPrefix;
}

const dir = path.join(process.cwd(), ".next");
const target = path.join(dir, "amplify-auth.json");

fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(target, JSON.stringify(out), "utf8");
if (dynamoPrefix) {
  console.log(
    "[write-amplify-auth-env]",
    label,
    "DYNAMO_TABLE_PREFIX in artifact:",
    dynamoPrefix,
    "(AWS_BRANCH=" + (process.env.AWS_BRANCH || "") + ")"
  );
}
console.log(
  "[write-amplify-auth-env]",
  label,
  "→",
  target,
  "keys:",
  Object.keys(out).length ? Object.keys(out).join(", ") : "(none)"
);
