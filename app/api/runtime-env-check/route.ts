import { env } from "node:process";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function has(k: string): boolean {
  const v = env[k];
  return typeof v === "string" && v.length > 0;
}

/**
 * Temporary ops probe: set DEPLOY_ENV_CHECK=1 (or NEXTAUTH_DEBUG=1) in Amplify, redeploy, GET this
 * route once, then remove the flag. Returns only booleans — no secret values.
 */
export async function GET() {
  if (env.DEPLOY_ENV_CHECK !== "1" && env.NEXTAUTH_DEBUG !== "1") {
    return new NextResponse(null, { status: 404 });
  }

  return NextResponse.json({
    hasNextAuthSecret: has("NEXTAUTH_SECRET"),
    hasGoogleClientId: has("GOOGLE_CLIENT_ID"),
    hasGoogleClientSecret: has("GOOGLE_CLIENT_SECRET"),
    hasNextAuthUrl: has("NEXTAUTH_URL"),
    source: "node:process.env",
  });
}
