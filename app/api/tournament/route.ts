import { NextResponse } from "next/server";
import { getAllGames, getAllTeams, getTournament } from "@/lib/dynamo/queries/games";
import { resolveTournamentIdFromRequestUrl } from "@/lib/viewing-tournament";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const tournamentId = resolveTournamentIdFromRequestUrl(req);
  const [tournament, games, teams] = await Promise.all([
    getTournament(tournamentId),
    getAllGames(tournamentId),
    getAllTeams(tournamentId),
  ]);

  if (!tournament) {
    return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
  }

  return NextResponse.json({ tournament, games, teams });
}

