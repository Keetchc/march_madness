/**
 * Run on Amplify/CodeBuild after `next build`. Packs auth-related env into `.next/amplify-auth.json`
 * so Lambda can read them even when runtime `process.env` does not receive console variables
 * (common with Amplify Hosting when artifacts are only `.next/`).
 */
const fs = require("fs");
const path = require("path");

const KEYS = [
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "NEXTAUTH_DEBUG",
];

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
  "[write-amplify-auth-env] wrote",
  target,
  "with keys:",
  Object.keys(out).length ? Object.keys(out).join(", ") : "(none — check Amplify env on this branch)"
);
