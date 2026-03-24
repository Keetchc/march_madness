import { NextResponse } from "next/server";
import { requireSession, getUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

import {
  getGroup,
  getGroupMembers,
  getGroupMembership,
  addMember,
  updateMemberScore,
  regenerateInviteToken,
  updateGroupScoringRules,
} from "@/lib/dynamo/queries/groups";
import { getBracket, getBracketsByTournament } from "@/lib/dynamo/queries/brackets";
import { getAllGames, getAllTeams } from "@/lib/dynamo/queries/games";
import { getUser } from "@/lib/dynamo/queries/users";
import { buildLeaderboard } from "@/lib/scoring/engine";
import { v4 as uuidv4 } from "uuid";

const TOURNAMENT_ID = process.env.TOURNAMENT_ID ?? "2026";

// GET /api/groups/[id] — group info + leaderboard
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { session, error } = await requireSession();
  if (error) return error;

  const userId = getUserId(session);
  const group = await getGroup(params.id);
  if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });

  const membership = await getGroupMembership(params.id, userId);
  const isAdmin = (session as any).user?.isAdmin;

  if (!membership && group.adminUserId !== userId && !isAdmin) {
    return NextResponse.json({ error: "Not a member of this group" }, { status: 403 });
  }

  const members = await getGroupMembers(params.id);

  // Build leaderboard for this group
  const bracketIds = members.map((m) => m.bracketId).filter(Boolean);
  const brackets = await Promise.all(bracketIds.map((id) => getBracket(id)));
  const validBrackets = brackets.filter(Boolean) as NonNullable<Awaited<ReturnType<typeof getBracket>>>[];

  const tid = group.tournamentId ?? TOURNAMENT_ID;
  const [games, teams] = await Promise.all([getAllGames(tid), getAllTeams(tid)]);

  const userIdSet = new Set<string>();
  for (const m of members) {
    if (m.userId) userIdSet.add(String(m.userId));
  }
  for (const b of validBrackets) {
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

  const leaderboard = buildLeaderboard(validBrackets, usersMap, games, teamsMap, group.scoringRules);

  // Persist updated scores back to member records
  await Promise.all(
    leaderboard.map((entry) =>
      updateMemberScore(params.id, entry.userId, entry.score, entry.rank)
    )
  );

  return NextResponse.json({ group, members, leaderboard });
}

// PATCH /api/groups/[id] — update scoring rules (admin only)
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { session, error } = await requireSession();
  if (error) return error;

  const userId = getUserId(session);
  const group = await getGroup(params.id);
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (group.adminUserId !== userId && !(session as any).user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();

  if (body.scoringRules) {
    await updateGroupScoringRules(params.id, body.scoringRules);
  }

  if (body.regenerateInvite) {
    const newToken = uuidv4();
    await regenerateInviteToken(params.id, newToken);
    return NextResponse.json({ inviteToken: newToken });
  }

  return NextResponse.json({ ok: true });
}

