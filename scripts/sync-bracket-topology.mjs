/**
 * Copy the 63-game `games` array from bracket-2026.json → bracket-topology.json.
 * Run after you change game wiring, `gameId`s, or `nextGameId` / F4 links on the live 2026 file.
 *
 *   node scripts/sync-bracket-topology.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const live = path.join(__dirname, "bracket-2026.json");
const topoPath = path.join(__dirname, "bracket-topology.json");

const b = JSON.parse(fs.readFileSync(live, "utf8"));
if (!Array.isArray(b.games) || b.games.length !== 63) {
  throw new Error(`Expected 63 games in bracket-2026.json, got ${b.games?.length}`);
}

const topo = {
  _comment:
    "Topology-only clone for build-historical-brackets.mjs. Regenerate via: node scripts/sync-bracket-topology.mjs",
  tournamentId: "TOPOLOGY",
  name: "Bracket topology (63 games)",
  year: 0,
  lockDate: "1970-01-01T00:00:00.000Z",
  teams: [],
  games: b.games,
};

fs.writeFileSync(topoPath, JSON.stringify(topo, null, 2) + "\n");
console.log("Wrote", topoPath, "from", path.basename(live));
