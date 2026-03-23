import { NextResponse } from "next/server";
import { getDynamoTablePrefixForOps } from "@/lib/dynamo/tables";
import { serverEnv } from "@/lib/server-env";

export const dynamic = "force-dynamic";

function hasServerEnv(k: string): boolean {
  const v = serverEnv(k);
  return typeof v === "string" && v.length > 0;
}

function hasRawProcess(k: string): boolean {
  const v = process.env[k];
  return typeof v === "string" && v.length > 0;
}

/**
 * Temporary ops probe: set DEPLOY_ENV_CHECK=1 (or NEXTAUTH_DEBUG=1) in Amplify, redeploy, GET this
 * route once, then remove the flag. Returns only booleans — no secret values.
 */
export async function GET() {
  if (process.env.DEPLOY_ENV_CHECK !== "1" && process.env.NEXTAUTH_DEBUG !== "1") {
    return new NextResponse(null, { status: 404 });
  }

  return NextResponse.json({
    viaServerEnv: {
      hasNextAuthSecret: hasServerEnv("NEXTAUTH_SECRET"),
      hasGoogleClientId: hasServerEnv("GOOGLE_CLIENT_ID"),
      hasGoogleClientSecret: hasServerEnv("GOOGLE_CLIENT_SECRET"),
      hasNextAuthUrl: hasServerEnv("NEXTAUTH_URL"),
      hasDynamoTablePrefix: hasServerEnv("DYNAMO_TABLE_PREFIX"),
    },
    rawProcessEnvOnly: {
      hasNextAuthSecret: hasRawProcess("NEXTAUTH_SECRET"),
      hasGoogleClientId: hasRawProcess("GOOGLE_CLIENT_ID"),
      hasGoogleClientSecret: hasRawProcess("GOOGLE_CLIENT_SECRET"),
      hasDynamoTablePrefix: hasRawProcess("DYNAMO_TABLE_PREFIX"),
      hasDynamoTableDevBranches: hasRawProcess("DYNAMO_TABLE_DEV_BRANCHES"),
      hasDynamoTableDevPrefix: hasRawProcess("DYNAMO_TABLE_DEV_PREFIX"),
      hasAwsBranch: hasRawProcess("AWS_BRANCH"),
    },
    resolvedDynamoTablePrefix: getDynamoTablePrefixForOps(),
    note: "viaServerEnv includes amplify-auth.json if present; rawProcessEnvOnly is Lambda env injection only. resolvedDynamoTablePrefix is what Dynamo queries use.",
  });
}
