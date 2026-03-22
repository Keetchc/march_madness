/**
 * Seeds the bracket-2026.json picks as a demo bracket for testing.
 * In production, users submit their own picks via the UI.
 *
 * Usage: npx ts-node --project tsconfig.scripts.json scripts/seed-demo-picks.ts
 */

import * as path from "path";
import * as fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { createBracket } from "../lib/dynamo/queries/brackets";
import type { Bracket } from "../lib/types";

const BRACKET_FILE = path.join(__dirname, "bracket-2026.json");
const TOURNAMENT_ID = process.env.TOURNAMENT_ID ?? "2026";

// Demo user ID — replace with a real Google userId after first login
const DEMO_USER_ID = process.env.DEMO_USER_ID ?? "demo-user-replace-me";

async function main() {
  const raw = fs.readFileSync(BRACKET_FILE, "utf-8");
  const data = JSON.parse(raw);
  const picks = data._cameron_keetch_picks?.picks ?? {};

  const bracket: Bracket = {
    bracketId: uuidv4(),
    userId: DEMO_USER_ID,
    tournamentId: TOURNAMENT_ID,
    name: "Cameron Keetch's Bracket",
    picks,
    score: 0,
    maxPossibleScore: 0,
    isEliminated: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await createBracket(bracket);
  console.log(`\n✅ Seeded bracket: "${bracket.name}"`);
  console.log(`   Bracket ID: ${bracket.bracketId}`);
  console.log(`   Picks: ${Object.keys(picks).length} games picked`);
  console.log(`   Champion pick: ${data._cameron_keetch_picks?.champion}`);
  console.log(`\nTo use with a real user, set DEMO_USER_ID=<your-google-id> and re-run.\n`);
}

main().catch(console.error);

