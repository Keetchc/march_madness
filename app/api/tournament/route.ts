import { NextResponse } from "next/server";
import { getAllGames, getAllTeams, getTournament } from "@/lib/dynamo/queries/games";

const TOURNAMENT_ID = process.env.TOURNAMENT_ID ?? "2026";

export async function GET() {
  const [tournament, games, teams] = await Promise.all([
    getTournament(TOURNAMENT_ID),
    getAllGames(TOURNAMENT_ID),
    getAllTeams(TOURNAMENT_ID),
  ]);

  if (!tournament) {
    return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
  }

  return NextResponse.json({ tournament, games, teams });
}

