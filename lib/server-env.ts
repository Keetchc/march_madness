/**
 * Read server env via Node's `env` export so webpack does not substitute `process.env.NAME`
 * with a build-time literal (common on Amplify CodeBuild when secrets exist only on Lambda).
 */
import { env as nodeEnv } from "node:process";

export function serverEnv(key: string): string | undefined {
  const v = nodeEnv[key];
  if (v === undefined || v === "") return undefined;
  return v;
}
