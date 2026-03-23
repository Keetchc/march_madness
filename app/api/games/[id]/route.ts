import { NextResponse } from "next/server";
import { getGame, getAllTeams, getTournament, setGameResult, advanceWinner } from "@/lib/dynamo/queries/games";
import { getBracketsByTournament } from "@/lib/dynamo/queries/brackets";
import { getUser } from "@/lib/dynamo/queries/users";
import { picksEffectivelyClosed } from "@/lib/picks-lock";
import type { GamePicksResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

const TOURNAMENT_ID = process.env.TOURNAMENT_ID ?? "2026";

// GET /api/games/[id] — game details; others' picks only after brackets are effectively locked
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const game = await getGame(TOURNAMENT_ID, params.id);
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });

  const teams = await getAllTeams(TOURNAMENT_ID);
  const teamMap = new Map(teams.map((t) => [t.id, t]));

  const tournament = await getTournament(TOURNAMENT_ID);
  const revealPicks = picksEffectivelyClosed(tournament);

  let picks: GamePicksResponse["picks"] = [];
  if (revealPicks) {
    const brackets = await getBracketsByTournament(TOURNAMENT_ID);
    const rows = await Promise.all(
      brackets.map(async (bracket) => {
        const pickedTeamId = bracket.picks[game.gameId];
        if (!pickedTeamId) return null;

        const user = await getUser(bracket.userId);
        const pickedTeam = teamMap.get(pickedTeamId);

        return {
          userId: bracket.userId,
          userName: user?.name ?? "Unknown",
          userPicture: user?.picture ?? "",
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
  const { winnerId, score1, score2 } = body;

  if (!winnerId || score1 == null || score2 == null) {
    return NextResponse.json({ error: "winnerId, score1, score2 required" }, { status: 400 });
  }

  const game = await getGame(TOURNAMENT_ID, params.id);
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });

  await setGameResult(TOURNAMENT_ID, params.id, winnerId, score1, score2);

  // Always re-apply the winner into the next game slot so the bracket tree stays
  // aligned after any save (new result, score fix, or winner correction).
  if (game.nextGameId && game.nextGameSlot) {
    await advanceWinner(TOURNAMENT_ID, game.nextGameId, game.nextGameSlot, winnerId);
  }

  return NextResponse.json({ ok: true });
}

