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
  updateGroupName,
  updateGroupSubgroups,
} from "@/lib/dynamo/queries/groups";
import { isGroupAdmin } from "@/lib/group-permissions";
import type { GroupSubgroup } from "@/lib/types";
import { getBracket, getBracketsByTournament } from "@/lib/dynamo/queries/brackets";
import { getAllGames, getAllTeams } from "@/lib/dynamo/queries/games";
import { resolveUserDisplayProfile } from "@/lib/dynamo/queries/users";
import { buildLeaderboard } from "@/lib/scoring/engine";
import { scoringTournamentIdForGroup } from "@/lib/scoring/group-tournament-id";
import { v4 as uuidv4 } from "uuid";
import { defaultTournamentId } from "@/lib/viewing-tournament";

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

  if (!membership && !isGroupAdmin(group, userId) && !isAdmin) {
    return NextResponse.json({ error: "Not a member of this group" }, { status: 403 });
  }

  const members = await getGroupMembers(params.id);

  // Build leaderboard for this group
  const bracketIds = members.map((m) => m.bracketId).filter(Boolean);
  const brackets = await Promise.all(bracketIds.map((id) => getBracket(id)));
  const validBrackets = brackets.filter(Boolean) as NonNullable<Awaited<ReturnType<typeof getBracket>>>[];

  const tid = scoringTournamentIdForGroup(group.tournamentId, validBrackets, defaultTournamentId());
  const [games, teams] = await Promise.all([getAllGames(tid), getAllTeams(tid)]);

  const userIdSet = new Set<string>();
  for (const m of members) {
    if (m.userId) userIdSet.add(String(m.userId));
  }
  for (const b of validBrackets) {
    if (b.userId) userIdSet.add(String(b.userId));
  }

  const userRecords = await Promise.all(
    Array.from(userIdSet).map(async (uid) => {
      const u = await resolveUserDisplayProfile(uid);
      return [uid, { name: u.name, picture: u.picture }] as const;
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

  if (!isGroupAdmin(group, userId) && !(session as any).user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();

  if (body.scoringRules) {
    await updateGroupScoringRules(params.id, body.scoringRules);
  }

  if (typeof body.name === "string") {
    const n = body.name.trim();
    if (!n || n.length > 120) {
      return NextResponse.json({ error: "Name must be 1–120 characters." }, { status: 400 });
    }
    await updateGroupName(params.id, n);
  }

  if (body.subgroups !== undefined) {
    if (!Array.isArray(body.subgroups)) {
      return NextResponse.json({ error: "subgroups must be an array." }, { status: 400 });
    }
    const cleaned: GroupSubgroup[] = [];
    const seen = new Set<string>();
    for (const raw of body.subgroups) {
      if (!raw || typeof raw !== "object") continue;
      const id = typeof (raw as GroupSubgroup).id === "string" ? (raw as GroupSubgroup).id.trim() : "";
      const name = typeof (raw as GroupSubgroup).name === "string" ? (raw as GroupSubgroup).name.trim() : "";
      if (!id || !name || name.length > 80) continue;
      if (seen.has(id)) continue;
      seen.add(id);
      cleaned.push({ id, name });
      if (cleaned.length >= 40) break;
    }
    await updateGroupSubgroups(params.id, cleaned);
  }

  if (body.regenerateInvite) {
    const newToken = uuidv4();
    await regenerateInviteToken(params.id, newToken);
    return NextResponse.json({ inviteToken: newToken });
  }

  return NextResponse.json({ ok: true });
}

