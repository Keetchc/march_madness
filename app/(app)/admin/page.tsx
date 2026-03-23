import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAllGames, getAllTeams, getTournament } from "@/lib/dynamo/queries/games";
import { AdminPageClient } from "./AdminPageClient";

export const dynamic = "force-dynamic";

const TOURNAMENT_ID = process.env.TOURNAMENT_ID ?? "2026";

export default async function AdminPage() {
  const session = await getServerSession(getAuthOptions());
  if (!session) redirect("/login");
  if (!(session.user as { isAdmin?: boolean }).isAdmin) redirect("/dashboard");

  const [games, teams, tournament] = await Promise.all([
    getAllGames(TOURNAMENT_ID),
    getAllTeams(TOURNAMENT_ID),
    getTournament(TOURNAMENT_ID),
  ]);

  return (
    <AdminPageClient
      games={games}
      teams={teams}
      tournament={tournament}
    />
  );
}
