/**
 * Packs auth-related env into `.next/amplify-auth.json` for Lambda (artifact is only `.next/`).
 * Run `prebuild` before `next build` so metadata/layout can resolve NEXTAUTH_URL; run again after
 * build so a fresh `.next` still contains the file.
 *
 * Intentionally omits DYNAMO_TABLE_PREFIX: Amplify often defines `mm` for “All branches” and
 * `mm-dev` only as a branch override. CodeBuild still sees `mm`, so baking it into this file would
 * override the real Lambda value. Read table prefix from `process.env` only (see lib/dynamo/tables.ts).
 */
const fs = require("fs");
const path = require("path");

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

const dir = path.join(process.cwd(), ".next");
const target = path.join(dir, "amplify-auth.json");

fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(target, JSON.stringify(out), "utf8");
console.log(
  "[write-amplify-auth-env]",
  label,
  "→",
  target,
  "keys:",
  Object.keys(out).length ? Object.keys(out).join(", ") : "(none)"
);
