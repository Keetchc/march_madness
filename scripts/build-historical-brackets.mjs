/**
 * Rebuild bracket-2024.json / bracket-2025.json from `bracket-topology.json` (63-game shell).
 * Seeds + First Four winners from Wikipedia (2024 / 2025 NCAA men's tournaments).
 *
 *   node scripts/build-historical-brackets.mjs
 *
 * Never reads or writes `bracket-2026.json` — that file is the live 2026 season + extras
 * (e.g. `_cameron_keetch_picks`). If F4 wiring or `gameId`s change, update `bracket-topology.json`
 * (regenerate from `bracket-2026.json` games via the one-liner in README or `npm run …` if added).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const R64_PAIRS = [
  [1, 16],
  [8, 9],
  [5, 12],
  [4, 13],
  [6, 11],
  [3, 14],
  [7, 10],
  [2, 15],
];

const REGION_KEYS = [
  ["East", "east"],
  ["South", "south"],
  ["West", "west"],
  ["Midwest", "mid"],
];

/** @param {{ id: string, name: string, shortName: string, seed: number, espnId?: string }[]} seeds1to16 */
function teamsFromSeeds(seeds1to16, region) {
  return seeds1to16.map((t) => {
    const o = { id: t.id, name: t.name, shortName: t.shortName, seed: t.seed, region };
    if (t.espnId) o.espnId = t.espnId;
    return o;
  });
}

function seedMap(list) {
  const m = new Map();
  for (const t of list) m.set(t.seed, t.id);
  return m;
}

function patchR64(games, prefix, bySeed) {
  for (let slot = 1; slot <= 8; slot++) {
    const [a, b] = R64_PAIRS[slot - 1];
    const gid = `${prefix}-r64-${slot}`;
    const g = games.find((x) => x.gameId === gid);
    if (!g) throw new Error(`Missing game ${gid}`);
    g.team1Id = bySeed.get(a);
    g.team2Id = bySeed.get(b);
  }
}

function stripEspnGameIds(games) {
  for (const g of games) delete g.espnGameId;
}

// ─── 2024: First Four winners — Wagner (16W), Colorado St. (10MW), Grambling (16MW), Colorado (10S) ───
const data2024 = {
  meta: {
    tournamentId: "2024",
    name: "NCAA Tournament 2024",
    year: 2024,
    lockDate: "2024-03-19T17:00:00.000Z",
    tournamentStatus: "complete",
  },
  East: [
    { id: "uconn", name: "UConn", shortName: "UCON", seed: 1, espnId: "41" },
    { id: "iowast", name: "Iowa St.", shortName: "IAST", seed: 2, espnId: "66" },
    { id: "illinois", name: "Illinois", shortName: "ILL", seed: 3, espnId: "356" },
    { id: "auburn", name: "Auburn", shortName: "AUB", seed: 4, espnId: "2" },
    { id: "sdsu", name: "San Diego St.", shortName: "SDSU", seed: 5 },
    { id: "byu", name: "BYU", shortName: "BYU", seed: 6, espnId: "252" },
    { id: "washst", name: "Washington St.", shortName: "WSU", seed: 7 },
    { id: "fau", name: "Florida Atlantic", shortName: "FAU", seed: 8 },
    { id: "northwestern", name: "Northwestern", shortName: "NW", seed: 9, espnId: "77" },
    { id: "drake", name: "Drake", shortName: "DRKE", seed: 10 },
    { id: "duquesne", name: "Duquesne", shortName: "DUQ", seed: 11 },
    { id: "uab", name: "UAB", shortName: "UAB", seed: 12 },
    { id: "yale", name: "Yale", shortName: "YALE", seed: 13, espnId: "43" },
    { id: "morehead", name: "Morehead St.", shortName: "MORE", seed: 14 },
    { id: "soudakst", name: "South Dakota St.", shortName: "SDST", seed: 15 },
    { id: "stetson", name: "Stetson", shortName: "STET", seed: 16 },
  ],
  South: [
    { id: "houston", name: "Houston", shortName: "HOU", seed: 1, espnId: "248" },
    { id: "marquette", name: "Marquette", shortName: "MARQ", seed: 2 },
    { id: "kentucky", name: "Kentucky", shortName: "UK", seed: 3, espnId: "96" },
    { id: "duke", name: "Duke", shortName: "DUKE", seed: 4, espnId: "150" },
    { id: "wisconsin", name: "Wisconsin", shortName: "WISC", seed: 5, espnId: "275" },
    { id: "texastech", name: "Texas Tech", shortName: "TTU", seed: 6, espnId: "2641" },
    { id: "florida", name: "Florida", shortName: "FLA", seed: 7, espnId: "57" },
    { id: "nebraska", name: "Nebraska", shortName: "NEB", seed: 8, espnId: "158" },
    { id: "texasam", name: "Texas A&M", shortName: "TXAM", seed: 9 },
    { id: "colorado", name: "Colorado", shortName: "COLO", seed: 10 },
    { id: "ncstate", name: "NC State", shortName: "NCST", seed: 11 },
    { id: "jmu", name: "James Madison", shortName: "JMU", seed: 12 },
    { id: "vermont", name: "Vermont", shortName: "UVM", seed: 13 },
    { id: "oakland", name: "Oakland", shortName: "OAK", seed: 14 },
    { id: "wku", name: "Western Kentucky", shortName: "WKU", seed: 15 },
    { id: "longwood", name: "Longwood", shortName: "LONG", seed: 16 },
  ],
  West: [
    { id: "unc", name: "North Carolina", shortName: "UNC", seed: 1, espnId: "153" },
    { id: "arizona", name: "Arizona", shortName: "ZONA", seed: 2, espnId: "12" },
    { id: "baylor", name: "Baylor", shortName: "BAY", seed: 3, espnId: "239" },
    { id: "alabama", name: "Alabama", shortName: "BAMA", seed: 4, espnId: "333" },
    { id: "stmarys", name: "Saint Mary's", shortName: "STMY", seed: 5 },
    { id: "clemson", name: "Clemson", shortName: "CLEM", seed: 6, espnId: "228" },
    { id: "dayton", name: "Dayton", shortName: "DAY", seed: 7 },
    { id: "missst", name: "Mississippi St.", shortName: "MSST", seed: 8 },
    { id: "michst", name: "Michigan St.", shortName: "MSU", seed: 9, espnId: "127" },
    { id: "nevada", name: "Nevada", shortName: "NEV", seed: 10 },
    { id: "newmex", name: "New Mexico", shortName: "UNM", seed: 11 },
    { id: "gcu", name: "Grand Canyon", shortName: "GCU", seed: 12 },
    { id: "charleston", name: "Charleston", shortName: "COFC", seed: 13 },
    { id: "colgate", name: "Colgate", shortName: "COLG", seed: 14 },
    { id: "longbeach", name: "Long Beach St.", shortName: "LBSU", seed: 15 },
    { id: "wagner", name: "Wagner", shortName: "WAG", seed: 16 },
  ],
  Midwest: [
    { id: "purdue", name: "Purdue", shortName: "PUR", seed: 1, espnId: "2509" },
    { id: "tennessee", name: "Tennessee", shortName: "TENN", seed: 2, espnId: "2633" },
    { id: "creighton", name: "Creighton", shortName: "CREI", seed: 3 },
    { id: "kansas", name: "Kansas", shortName: "KU", seed: 4, espnId: "2305" },
    { id: "gonzaga", name: "Gonzaga", shortName: "ZAGS", seed: 5 },
    { id: "scarolina", name: "South Carolina", shortName: "SC", seed: 6 },
    { id: "texas", name: "Texas", shortName: "TEX", seed: 7 },
    { id: "utahst", name: "Utah State", shortName: "USU", seed: 8 },
    { id: "tcu", name: "TCU", shortName: "TCU", seed: 9, espnId: "2628" },
    { id: "colost", name: "Colorado St.", shortName: "CSU", seed: 10 },
    { id: "oregon", name: "Oregon", shortName: "ORE", seed: 11, espnId: "2483" },
    { id: "mcneese", name: "McNeese", shortName: "MCN", seed: 12 },
    { id: "samford", name: "Samford", shortName: "SAM", seed: 13 },
    { id: "akron", name: "Akron", shortName: "AKR", seed: 14 },
    { id: "stpeters", name: "Saint Peter's", shortName: "STP", seed: 15 },
    { id: "grambling", name: "Grambling", shortName: "GRAM", seed: 16 },
  ],
};

// ─── 2025: FF — Mt St Mary's (16E), Alabama St (16S), UNC (11S), Xavier (11MW) ───
const data2025 = {
  meta: {
    tournamentId: "2025",
    name: "NCAA Tournament 2025",
    year: 2025,
    lockDate: "2025-03-18T17:00:00.000Z",
    tournamentStatus: "complete",
  },
  East: [
    { id: "duke", name: "Duke", shortName: "DUKE", seed: 1, espnId: "150" },
    { id: "alabama", name: "Alabama", shortName: "BAMA", seed: 2, espnId: "333" },
    { id: "wisconsin", name: "Wisconsin", shortName: "WISC", seed: 3, espnId: "275" },
    { id: "arizona", name: "Arizona", shortName: "ZONA", seed: 4, espnId: "12" },
    { id: "oregon", name: "Oregon", shortName: "ORE", seed: 5, espnId: "2483" },
    { id: "byu", name: "BYU", shortName: "BYU", seed: 6, espnId: "252" },
    { id: "stmarys", name: "Saint Mary's", shortName: "STMY", seed: 7 },
    { id: "missst", name: "Mississippi St.", shortName: "MSST", seed: 8 },
    { id: "baylor", name: "Baylor", shortName: "BAY", seed: 9, espnId: "239" },
    { id: "vanderbilt", name: "Vanderbilt", shortName: "VAN", seed: 10, espnId: "238" },
    { id: "vcu", name: "VCU", shortName: "VCU", seed: 11 },
    { id: "liberty", name: "Liberty", shortName: "LIB", seed: 12 },
    { id: "akron", name: "Akron", shortName: "AKR", seed: 13 },
    { id: "montana", name: "Montana", shortName: "MONT", seed: 14 },
    { id: "robmorris", name: "Robert Morris", shortName: "RMU", seed: 15 },
    { id: "mtstmarys", name: "Mount St. Mary's", shortName: "MSM", seed: 16 },
  ],
  South: [
    { id: "auburn", name: "Auburn", shortName: "AUB", seed: 1, espnId: "2" },
    { id: "michst", name: "Michigan St.", shortName: "MSU", seed: 2, espnId: "127" },
    { id: "iowast", name: "Iowa St.", shortName: "IAST", seed: 3, espnId: "66" },
    { id: "texasam", name: "Texas A&M", shortName: "TXAM", seed: 4 },
    { id: "michigan", name: "Michigan", shortName: "MICH", seed: 5 },
    { id: "olemiss", name: "Ole Miss", shortName: "MISS", seed: 6 },
    { id: "marquette", name: "Marquette", shortName: "MARQ", seed: 7 },
    { id: "louisville", name: "Louisville", shortName: "LOU", seed: 8, espnId: "97" },
    { id: "creighton", name: "Creighton", shortName: "CREI", seed: 9 },
    { id: "newmex", name: "New Mexico", shortName: "UNM", seed: 10 },
    { id: "unc", name: "North Carolina", shortName: "UNC", seed: 11, espnId: "153" },
    { id: "ucsd", name: "UC San Diego", shortName: "UCSD", seed: 12 },
    { id: "yale", name: "Yale", shortName: "YALE", seed: 13, espnId: "43" },
    { id: "lipscomb", name: "Lipscomb", shortName: "LIP", seed: 14 },
    { id: "bryant", name: "Bryant", shortName: "BRY", seed: 15 },
    { id: "alabamast", name: "Alabama St.", shortName: "ALST", seed: 16 },
  ],
  West: [
    { id: "florida", name: "Florida", shortName: "FLA", seed: 1, espnId: "57" },
    { id: "stjohns", name: "St. John's", shortName: "STJ", seed: 2, espnId: "2599" },
    { id: "texastech", name: "Texas Tech", shortName: "TTU", seed: 3, espnId: "2641" },
    { id: "maryland", name: "Maryland", shortName: "MD", seed: 4 },
    { id: "memphis", name: "Memphis", shortName: "MEM", seed: 5 },
    { id: "missouri", name: "Missouri", shortName: "MIZ", seed: 6 },
    { id: "kansas", name: "Kansas", shortName: "KU", seed: 7, espnId: "2305" },
    { id: "uconn", name: "UConn", shortName: "UCON", seed: 8, espnId: "41" },
    { id: "oklahoma", name: "Oklahoma", shortName: "OU", seed: 9 },
    { id: "arkansas", name: "Arkansas", shortName: "ARK", seed: 10 },
    { id: "drake", name: "Drake", shortName: "DRKE", seed: 11 },
    { id: "colost", name: "Colorado St.", shortName: "CSU", seed: 12 },
    { id: "gcu", name: "Grand Canyon", shortName: "GCU", seed: 13 },
    { id: "uncw", name: "UNC Wilmington", shortName: "UNCW", seed: 14 },
    { id: "omaha", name: "Omaha", shortName: "OMA", seed: 15 },
    { id: "norfolk", name: "Norfolk St.", shortName: "NSU", seed: 16 },
  ],
  Midwest: [
    { id: "houston", name: "Houston", shortName: "HOU", seed: 1, espnId: "248" },
    { id: "tennessee", name: "Tennessee", shortName: "TENN", seed: 2, espnId: "2633" },
    { id: "kentucky", name: "Kentucky", shortName: "UK", seed: 3, espnId: "96" },
    { id: "purdue", name: "Purdue", shortName: "PUR", seed: 4, espnId: "2509" },
    { id: "clemson", name: "Clemson", shortName: "CLEM", seed: 5, espnId: "228" },
    { id: "illinois", name: "Illinois", shortName: "ILL", seed: 6, espnId: "356" },
    { id: "ucla", name: "UCLA", shortName: "UCLA", seed: 7, espnId: "26" },
    { id: "gonzaga", name: "Gonzaga", shortName: "ZAGS", seed: 8 },
    { id: "georgia", name: "Georgia", shortName: "UGA", seed: 9 },
    { id: "utahst", name: "Utah State", shortName: "USU", seed: 10 },
    { id: "xavier", name: "Xavier", shortName: "XAV", seed: 11 },
    { id: "mcneese", name: "McNeese", shortName: "MCN", seed: 12 },
    { id: "highpoint", name: "High Point", shortName: "HPU", seed: 13 },
    { id: "troy", name: "Troy", shortName: "TROY", seed: 14 },
    { id: "wofford", name: "Wofford", shortName: "WOF", seed: 15 },
    { id: "siue", name: "SIU Edwardsville", shortName: "SIUE", seed: 16 },
  ],
};

function buildFile(templatePath, yearData, outPath) {
  const base = path.basename(outPath);
  if (base === "bracket-2026.json") {
    throw new Error("Refusing to write bracket-2026.json — use bracket-2024/2025 only.");
  }
  const raw = JSON.parse(fs.readFileSync(templatePath, "utf8"));
  delete raw._cameron_keetch_picks;
  delete raw._comment;

  Object.assign(raw, yearData.meta);

  const teams = [];
  for (const [region] of REGION_KEYS) {
    teams.push(...teamsFromSeeds(yearData[region], region));
  }
  raw.teams = teams;

  const games = structuredClone(raw.games);
  stripEspnGameIds(games);

  for (const [region, prefix] of REGION_KEYS) {
    patchR64(games, prefix, seedMap(yearData[region]));
  }

  raw.games = games;
  fs.writeFileSync(outPath, JSON.stringify(raw, null, 2) + "\n");
  console.log("Wrote", outPath);
}

const template = path.join(__dirname, "bracket-topology.json");
buildFile(template, data2024, path.join(__dirname, "bracket-2024.json"));
buildFile(template, data2025, path.join(__dirname, "bracket-2025.json"));
