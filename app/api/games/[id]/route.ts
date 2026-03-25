import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { getUserId } from "@/lib/session";
import { getGame, getAllTeams, getTournament, setGameResult, advanceWinner } from "@/lib/dynamo/queries/games";
import { getBracketsByTournament } from "@/lib/dynamo/queries/brackets";
import { getGroup, getGroupMembers, getGroupMembership } from "@/lib/dynamo/queries/groups";
import { isGroupAdmin } from "@/lib/group-permissions";
import { resolveUserDisplayProfile } from "@/lib/dynamo/queries/users";
import { picksEffectivelyClosed } from "@/lib/picks-lock";
import type { GamePicksResponse } from "@/lib/types";
import {
  resolveTournamentIdFromRequestUrl,
  defaultTournamentId,
  getAllowedTournamentIds,
} from "@/lib/viewing-tournament";

export const dynamic = "force-dynamic";

// GET /api/games/[id] — game details; others' picks only after brackets are effectively locked
// Optional `?groupId=` limits picks to brackets linked in that pool (caller must be a member).
// Optional `?tournamentId=` scopes the game to a season (required when game ids match across years).
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const tid = await resolveTournamentIdFromRequestUrl(req);
  const game = await getGame(tid, params.id);
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });

  const teams = await getAllTeams(tid);
  const teamMap = new Map(teams.map((t) => [t.id, t]));

  const tournament = await getTournament(tid);
  const revealPicks = picksEffectivelyClosed(tournament);

  const groupId = new URL(req.url).searchParams.get("groupId")?.trim() ?? "";

  let picks: GamePicksResponse["picks"] = [];
  if (revealPicks) {
    let brackets = await getBracketsByTournament(tid);

    if (groupId) {
      const session = await getServerSession(getAuthOptions());
      const userId = getUserId(session);
      if (!session?.user || !userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const group = await getGroup(groupId);
      if (!group) {
        return NextResponse.json({ error: "Group not found" }, { status: 404 });
      }
      const isAppAdmin = Boolean((session.user as { isAdmin?: boolean }).isAdmin);
      const membership = await getGroupMembership(groupId, userId);
      const allowed =
        Boolean(membership) || isGroupAdmin(group, userId) || isAppAdmin;
      if (!allowed) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const members = await getGroupMembers(groupId);
      const allowedBracketIds = new Set(
        members.map((m) => String(m.bracketId ?? "").trim()).filter(Boolean),
      );
      brackets = brackets.filter((b) => allowedBracketIds.has(b.bracketId));
    }
    const rows = await Promise.all(
      brackets.map(async (bracket) => {
        const pickedTeamId = bracket.picks[game.gameId];
        if (!pickedTeamId) return null;

        const user = await resolveUserDisplayProfile(bracket.userId);
        const pickedTeam = teamMap.get(pickedTeamId);

        return {
          userId: bracket.userId,
          userName: user.name,
          userPicture: user.picture,
          pickedTeamId,
          pickedTeamName: pickedTeam?.name ?? "Unknown",
          isCorrect:
            game.status === "final"
              ? pickedTeamId === game.winnerId
              : null,
        };
      })
    );
    picks = rows.filter(Boolean) as GamePicksResponse["picks"];
  }

  const response: GamePicksResponse = {
    game,
    team1: game.team1Id ? teamMap.get(game.team1Id) ?? null : null,
    team2: game.team2Id ? teamMap.get(game.team2Id) ?? null : null,
    picks,
    picksHidden: !revealPicks,
  };

  return NextResponse.json(response);
}

// POST /api/games/[id]/result — enter game result (no auth for this year)
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const { winnerId, score1, score2, tournamentId: bodyTid } = body;

  if (!winnerId || score1 == null || score2 == null) {
    return NextResponse.json({ error: "winnerId, score1, score2 required" }, { status: 400 });
  }

  const allowed = await getAllowedTournamentIds();
  const raw = typeof bodyTid === "string" ? bodyTid.trim() : "";
  let adminTid = defaultTournamentId();
  if (raw) {
    if (!allowed.includes(raw)) {
      return NextResponse.json({ error: "Invalid tournamentId" }, { status: 400 });
    }
    adminTid = raw;
  }
  const game = await getGame(adminTid, params.id);
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });

  await setGameResult(adminTid, params.id, winnerId, score1, score2);

  // Always re-apply the winner into the next game slot so the bracket tree stays
  // aligned after any save (new result, score fix, or winner correction).
  if (game.nextGameId && game.nextGameSlot) {
    await advanceWinner(adminTid, game.nextGameId, game.nextGameSlot, winnerId);
  }

  return NextResponse.json({ ok: true });
}

