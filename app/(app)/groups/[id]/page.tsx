import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getGroup, getGroupMembers, getGroupMembership } from "@/lib/dynamo/queries/groups";
import { getBracket } from "@/lib/dynamo/queries/brackets";
import { getAllGames, getAllTeams } from "@/lib/dynamo/queries/games";
import { getUser } from "@/lib/dynamo/queries/users";
import { buildLeaderboard } from "@/lib/scoring/engine";
import { GroupPageClient } from "./GroupPageClient";

const TOURNAMENT_ID = process.env.TOURNAMENT_ID ?? "2026";

export default async function GroupPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const userId = session.user.userId;
  const isAdmin = session.user.isAdmin;

  const group = await getGroup(params.id);
  if (!group) notFound();

  const membership = await getGroupMembership(params.id, userId);
  if (!membership && group.adminUserId !== userId && !isAdmin) {
    redirect("/dashboard");
  }

  const members = await getGroupMembers(params.id);

  const bracketIds = members.map((m) => m.bracketId).filter(Boolean);
  const brackets = (await Promise.all(bracketIds.map((id) => getBracket(id)))).filter(Boolean);

  const [games, teams] = await Promise.all([
    getAllGames(TOURNAMENT_ID),
    getAllTeams(TOURNAMENT_ID),
  ]);

  const userRecords = await Promise.all(
    members.map(async (m) => {
      const u = await getUser(m.userId);
      return [m.userId, { name: u?.name ?? "Unknown", picture: u?.picture ?? "" }] as const;
    })
  );

  const usersMap = new Map(userRecords);
  const teamsMap = new Map(teams.map((t) => [t.id, t]));

  const leaderboard = buildLeaderboard(
    brackets as NonNullable<(typeof brackets)[number]>[],
    usersMap,
    games,
    teamsMap,
  );

  return (
    <GroupPageClient
      group={group}
      leaderboard={leaderboard}
      currentUserId={userId}
      isGroupAdmin={group.adminUserId === userId}
    />
  );
}

