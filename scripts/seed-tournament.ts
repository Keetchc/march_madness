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

interface BracketFile {
  tournamentId: string;
  name: string;
  year: number;
  lockDate: string;
  teams: Team[];
  games: Omit<Game, "winnerId" | "score1" | "score2" | "status" | "scheduledAt" | "completedAt" | "tournamentId">[];
}

async function main() {
  if (!fs.existsSync(BRACKET_FILE)) {
    console.error(`\n❌ Bracket file not found: ${BRACKET_FILE}`);
    console.log("\nCreate a bracket JSON file or set BRACKET_FILE env var.");
    console.log("See scripts/bracket-template.json for the format.\n");
    process.exit(1);
  }

  const raw = fs.readFileSync(BRACKET_FILE, "utf-8");
  const data: BracketFile = JSON.parse(raw);

  console.log(`\n🏀 Seeding tournament: ${data.name} (${data.tournamentId})\n`);

  // 1. Upsert tournament record
  const tournament: Tournament = {
    tournamentId: data.tournamentId,
    name: data.name,
    year: data.year,
    status: "pending",
    lockDate: data.lockDate,
    createdAt: new Date().toISOString(),
  };
  await upsertTournament(tournament);
  console.log(`  ✅ Tournament: ${data.name}`);

  // 2. Upsert all teams
  console.log(`\n  Seeding ${data.teams.length} teams...`);
  for (const team of data.teams) {
    await upsertTeam(data.tournamentId, team);
    process.stdout.write(".");
  }
  console.log(` done`);

  // 3. Upsert all games (with defaults for unplayed fields)
  console.log(`\n  Seeding ${data.games.length} games...`);
  for (const gameInput of data.games) {
    const game: Game = {
      ...gameInput,
      tournamentId: data.tournamentId,
      winnerId: null,
      score1: null,
      score2: null,
      status: "scheduled",
      scheduledAt: null,
      completedAt: null,
    };
    await upsertGame(data.tournamentId, game);
    process.stdout.write(".");
  }
  console.log(` done`);

  console.log(`\n✅ Seed complete!`);
  console.log(`   Teams: ${data.teams.length}`);
  console.log(`   Games: ${data.games.length}`);
  console.log(`\nNow open http://localhost:3001 (DynamoDB Admin) to verify the data.`);
  console.log(`Or visit http://localhost:3000/dashboard to start picking.\n`);
}

main().catch((err) => {
  console.error("\n❌ Seed failed:", err);
  process.exit(1);
});

