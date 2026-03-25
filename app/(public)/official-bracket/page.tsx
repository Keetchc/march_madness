import { getAllGames, getAllTeams, getTournament } from "@/lib/dynamo/queries/games";
import type { Game, Team } from "@/lib/types";
import { OfficialBracketClient } from "./OfficialBracketClient";
import { getViewingTournamentIdFromCookies } from "@/lib/viewing-tournament";

export const dynamic = "force-dynamic";

export default async function OfficialBracketPage() {
  const viewingId = await getViewingTournamentIdFromCookies();
  const tournament = await getTournament(viewingId);
  let games: Game[] = [];
  let teams: Team[] = [];
  if (tournament) {
    [games, teams] = await Promise.all([getAllGames(viewingId), getAllTeams(viewingId)]);
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <p className="font-mono text-xs text-court-500 uppercase tracking-widest mb-1">
          {tournament?.name ?? "NCAA Tournament"}
        </p>
        <h1 className="font-display text-5xl font-black uppercase tracking-tight text-white">
          Official Bracket
        </h1>
      </div>
      <OfficialBracketClient
        initialGames={games}
        initialTeams={teams}
        initialTournamentId={viewingId}
      />
    </div>
  );
}
