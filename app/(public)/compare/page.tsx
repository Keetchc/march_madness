import Link from "next/link";
import { clsx } from "clsx";
import { getBracketsByTournament } from "@/lib/dynamo/queries/brackets";
import { getAllGames, getAllTeams, getTournament } from "@/lib/dynamo/queries/games";
import { getUser } from "@/lib/dynamo/queries/users";
import { scoreBracket } from "@/lib/scoring/engine";
import type { Bracket, Game, Round } from "@/lib/types";

export const dynamic = "force-dynamic";

const TOURNAMENT_ID = process.env.TOURNAMENT_ID ?? "2026";

const ROUND_BASE_POINTS: Record<Round, number> = {
  R64: 1,
  R32: 2,
  S16: 4,
  E8: 8,
  F4: 14,
  NCG: 22,
};

type DiffGame = {
  gameId: string;
  round: Round;
  aTeamName: string;
  bTeamName: string;
  aPoints: number;
  bPoints: number;
  status: "pending" | "final";
  winnerName: string;
};

function getPotentialPointsForPick(game: Game, teamId: string | undefined, teamsMap: Map<string, { seed: number }>) {
  if (!teamId) return 0;
  return ROUND_BASE_POINTS[game.round] * (teamsMap.get(teamId)?.seed ?? 1);
}

function buildEliminatedTeams(games: Game[]) {
  const eliminated = new Set<string>();
  for (const game of games) {
    if (game.status !== "final" || !game.winnerId) continue;
    if (game.team1Id && game.team1Id !== game.winnerId) eliminated.add(game.team1Id);
    if (game.team2Id && game.team2Id !== game.winnerId) eliminated.add(game.team2Id);
  }
  return eliminated;
}

export default async function CompareBracketsPage({
  searchParams,
}: {
  searchParams: { a?: string; b?: string };
}) {
  const [brackets, games, teams, tournament] = await Promise.all([
    getBracketsByTournament(TOURNAMENT_ID),
    getAllGames(TOURNAMENT_ID),
    getAllTeams(TOURNAMENT_ID),
    getTournament(TOURNAMENT_ID),
  ]);

  const usersMap = new Map(
    await Promise.all(
      brackets.map(async (b) => {
        const u = await getUser(b.userId);
        return [b.userId, { name: u?.name ?? "Unknown" }] as const;
      })
    )
  );
  const teamsMap = new Map(teams.map((t) => [t.id, t]));

  const sortedBrackets = [...brackets].sort((a, b) => a.name.localeCompare(b.name));
  const bracketA = sortedBrackets.find((b) => b.bracketId === searchParams.a) ?? sortedBrackets[0] ?? null;
  const bracketB =
    sortedBrackets.find((b) => b.bracketId === searchParams.b && b.bracketId !== bracketA?.bracketId) ??
    sortedBrackets.find((b) => b.bracketId !== bracketA?.bracketId) ??
    null;

  if (!bracketA || !bracketB) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-3xl sm:text-5xl font-black uppercase tracking-tight text-white">
          Compare Brackets
        </h1>
        <p className="text-gray-500">Need at least two brackets to compare.</p>
      </div>
    );
  }

  const eliminatedTeams = buildEliminatedTeams(games);
  const diffs: DiffGame[] = [];
  const roundDiffCounts: Record<Round, number> = { R64: 0, R32: 0, S16: 0, E8: 0, F4: 0, NCG: 0 };

  let resolvedWinsA = 0;
  let resolvedWinsB = 0;
  let pendingPotentialA = 0;
  let pendingPotentialB = 0;

  for (const game of games) {
    const aPick = bracketA.picks[game.gameId];
    const bPick = bracketB.picks[game.gameId];
    if (!aPick || !bPick || aPick === bPick) continue;

    roundDiffCounts[game.round] += 1;
    const aTeam = teamsMap.get(aPick);
    const bTeam = teamsMap.get(bPick);

    if (game.status === "final") {
      const aWon = game.winnerId === aPick;
      const bWon = game.winnerId === bPick;
      const aPoints = aWon ? getPotentialPointsForPick(game, aPick, teamsMap) : 0;
      const bPoints = bWon ? getPotentialPointsForPick(game, bPick, teamsMap) : 0;
      if (aPoints > bPoints) resolvedWinsA += 1;
      if (bPoints > aPoints) resolvedWinsB += 1;
      diffs.push({
        gameId: game.gameId,
        round: game.round,
        aTeamName: aTeam?.shortName ?? aTeam?.name ?? "TBD",
        bTeamName: bTeam?.shortName ?? bTeam?.name ?? "TBD",
        aPoints,
        bPoints,
        status: "final",
        winnerName: teamsMap.get(game.winnerId ?? "")?.shortName ?? "TBD",
      });
      continue;
    }

    const aAlive = !eliminatedTeams.has(aPick);
    const bAlive = !eliminatedTeams.has(bPick);
    const aPoints = aAlive ? getPotentialPointsForPick(game, aPick, teamsMap) : 0;
    const bPoints = bAlive ? getPotentialPointsForPick(game, bPick, teamsMap) : 0;
    pendingPotentialA += aPoints;
    pendingPotentialB += bPoints;
    diffs.push({
      gameId: game.gameId,
      round: game.round,
      aTeamName: aTeam?.shortName ?? aTeam?.name ?? "TBD",
      bTeamName: bTeam?.shortName ?? bTeam?.name ?? "TBD",
      aPoints,
      bPoints,
      status: "pending",
      winnerName: "TBD",
    });
  }

  const resolvedDiffs = diffs.filter((d) => d.status === "final");
  const pendingDiffs = diffs.filter((d) => d.status === "pending");
  const scoreA = scoreBracket(bracketA, games, teamsMap);
  const scoreB = scoreBracket(bracketB, games, teamsMap);
  const userA = usersMap.get(bracketA.userId)?.name ?? "Unknown";
  const userB = usersMap.get(bracketB.userId)?.name ?? "Unknown";

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="font-mono text-xs text-court-500 uppercase tracking-widest mb-1">
            {tournament?.name ?? "Tournament"}
          </p>
          <h1 className="font-display text-3xl sm:text-5xl font-black uppercase tracking-tight text-white">
            Compare Brackets
          </h1>
        </div>
        <Link
          href="/leaderboard"
          className="text-xs font-mono text-gray-500 hover:text-gray-300 transition-colors"
        >
          Back to leaderboard
        </Link>
      </div>

      <form className="bg-hardwood-800 border border-hardwood-600 rounded-2xl p-4 md:p-5">
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="font-mono text-xs text-gray-500 uppercase tracking-widest">Bracket A</span>
            <select
              name="a"
              defaultValue={bracketA.bracketId}
              className="mt-1 w-full bg-hardwood-700 border border-hardwood-500 rounded-lg px-3 py-2.5 text-sm text-white"
            >
              {sortedBrackets.map((b) => (
                <option key={b.bracketId} value={b.bracketId}>
                  {b.name} - {usersMap.get(b.userId)?.name ?? "Unknown"}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="font-mono text-xs text-gray-500 uppercase tracking-widest">Bracket B</span>
            <select
              name="b"
              defaultValue={bracketB.bracketId}
              className="mt-1 w-full bg-hardwood-700 border border-hardwood-500 rounded-lg px-3 py-2.5 text-sm text-white"
            >
              {sortedBrackets.map((b) => (
                <option key={b.bracketId} value={b.bracketId}>
                  {b.name} - {usersMap.get(b.userId)?.name ?? "Unknown"}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          type="submit"
          className="mt-3 inline-flex items-center gap-2 bg-court-500 hover:bg-court-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          Compare
        </button>
      </form>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-hardwood-800 border border-hardwood-600 rounded-2xl p-4">
          <p className="font-mono text-xs text-court-500 uppercase tracking-widest mb-1">{userA}</p>
          <h2 className="font-display text-2xl font-black uppercase tracking-tight text-white">{bracketA.name}</h2>
          <p className="font-mono text-sm text-gray-400 mt-2">Score: {scoreA.score}</p>
          <p className="font-mono text-sm text-gray-500">Max: {scoreA.maxPossibleScore}</p>
        </div>
        <div className="bg-hardwood-800 border border-hardwood-600 rounded-2xl p-4">
          <p className="font-mono text-xs text-court-500 uppercase tracking-widest mb-1">{userB}</p>
          <h2 className="font-display text-2xl font-black uppercase tracking-tight text-white">{bracketB.name}</h2>
          <p className="font-mono text-sm text-gray-400 mt-2">Score: {scoreB.score}</p>
          <p className="font-mono text-sm text-gray-500">Max: {scoreB.maxPossibleScore}</p>
        </div>
      </div>

      <div className="bg-hardwood-800 border border-hardwood-600 rounded-2xl p-4 md:p-5 space-y-3">
        <p className="font-display text-xl font-bold uppercase tracking-wide text-white">Head-to-Head Summary</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Metric label="Different Picks" value={`${diffs.length}`} />
          <Metric label="Resolved Edge" value={`${resolvedWinsA}-${resolvedWinsB}`} detail={`${userA} - ${userB}`} />
          <Metric label={`${userA} Remaining Swing`} value={`+${pendingPotentialA}`} />
          <Metric label={`${userB} Remaining Swing`} value={`+${pendingPotentialB}`} />
        </div>
        <div className="pt-2 border-t border-hardwood-600">
          <p className="font-mono text-xs uppercase tracking-widest text-gray-500 mb-2">Differences by Round</p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(roundDiffCounts) as Round[]).map((round) => (
              <span key={round} className="px-2 py-1 rounded-md bg-hardwood-700 text-xs font-mono text-gray-300 border border-hardwood-500">
                {round}: {roundDiffCounts[round]}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <DiffPanel
          title="Remaining Swing Games"
          data={pendingDiffs}
          aLabel={userA}
          bLabel={userB}
          emptyText="No remaining different picks."
        />
        <DiffPanel
          title="Settled Different Picks"
          data={resolvedDiffs}
          aLabel={userA}
          bLabel={userB}
          emptyText="No settled differences yet."
        />
      </div>
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="bg-hardwood-700 border border-hardwood-500 rounded-xl p-3">
      <p className="font-mono text-[10px] uppercase tracking-widest text-gray-500">{label}</p>
      <p className="font-display text-2xl font-black text-white mt-1">{value}</p>
      {detail ? <p className="font-mono text-xs text-gray-500 mt-1">{detail}</p> : null}
    </div>
  );
}

function DiffPanel({
  title,
  data,
  aLabel,
  bLabel,
  emptyText,
}: {
  title: string;
  data: DiffGame[];
  aLabel: string;
  bLabel: string;
  emptyText: string;
}) {
  return (
    <div className="bg-hardwood-800 border border-hardwood-600 rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-hardwood-600 bg-hardwood-700">
        <p className="font-display font-bold uppercase tracking-wide text-sm text-white">{title}</p>
      </div>
      {data.length === 0 ? (
        <div className="p-4 text-sm text-gray-500">{emptyText}</div>
      ) : (
        <div className="divide-y divide-hardwood-700">
          {data.map((game) => (
            <div key={game.gameId} className="px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-gray-600 mb-1">
                {game.round} - {game.gameId}
              </p>
              <div className="grid grid-cols-[1fr_auto] gap-2 text-sm">
                <p className="text-gray-300 truncate">{aLabel}: {game.aTeamName}</p>
                <p className={clsx("font-mono tabular-nums", game.aPoints > game.bPoints ? "text-green-400" : "text-gray-500")}>
                  +{game.aPoints}
                </p>
                <p className="text-gray-300 truncate">{bLabel}: {game.bTeamName}</p>
                <p className={clsx("font-mono tabular-nums", game.bPoints > game.aPoints ? "text-green-400" : "text-gray-500")}>
                  +{game.bPoints}
                </p>
              </div>
              {game.status === "final" && (
                <p className="font-mono text-[10px] text-gray-500 mt-1">Winner: {game.winnerName}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
