/**
 * Merge final scores into `bracket-2024.json` / `bracket-2025.json`:
 * fills `team1Id`/`team2Id` for post–Round-of-64 games, sets `winnerId`, `score1`/`score2`,
 * `status: "final"`, and `completedAt`.
 *
 *   npx ts-node --project tsconfig.scripts.json scripts/apply-historical-bracket-results.ts 2024
 *   npx ts-node --project tsconfig.scripts.json scripts/apply-historical-bracket-results.ts 2025
 */
import * as fs from "fs";
import * as path from "path";
import type { Game, GameStatus, Round } from "../lib/types";
import { ROUNDS_IN_ORDER } from "../lib/types";
import {
  HISTORICAL_COMPLETED_AT,
  SCORES_2024,
  SCORES_2025,
} from "./historical-bracket-score-data";

type BracketGame = Omit<Game, "tournamentId" | "winnerId" | "score1" | "score2" | "status" | "scheduledAt" | "completedAt"> & {
  winnerId?: string | null;
  score1?: number | null;
  score2?: number | null;
  status?: GameStatus;
  scheduledAt?: string | null;
  completedAt?: string | null;
  espnGameId?: string;
};

interface BracketFile {
  tournamentId: string;
  name: string;
  year: number;
  lockDate: string;
  tournamentStatus?: string;
  teams: unknown[];
  games: BracketGame[];
}

function applyHistoricalResults(
  data: BracketFile,
  scores: Record<string, readonly [number, number]>,
  completedAt: string,
): void {
  const tid = data.tournamentId;
  const list = data.games;
  const byId = new Map(list.map((g) => [g.gameId, g]));

  for (const round of ROUNDS_IN_ORDER as readonly Round[]) {
    const inRound = list.filter((g) => g.round === round).sort((a, b) => a.gameId.localeCompare(b.gameId));
    for (const ref of inRound) {
      const game = byId.get(ref.gameId)!;
      let t1: string;
      let t2: string;

      if (round === "R64") {
        if (!game.team1Id || !game.team2Id) {
          throw new Error(`${tid} ${game.gameId}: R64 needs both teams`);
        }
        t1 = game.team1Id;
        t2 = game.team2Id;
      } else {
        const feeders = list
          .filter((x) => x.nextGameId === game.gameId)
          .sort((a, b) => (a.nextGameSlot ?? 0) - (b.nextGameSlot ?? 0));
        if (feeders.length !== 2) {
          throw new Error(`${tid} ${game.gameId}: expected 2 feeder games, got ${feeders.length}`);
        }
        const w1 = byId.get(feeders[0].gameId)!.winnerId;
        const w2 = byId.get(feeders[1].gameId)!.winnerId;
        if (!w1 || !w2) {
          throw new Error(`${tid} ${game.gameId}: feeder winners not set`);
        }
        t1 = w1;
        t2 = w2;
        game.team1Id = t1;
        game.team2Id = t2;
      }

      const pair = scores[game.gameId];
      if (!pair) {
        throw new Error(`${tid}: missing score for ${game.gameId}`);
      }
      const [s1, s2] = pair;
      if (s1 === s2) {
        throw new Error(`${tid} ${game.gameId}: tie score ${s1}-${s2}`);
      }
      const winner = s1 > s2 ? t1 : t2;
      game.score1 = s1;
      game.score2 = s2;
      game.winnerId = winner;
      game.status = "final";
      game.scheduledAt = game.scheduledAt ?? null;
      game.completedAt = completedAt;
    }
  }

  data.tournamentStatus = "complete";
}

function main() {
  const year = process.argv[2];
  if (year !== "2024" && year !== "2025") {
    console.error("Usage: …/apply-historical-bracket-results.ts 2024|2025");
    process.exit(1);
  }
  const scores = year === "2024" ? SCORES_2024 : SCORES_2025;
  const completedAt = HISTORICAL_COMPLETED_AT[year];
  const file = path.join(__dirname, `bracket-${year}.json`);
  const raw = fs.readFileSync(file, "utf-8");
  const data = JSON.parse(raw) as BracketFile;
  if (data.tournamentId !== year) {
    throw new Error(`Expected tournamentId ${year}, got ${data.tournamentId}`);
  }
  applyHistoricalResults(data, scores, completedAt);
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf-8");
  console.log(`Updated ${path.basename(file)} (${data.games.length} games, status complete).`);
}

main();
