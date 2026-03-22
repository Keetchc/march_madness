import { NextResponse } from "next/server";
import { fetchEspnScoreboard, mapEspnStatus, extractEspnWinner } from "@/lib/espn/client";
import { getAllGames, getAllTeams, setGameResult, advanceWinner, getGameByEspnId } from "@/lib/dynamo/queries/games";

export const dynamic = "force-dynamic";

const TOURNAMENT_ID = process.env.TOURNAMENT_ID ?? "2026";
const SYNC_SECRET = process.env.ESPN_SYNC_SECRET ?? "dev-sync-secret";

export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${SYNC_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [events, teams] = await Promise.all([
    fetchEspnScoreboard(),
    getAllTeams(TOURNAMENT_ID),
  ]);

  const espnIdToTeamId = new Map(
    teams.filter((t) => t.espnId).map((t) => [t.espnId!, t.id])
  );

  const updated: string[] = [];
  const errors: string[] = [];

  for (const event of events) {
    const status = mapEspnStatus(event.status.type.name);
    if (status !== "final") continue;

    try {
      const game = await getGameByEspnId(TOURNAMENT_ID, event.id);
      if (!game) continue;
      if (game.status === "final") continue;

      const espnWinnerId = extractEspnWinner(event);
      if (!espnWinnerId) continue;

      const ourWinnerId = espnIdToTeamId.get(espnWinnerId);
      if (!ourWinnerId) {
        errors.push(`No team mapping for ESPN ID ${espnWinnerId} in game ${game.gameId}`);
        continue;
      }

      const competitors = event.competitions?.[0]?.competitors ?? [];
      const comp0OurId = espnIdToTeamId.get(competitors[0]?.team?.id);

      let score1: number, score2: number;
      if (comp0OurId === game.team1Id) {
        score1 = parseInt(competitors[0]?.score ?? "0", 10);
        score2 = parseInt(competitors[1]?.score ?? "0", 10);
      } else {
        score1 = parseInt(competitors[1]?.score ?? "0", 10);
        score2 = parseInt(competitors[0]?.score ?? "0", 10);
      }

      await setGameResult(TOURNAMENT_ID, game.gameId, ourWinnerId, score1, score2);

      if (game.nextGameId && game.nextGameSlot) {
        await advanceWinner(TOURNAMENT_ID, game.nextGameId, game.nextGameSlot, ourWinnerId);
      }

      updated.push(game.gameId);
    } catch (err) {
      errors.push(`Event ${event.id}: ${String(err)}`);
    }
  }

  return NextResponse.json({
    checked: events.length,
    updated: updated.length,
    updatedIds: updated,
    errors,
  });
}
