/**
 * Write `scripts/bracket-{tournamentId}.json` from the `*-tournament` DynamoDB table.
 * Use after admin / ESPN sync / seeding so the JSON matches what is in the database.
 *
 * Preserves `_cameron_keetch_picks` (and any other top-level keys not sourced from Dynamo)
 * from the existing output file when the tournament id matches.
 *
 *   npx ts-node --project tsconfig.scripts.json scripts/export-bracket-from-dynamo.ts 2026
 *   TOURNAMENT_ID=2026 npx ts-node --project tsconfig.scripts.json scripts/export-bracket-from-dynamo.ts
 *
 * Requires `.env.local` with `DYNAMO_TABLE_PREFIX` (and AWS or `DYNAMODB_ENDPOINT` for local).
 * Uses the same prefix as `npm run seed` (`.env.local` overrides `.next/amplify-auth.json`).
 */
import "./bootstrap-env";
import { resolve } from "path";
import * as fs from "fs";

import { getTournament, getAllTeams, getAllGames } from "../lib/dynamo/queries/games";
import { TABLES, getDynamoTablePrefixForOps } from "../lib/dynamo/tables";
import type { Game, Team, Tournament } from "../lib/types";
import { ROUNDS_IN_ORDER } from "../lib/types";

const DYNAMO_KEYS = ["pk", "sk"] as const;

const REGION_ORDER = ["East", "South", "West", "Midwest", "FinalFour"] as const;

function stripDynamo<T extends Record<string, unknown>>(row: T): T {
  const o = { ...row };
  for (const k of DYNAMO_KEYS) delete o[k as keyof T];
  return o;
}

function sortTeams(teams: Team[]): Team[] {
  const idx = (r: string) => REGION_ORDER.indexOf(r as (typeof REGION_ORDER)[number]);
  return [...teams].sort((a, b) => {
    const ir = idx(a.region) - idx(b.region);
    if (ir !== 0) return ir;
    return a.seed - b.seed || a.id.localeCompare(b.id);
  });
}

function sortGames(games: Game[]): Game[] {
  return [...games].sort((a, b) => {
    const ir = REGION_ORDER.indexOf(a.region as (typeof REGION_ORDER)[number]) - REGION_ORDER.indexOf(b.region as (typeof REGION_ORDER)[number]);
    if (ir !== 0) return ir;
    const iro = ROUNDS_IN_ORDER.indexOf(a.round) - ROUNDS_IN_ORDER.indexOf(b.round);
    if (iro !== 0) return iro;
    if (a.bracketSlot !== b.bracketSlot) return a.bracketSlot - b.bracketSlot;
    return a.gameId.localeCompare(b.gameId);
  });
}

/** Match `bracket-*.json` shape: games omit `tournamentId` (seed re-applies it). */
function gameToJson(g: Game): Record<string, unknown> {
  const o: Record<string, unknown> = {
    gameId: g.gameId,
    round: g.round,
    region: g.region,
    bracketSlot: g.bracketSlot,
    team1Id: g.team1Id,
    team2Id: g.team2Id,
    nextGameId: g.nextGameId,
    nextGameSlot: g.nextGameSlot,
  };
  if (g.espnGameId != null && g.espnGameId !== "") o.espnGameId = g.espnGameId;
  if (g.winnerId != null) o.winnerId = g.winnerId;
  if (g.score1 != null) o.score1 = g.score1;
  if (g.score2 != null) o.score2 = g.score2;
  if (g.status === "in_progress" || g.status === "final") o.status = g.status;
  if (g.scheduledAt != null) o.scheduledAt = g.scheduledAt;
  if (g.completedAt != null) o.completedAt = g.completedAt;
  return o;
}

function teamToJson(t: Team): Record<string, unknown> {
  const o: Record<string, unknown> = {
    id: t.id,
    name: t.name,
    shortName: t.shortName,
    seed: t.seed,
    region: t.region,
  };
  if (t.espnId != null && t.espnId !== "") o.espnId = t.espnId;
  if (t.logoUrl != null && t.logoUrl !== "") o.logoUrl = t.logoUrl;
  if (t.color != null && t.color !== "") o.color = t.color;
  return o;
}

async function main() {
  const tid = (process.argv[2] || process.env.TOURNAMENT_ID || "2026").trim();
  if (!/^\d{4}$/.test(tid)) {
    console.error("Usage: …/export-bracket-from-dynamo.ts [YYYY]");
    process.exit(1);
  }

  console.log(
    `Export: table=${TABLES.TOURNAMENT} prefix=${getDynamoTablePrefixForOps()} env.DYNAMO_TABLE_PREFIX=${JSON.stringify(process.env.DYNAMO_TABLE_PREFIX ?? "")}`,
  );

  const t = await getTournament(tid);
  if (!t) {
    console.error(
      `No tournament META for TOURNAMENT#${tid} in ${TABLES.TOURNAMENT}. Wrong prefix or empty table?`,
    );
    process.exit(1);
  }

  const [teamsRaw, gamesRaw] = await Promise.all([getAllTeams(tid), getAllGames(tid)]);
  const teams = sortTeams(
    teamsRaw.map((x) => stripDynamo(x as unknown as Record<string, unknown>) as unknown as Team),
  );
  const games = sortGames(
    gamesRaw.map((x) => stripDynamo(x as unknown as Record<string, unknown>) as unknown as Game),
  );

  if (teams.length === 0 || games.length === 0) {
    console.error(`Tournament ${tid} has teams=${teams.length}, games=${games.length} (expected 64 / 63)`);
    process.exit(1);
  }

  const meta = stripDynamo(t as unknown as Record<string, unknown>) as unknown as Tournament;

  const outPath = resolve(process.cwd(), "scripts", `bracket-${tid}.json`);
  let extras: Record<string, unknown> = {};
  if (fs.existsSync(outPath)) {
    try {
      const prev = JSON.parse(fs.readFileSync(outPath, "utf-8")) as Record<string, unknown>;
      if (prev.tournamentId === tid) {
        for (const key of Object.keys(prev)) {
          if (
            key !== "tournamentId" &&
            key !== "name" &&
            key !== "year" &&
            key !== "lockDate" &&
            key !== "tournamentStatus" &&
            key !== "teams" &&
            key !== "games"
          ) {
            extras[key] = prev[key];
          }
        }
      }
    } catch {
      /* ignore corrupt previous file */
    }
  }

  const payload: Record<string, unknown> = {
    tournamentId: meta.tournamentId,
    name: meta.name,
    year: meta.year,
    lockDate: meta.lockDate,
    tournamentStatus: meta.status,
    teams: teams.map((x) => teamToJson(x)),
    games: games.map((g) => gameToJson(g)),
    ...extras,
  };

  const finals = games.filter((g) => g.status === "final").length;
  const withAdv = games.filter((g) => g.round !== "R64" && (g.team1Id != null || g.team2Id != null)).length;

  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + "\n", "utf-8");
  console.log(
    `Wrote ${outPath} (${teams.length} teams, ${games.length} games, status ${meta.status}, ${finals} final, ${withAdv} non-R64 games with at least one team slot filled).`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
