import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getGroup, getGroupMembers, getGroupMembership } from "@/lib/dynamo/queries/groups";
import { getBracket } from "@/lib/dynamo/queries/brackets";
import { getAllGames, getAllTeams, getTournament } from "@/lib/dynamo/queries/games";
import { getUser } from "@/lib/dynamo/queries/users";
import { buildLeaderboard } from "@/lib/scoring/engine";
import { picksEffectivelyClosed } from "@/lib/picks-lock";
import type { Bracket } from "@/lib/types";
import { GroupPageClient } from "./GroupPageClient";

const TOURNAMENT_ID = process.env.TOURNAMENT_ID ?? "2026";

export default async function GroupPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(getAuthOptions());
  if (!session) redirect("/login");

  const userId = String((session.user as { userId?: string }).userId ?? "");
  const isAppAdmin = Boolean((session.user as { isAdmin?: boolean }).isAdmin);

  const group = await getGroup(params.id);
  if (!group) notFound();

  const membership = await getGroupMembership(params.id, userId);
  if (!membership && group.adminUserId !== userId && !isAppAdmin) {
    redirect("/dashboard");
  }

  const members = await getGroupMembers(params.id);

  const bracketIds = members.map((m) => m.bracketId).filter(Boolean);
  const bracketsRaw = await Promise.all(bracketIds.map((id) => getBracket(id)));
  const brackets = bracketsRaw.filter((b): b is Bracket => b != null);

  const tid = group.tournamentId ?? TOURNAMENT_ID;
  const [games, teams, tournament] = await Promise.all([
    getAllGames(tid),
    getAllTeams(tid),
    getTournament(tid),
  ]);

  const userIdSet = new Set<string>();
  for (const m of members) {
    if (m.userId) userIdSet.add(String(m.userId));
  }
  for (const b of brackets) {
    if (b.userId) userIdSet.add(String(b.userId));
  }

  const userRecords = await Promise.all(
    [...userIdSet].map(async (uid) => {
      const u = await getUser(uid);
      return [uid, { name: u?.name ?? "Unknown", picture: u?.picture ?? "" }] as const;
    })
  );

  const usersMap = new Map(userRecords);
  const teamsMap = new Map(teams.map((t) => [t.id, t]));

  const leaderboard = buildLeaderboard(brackets, usersMap, games, teamsMap, group.scoringRules);

  const standingsLocked = picksEffectivelyClosed(tournament);

  return (
    <GroupPageClient
      group={group}
      leaderboard={leaderboard}
      currentUserId={userId}
      isGroupAdmin={group.adminUserId === userId || isAppAdmin}
      isAppAdmin={isAppAdmin}
      maskOpponentStandings={!standingsLocked}
      gamesCompletedCount={games.filter((g) => g.status === "final").length}
    />
  );
}

