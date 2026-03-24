/**
 * For each game already final (with winnerId), set picks[gameId] = winnerId so scoring
 * matches results through every completed round. Pending games keep existing picks.
 *
 * Loads `.env.local` before Dynamo (see inspect-bracket-picks.ts).
 *
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/backfill-bracket-picks-from-finals.ts <bracketId>
 *   npm run backfill-bracket-finals -- <bracketId>
 */
import { resolve } from "path";
import { config } from "dotenv";
import { isGameFinalStatus } from "../lib/scoring/engine";
import type { Picks } from "../lib/types";

config({ path: resolve(process.cwd(), ".env.local") });

function applyAwsEnvHygiene(): void {
  const endpoint = process.env.DYNAMODB_ENDPOINT?.trim();
  const key = (
    process.env.MM_ACCESS_KEY_ID ??
    process.env.AWS_ACCESS_KEY_ID ??
    ""
  ).toLowerCase();
  if (!endpoint && key === "local") {
    for (const k of [
      "AWS_ACCESS_KEY_ID",
      "AWS_SECRET_ACCESS_KEY",
      "MM_ACCESS_KEY_ID",
      "MM_SECRET_ACCESS_KEY",
    ] as const) {
      delete process.env[k];
    }
  }
}

applyAwsEnvHygiene();

const TOURNAMENT_ID = process.env.TOURNAMENT_ID ?? "2026";

function normalizeExistingPicks(raw: unknown): Picks {
  if (!raw || typeof raw !== "object") return {};
  const out: Picks = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "string" && v.length > 0) out[String(k)] = v;
  }
  return out;
}

async function main(): Promise<void> {
  const bracketId = process.argv[2]?.trim();
  if (!bracketId) {
    console.error(
      "Usage: ts-node scripts/backfill-bracket-picks-from-finals.ts <bracketId>",
    );
    process.exit(1);
  }

  const { getBracket, updatePicks } = await import("../lib/dynamo/queries/brackets");
  const { getAllGames } = await import("../lib/dynamo/queries/games");

  const bracket = await getBracket(bracketId);
  if (!bracket) {
    console.error("Bracket not found:", bracketId);
    process.exit(1);
  }

  const tid = (bracket.tournamentId ?? "").trim() || TOURNAMENT_ID;
  const games = await getAllGames(tid);

  const picks = normalizeExistingPicks(bracket.picks);
  const beforeKeys = Object.keys(picks).length;

  let filled = 0;
  let changed = 0;
  for (const g of games) {
    if (!isGameFinalStatus(g.status) || !g.winnerId) continue;
    filled++;
    const prev = picks[g.gameId];
    if (prev !== g.winnerId) changed++;
    picks[g.gameId] = g.winnerId;
  }

  await updatePicks(bracketId, picks);

  console.log("Bracket:", bracket.name, `(${bracketId})`);
  console.log("Tournament:", tid);
  console.log(`Final games with winner in schedule: ${filled}`);
  console.log(`Pick keys before: ${beforeKeys} → after: ${Object.keys(picks).length}`);
  console.log(`Keys added or corrected to match results: ${changed}`);
  console.log("Done — pending games were left unchanged.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
