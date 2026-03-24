/**
 * Compare stored picks vs full tournament schedule by round.
 * Loads `.env.local` before any Dynamo client init (imports alone used to skip env).
 *
 * Usage: npx ts-node --project tsconfig.scripts.json scripts/inspect-bracket-picks.ts <bracketId>
 *     or npm run inspect-bracket -- <bracketId>
 */
import { resolve } from "path";
import { config } from "dotenv";
import type { Game, Round } from "../lib/types";

config({ path: resolve(process.cwd(), ".env.local") });

/** Dummy keys are for DynamoDB Local only; sending them to real AWS causes UnrecognizedClientException. */
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
const ROUNDS: Round[] = ["R64", "R32", "S16", "E8", "F4", "NCG"];

async function main(): Promise<void> {
  const bracketId = process.argv[2];
  if (!bracketId) {
    console.error("Usage: ts-node scripts/inspect-bracket-picks.ts <bracketId>");
    process.exit(1);
  }

  const { getBracket } = await import("../lib/dynamo/queries/brackets");
  const { getAllGames } = await import("../lib/dynamo/queries/games");

  const bracket = await getBracket(bracketId);
  if (!bracket) {
    console.error("Bracket not found:", bracketId);
    process.exit(1);
  }

  const tid = (bracket.tournamentId ?? "").trim() || TOURNAMENT_ID;
  const games = await getAllGames(tid);
  const byRound = new Map<Round, Game[]>();
  for (const r of ROUNDS) byRound.set(r, []);
  for (const g of games) {
    const list = byRound.get(g.round);
    if (list) list.push(g);
  }

  const picks = bracket.picks && typeof bracket.picks === "object" ? bracket.picks : {};
  const pickKeys = new Set(Object.keys(picks));
  const gameById = new Map(games.map((g) => [g.gameId, g]));

  console.log("Bracket:", bracket.name);
  console.log("bracketId:", bracket.bracketId);
  console.log("tournamentId:", tid, "(from bracket or env)");
  console.log("Total pick keys:", pickKeys.size);
  console.log("");

  console.log("--- Picks per round (games in schedule vs keys in picks) ---");
  for (const round of ROUNDS) {
    const roundGames = byRound.get(round) ?? [];
    const withPick = roundGames.filter((g) => pickKeys.has(g.gameId));
    const missing = roundGames.filter((g) => !pickKeys.has(g.gameId));
    console.log(
      `${round}: ${withPick.length}/${roundGames.length} games have a stored pick` +
        (missing.length ? ` (missing: ${missing.map((g) => g.gameId).join(", ")})` : ""),
    );
  }

  const orphanPickKeys = Array.from(pickKeys).filter((k) => !gameById.has(k));
  if (orphanPickKeys.length) {
    console.log("");
    console.log("Pick keys not matching any game in this tournament:", orphanPickKeys.join(", "));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
