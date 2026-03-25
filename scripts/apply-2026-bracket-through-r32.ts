/**
 * Apply NCAA 2026 Round of 64 + Round of 32 final scores to `bracket-2026.json`,
 * then set Sweet 16 `team1Id`/`team2Id` from winners (games still scheduled).
 *
 *   npx ts-node --project tsconfig.scripts.json scripts/apply-2026-bracket-through-r32.ts
 */
import * as fs from "fs";
import * as path from "path";
import type { Game, GameStatus, Round } from "../lib/types";
import {
  COMPLETED_AT_2026_THROUGH_R32,
  SCORES_2026_THROUGH_R32,
} from "./historical-bracket-score-data";

type BracketGame = Omit<
  Game,
  "tournamentId" | "winnerId" | "score1" | "score2" | "status" | "scheduledAt" | "completedAt"
> & {
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
  tournamentStatus?: string;
  games: BracketGame[];
  [key: string]: unknown;
}

function applyFinalRound(
  data: BracketFile,
  round: Round,
  scores: Record<string, readonly [number, number]>,
  completedAt: string,
): void {
  const list = data.games;
  const byId = new Map(list.map((g) => [g.gameId, g]));
  const inRound = list
    .filter((g) => g.round === round)
    .sort((a, b) => a.gameId.localeCompare(b.gameId));

  for (const ref of inRound) {
    const game = byId.get(ref.gameId)!;
    let t1: string;
    let t2: string;

    if (round === "R64") {
      if (!game.team1Id || !game.team2Id) {
        throw new Error(`${data.tournamentId} ${game.gameId}: R64 needs both teams`);
      }
      t1 = game.team1Id;
      t2 = game.team2Id;
    } else {
      const feeders = list
        .filter((x) => x.nextGameId === game.gameId)
        .sort((a, b) => (a.nextGameSlot ?? 0) - (b.nextGameSlot ?? 0));
      if (feeders.length !== 2) {
        throw new Error(`${data.tournamentId} ${game.gameId}: expected 2 feeder games, got ${feeders.length}`);
      }
      const w1 = byId.get(feeders[0].gameId)!.winnerId;
      const w2 = byId.get(feeders[1].gameId)!.winnerId;
      if (!w1 || !w2) {
        throw new Error(`${data.tournamentId} ${game.gameId}: feeder winners not set`);
      }
      t1 = w1;
      t2 = w2;
      game.team1Id = t1;
      game.team2Id = t2;
    }

    const pair = scores[game.gameId];
    if (!pair) {
      throw new Error(`${data.tournamentId}: missing score for ${game.gameId}`);
    }
    const [s1, s2] = pair;
    if (s1 === s2) {
      throw new Error(`${data.tournamentId} ${game.gameId}: tie score ${s1}-${s2}`);
    }
    game.score1 = s1;
    game.score2 = s2;
    game.winnerId = s1 > s2 ? t1 : t2;
    game.status = "final";
    game.scheduledAt = game.scheduledAt ?? null;
    game.completedAt = completedAt;
  }
}

function propagateScheduledFromFeeders(data: BracketFile, round: Round): void {
  const list = data.games;
  const byId = new Map(list.map((g) => [g.gameId, g]));
  const inRound = list
    .filter((g) => g.round === round)
    .sort((a, b) => a.gameId.localeCompare(b.gameId));

  for (const ref of inRound) {
    const game = byId.get(ref.gameId)!;
    const feeders = list
      .filter((x) => x.nextGameId === game.gameId)
      .sort((a, b) => (a.nextGameSlot ?? 0) - (b.nextGameSlot ?? 0));
    if (feeders.length !== 2) {
      throw new Error(`${data.tournamentId} ${game.gameId}: expected 2 feeder games, got ${feeders.length}`);
    }
    const w1 = byId.get(feeders[0].gameId)!.winnerId;
    const w2 = byId.get(feeders[1].gameId)!.winnerId;
    if (!w1 || !w2) {
      throw new Error(`${data.tournamentId} ${game.gameId}: feeder winners not set`);
    }
    game.team1Id = w1;
    game.team2Id = w2;
    game.score1 = null;
    game.score2 = null;
    game.winnerId = null;
    game.status = "scheduled";
    game.completedAt = null;
  }
}

function clearLaterRounds(data: BracketFile): void {
  for (const game of data.games) {
    if (game.round === "E8" || game.round === "F4" || game.round === "NCG") {
      game.team1Id = null;
      game.team2Id = null;
      game.score1 = null;
      game.score2 = null;
      game.winnerId = null;
      game.status = "scheduled";
      game.completedAt = null;
    }
  }
}

function main() {
  const file = path.join(__dirname, "bracket-2026.json");
  const raw = fs.readFileSync(file, "utf-8");
  const data = JSON.parse(raw) as BracketFile;
  if (data.tournamentId !== "2026") {
    throw new Error(`Expected tournamentId 2026, got ${data.tournamentId}`);
  }

  applyFinalRound(data, "R64", SCORES_2026_THROUGH_R32, COMPLETED_AT_2026_THROUGH_R32);
  applyFinalRound(data, "R32", SCORES_2026_THROUGH_R32, COMPLETED_AT_2026_THROUGH_R32);
  propagateScheduledFromFeeders(data, "S16");
  clearLaterRounds(data);

  data.tournamentStatus = "active";

  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf-8");
  console.log(`Updated ${path.basename(file)}: R64+R32 final, S16 teams set, tournament active.`);
}

main();
