/**
 * Read server env by dynamic key so Next.js webpack does not inline a build-time value.
 *
 * On Amplify, `next build` on CodeBuild often runs without auth secrets; `process.env.NEXTAUTH_SECRET`
 * in source can become a baked-in `undefined` / empty string in the server bundle. Lambda then has
 * the real vars in `process.env`, but the inlined literal wins unless we use `process.env[key]`.
 */
export function serverEnv(key: string): string | undefined {
  const v = process.env[key];
  if (v === undefined || v === "") return undefined;
  return v;
}
