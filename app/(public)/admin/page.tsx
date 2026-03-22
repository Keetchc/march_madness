import { getAllGames, getAllTeams, getTournament } from "@/lib/dynamo/queries/games";
import { AdminPageClient } from "@/app/(app)/admin/AdminPageClient";

const TOURNAMENT_ID = process.env.TOURNAMENT_ID ?? "2026";

export default async function PublicAdminPage() {
  const [games, teams, tournament] = await Promise.all([
    getAllGames(TOURNAMENT_ID),
    getAllTeams(TOURNAMENT_ID),
    getTournament(TOURNAMENT_ID),
  ]);

  return (
    <AdminPageClient
      games={games}
      teams={teams}
      tournament={tournament!}
    />
  );
}
