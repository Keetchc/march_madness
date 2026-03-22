import { NextResponse } from "next/server";
import { getGame, getAllTeams, setGameResult, advanceWinner } from "@/lib/dynamo/queries/games";
import { getBracketsByTournament } from "@/lib/dynamo/queries/brackets";
import { getUser } from "@/lib/dynamo/queries/users";
import type { GamePicksResponse } from "@/lib/types";

const TOURNAMENT_ID = process.env.TOURNAMENT_ID ?? "2026";

// GET /api/games/[id] — game details + who picked what (public)
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const game = await getGame(TOURNAMENT_ID, params.id);
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });

  const teams = await getAllTeams(TOURNAMENT_ID);
  const teamMap = new Map(teams.map((t) => [t.id, t]));

  // Get all brackets to find who picked what for this game
  const brackets = await getBracketsByTournament(TOURNAMENT_ID);

  const picks = await Promise.all(
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

  const response: GamePicksResponse = {
    game,
    team1: game.team1Id ? teamMap.get(game.team1Id) ?? null : null,
    team2: game.team2Id ? teamMap.get(game.team2Id) ?? null : null,
    picks: picks.filter(Boolean) as GamePicksResponse["picks"],
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

  // Save result
  await setGameResult(TOURNAMENT_ID, params.id, winnerId, score1, score2);

  // Advance winner to next game if applicable
  if (game.nextGameId && game.nextGameSlot) {
    await advanceWinner(TOURNAMENT_ID, game.nextGameId, game.nextGameSlot, winnerId);
  }

  return NextResponse.json({ ok: true });
}

