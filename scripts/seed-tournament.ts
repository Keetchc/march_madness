import "./bootstrap-env";

/**
 * Seed the tournament structure into DynamoDB.
 *
 * Usage:
 *   npm run seed                          # uses default 2026 bracket
 *   BRACKET_FILE=./my-bracket.json npm run seed
 *
 * Bracket JSON format (see scripts/bracket-template.json for example):
 * {
 *   "tournamentId": "2026",
 *   "name": "NCAA Tournament 2026",
 *   "year": 2026,
 *   "lockDate": "2026-03-19T12:00:00Z",
 *   "teams": [
 *     { "id": "duke", "name": "Duke", "shortName": "DUKE", "seed": 1, "region": "East", "espnId": "150" }
 *   ],
 *   "games": [
 *     {
 *       "gameId": "east-r64-1", "round": "R64", "region": "East", "bracketSlot": 1,
 *       "team1Id": "duke", "team2Id": "unc-asheville",
 *       "nextGameId": "east-r32-1", "nextGameSlot": 1,
 *       "espnGameId": "401638576"
 *     }
 *   ]
 * }
 */

import * as path from "path";
import * as fs from "fs";
import { upsertTournament, upsertTeam, upsertGame } from "../lib/dynamo/queries/games";
import type { Tournament, Team, Game } from "../lib/types";

const BRACKET_FILE = process.env.BRACKET_FILE
  ?? path.join(__dirname, "bracket-2026.json");

interface BracketGameInput {
  gameId: string;
  round: Game["round"];
  region: Game["region"];
  bracketSlot: number;
  team1Id: string | null;
  team2Id: string | null;
  nextGameId: string | null;
  nextGameSlot: Game["nextGameSlot"];
  espnGameId?: string;
  /** When set (historical / completed tournaments), overrides seed defaults. */
  winnerId?: string | null;
  score1?: number | null;
  score2?: number | null;
  status?: Game["status"];
  scheduledAt?: string | null;
  completedAt?: string | null;
}

interface BracketFile {
  tournamentId: string;
  name: string;
  year: number;
  lockDate: string;
  /** When set (e.g. `complete` for past seasons), overrides default `pending`. */
  tournamentStatus?: Tournament["status"];
  teams: Team[];
  games: BracketGameInput[];
}

export async function seedBracketFromFile(bracketFilePath: string): Promise<void> {
  if (!fs.existsSync(bracketFilePath)) {
    throw new Error(
      `Bracket file not found: ${bracketFilePath}\n` +
        "Create a bracket JSON or set BRACKET_FILE. See scripts/bracket-template.json.",
    );
  }

  const raw = fs.readFileSync(bracketFilePath, "utf-8");
  const data: BracketFile = JSON.parse(raw);

  console.log(`\n🏀 Seeding tournament: ${data.name} (${data.tournamentId})\n`);

  const tournament: Tournament = {
    tournamentId: data.tournamentId,
    name: data.name,
    year: data.year,
    status: data.tournamentStatus ?? "pending",
    lockDate: data.lockDate,
    createdAt: new Date().toISOString(),
  };
  await upsertTournament(tournament);
  console.log(`  ✅ Tournament: ${data.name}`);

  console.log(`\n  Seeding ${data.teams.length} teams...`);
  for (const team of data.teams) {
    await upsertTeam(data.tournamentId, team);
    process.stdout.write(".");
  }
  console.log(` done`);

  console.log(`\n  Seeding ${data.games.length} games...`);
  for (const gameInput of data.games) {
    const hasResult =
      gameInput.winnerId != null &&
      gameInput.score1 != null &&
      gameInput.score2 != null &&
      gameInput.status === "final";
    const game: Game = {
      gameId: gameInput.gameId,
      round: gameInput.round,
      region: gameInput.region,
      bracketSlot: gameInput.bracketSlot,
      team1Id: gameInput.team1Id,
      team2Id: gameInput.team2Id,
      nextGameId: gameInput.nextGameId,
      nextGameSlot: gameInput.nextGameSlot,
      tournamentId: data.tournamentId,
      winnerId: hasResult ? gameInput.winnerId! : null,
      score1: hasResult ? gameInput.score1! : null,
      score2: hasResult ? gameInput.score2! : null,
      status: hasResult ? "final" : "scheduled",
      scheduledAt: gameInput.scheduledAt ?? null,
      completedAt: hasResult ? (gameInput.completedAt ?? null) : null,
      ...(gameInput.espnGameId != null ? { espnGameId: gameInput.espnGameId } : {}),
    };
    await upsertGame(data.tournamentId, game);
    process.stdout.write(".");
  }
  console.log(` done`);

  console.log(`\n✅ Seed complete!`);
  console.log(`   Teams: ${data.teams.length}`);
  console.log(`   Games: ${data.games.length}`);
}

async function main() {
  await seedBracketFromFile(BRACKET_FILE);
  console.log(`\nNow open http://localhost:3001 (DynamoDB Admin) to verify the data.`);
  console.log(`Or visit http://localhost:3000/dashboard to start picking.\n`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error("\n❌ Seed failed:", err);
    process.exit(1);
  });
}

