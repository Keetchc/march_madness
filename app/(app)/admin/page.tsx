import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAllGames, getAllTeams, getTournament } from "@/lib/dynamo/queries/games";
import { AdminPageClient } from "./AdminPageClient";
import { getViewingTournamentIdFromCookies } from "@/lib/viewing-tournament";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getServerSession(getAuthOptions());
  if (!session) redirect("/login");
  if (!(session.user as { isAdmin?: boolean }).isAdmin) redirect("/dashboard");

  const viewingId = getViewingTournamentIdFromCookies();
  const [games, teams, tournament] = await Promise.all([
    getAllGames(viewingId),
    getAllTeams(viewingId),
    getTournament(viewingId),
  ]);

  return (
    <AdminPageClient
      games={games}
      teams={teams}
      tournament={tournament}
    />
  );
}
