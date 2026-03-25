import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getGroup, getGroupMembers, getGroupMembership } from "@/lib/dynamo/queries/groups";
import { isGroupAdmin } from "@/lib/group-permissions";
import { getBracket } from "@/lib/dynamo/queries/brackets";
import { getAllGames, getAllTeams, getTournament } from "@/lib/dynamo/queries/games";
import { resolveUserDisplayProfile } from "@/lib/dynamo/queries/users";
import { buildLeaderboard, isGameFinalStatus } from "@/lib/scoring/engine";
import { computeVsLeaderSnapshot } from "@/lib/scoring/vs-leader";
import { scoringTournamentIdForGroup } from "@/lib/scoring/group-tournament-id";
import { picksEffectivelyClosed } from "@/lib/picks-lock";
import type { Bracket } from "@/lib/types";
import { GroupStandingsClient } from "./GroupStandingsClient";

const TOURNAMENT_ID = process.env.TOURNAMENT_ID ?? "2026";

export default async function GroupPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(getAuthOptions());
  if (!session) redirect("/login");

  const userId = String((session.user as { userId?: string }).userId ?? "");
  const isAppAdmin = Boolean((session.user as { isAdmin?: boolean }).isAdmin);

  const group = await getGroup(params.id);
  if (!group) notFound();

  const membership = await getGroupMembership(params.id, userId);
  if (!membership && !isGroupAdmin(group, userId) && !isAppAdmin) {
    redirect("/dashboard");
  }

  const bracketLinked = String(membership?.bracketId ?? "").trim();
  const needsBracket = (isGroupAdmin(group, userId) || Boolean(membership)) && !bracketLinked;

  const members = await getGroupMembers(params.id);

  const bracketIds = members.map((m) => m.bracketId).filter(Boolean);
  const bracketsRaw = await Promise.all(bracketIds.map((id) => getBracket(id)));
  const brackets = bracketsRaw.filter((b): b is Bracket => b != null);

  const tid = scoringTournamentIdForGroup(group.tournamentId, brackets, TOURNAMENT_ID);
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
    Array.from(userIdSet).map(async (uid) => {
      const u = await resolveUserDisplayProfile(uid);
      return [uid, { name: u.name, picture: u.picture }] as const;
    }),
  );

  const usersMap = new Map(userRecords);
  const teamsMap = new Map(teams.map((t) => [t.id, t]));

  const leaderboard = buildLeaderboard(brackets, usersMap, games, teamsMap, group.scoringRules);

  const bracketByUserId = new Map<string, Bracket>();
  for (const b of brackets) {
    const uid = String(b.userId ?? "").trim();
    if (uid) bracketByUserId.set(uid, b);
  }

  const standingsLocked = picksEffectivelyClosed(tournament);
  const gamesCompletedCount = games.filter((g) => isGameFinalStatus(g.status)).length;
  const maskOpponentStandings = !standingsLocked && gamesCompletedCount === 0;

  const canSeeEveryoneStats =
    !maskOpponentStandings || isGroupAdmin(group, userId) || isAppAdmin;
  const vsLeader = canSeeEveryoneStats
    ? computeVsLeaderSnapshot(userId, leaderboard, bracketByUserId, games, teamsMap, group.scoringRules)
    : null;
  const myBracketId =
    String(bracketLinked).trim() ||
    leaderboard.find((e) => String(e.userId) === String(userId))?.bracketId ||
    "";

  return (
    <GroupStandingsClient
      group={group}
      members={members}
      leaderboard={leaderboard}
      currentUserId={userId}
      isGroupAdmin={isGroupAdmin(group, userId) || isAppAdmin}
      isAppAdmin={isAppAdmin}
      needsBracket={needsBracket}
      maskOpponentStandings={maskOpponentStandings}
      gamesCompletedCount={gamesCompletedCount}
      tournamentName={tournament?.name}
      vsLeader={vsLeader}
      myBracketId={myBracketId}
    />
  );
}
