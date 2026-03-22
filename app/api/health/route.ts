import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const diagnostics: Record<string, string> = {
    MM_REGION: process.env.MM_REGION ? "set" : "MISSING",
    MM_ACCESS_KEY_ID: process.env.MM_ACCESS_KEY_ID
      ? `set (${process.env.MM_ACCESS_KEY_ID.slice(0, 4)}...)`
      : "MISSING",
    MM_SECRET_ACCESS_KEY: process.env.MM_SECRET_ACCESS_KEY
      ? `set (length=${process.env.MM_SECRET_ACCESS_KEY.length})`
      : "MISSING",
    AWS_REGION: process.env.AWS_REGION ? "set" : "MISSING",
    TOURNAMENT_ID: process.env.TOURNAMENT_ID ?? "MISSING",
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? "set" : "MISSING",
    NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? "MISSING",
    NODE_ENV: process.env.NODE_ENV ?? "unknown",
  };

  let dbStatus = "untested";
  try {
    const { getAllTeams } = await import("@/lib/dynamo/queries/games");
    const teams = await getAllTeams(process.env.TOURNAMENT_ID ?? "2026");
    dbStatus = `ok (${teams.length} teams)`;
  } catch (err: any) {
    dbStatus = `error: ${err.name}: ${err.message}`;
  }

  return NextResponse.json({ diagnostics, dbStatus });
}
