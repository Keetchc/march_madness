import { getBracketsByTournament } from "@/lib/dynamo/queries/brackets";
import { getAllGames, getAllTeams, getTournament } from "@/lib/dynamo/queries/games";
import { getUser } from "@/lib/dynamo/queries/users";
import { buildLeaderboard } from "@/lib/scoring/engine";
import Link from "next/link";
import { clsx } from "clsx";
import type { LeaderboardEntry, BracketStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const TOURNAMENT_ID = process.env.TOURNAMENT_ID ?? "2026";

export default async function PublicLeaderboardPage() {
  const [brackets, games, teams, tournament] = await Promise.all([
    getBracketsByTournament(TOURNAMENT_ID),
    getAllGames(TOURNAMENT_ID),
    getAllTeams(TOURNAMENT_ID),
    getTournament(TOURNAMENT_ID),
  ]);

  const userRecords = await Promise.all(
    brackets.map(async (b) => {
      const u = await getUser(b.userId);
      return [b.userId, { name: u?.name ?? "Unknown", picture: u?.picture ?? "" }] as const;
    })
  );
  const usersMap = new Map(userRecords);
  const teamsMap = new Map(teams.map((t) => [t.id, t]));

  const leaderboard = buildLeaderboard(
    brackets,
    usersMap,
    games,
    teamsMap,
  );

  const completedGames = games.filter((g) => g.status === "final").length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <p className="font-mono text-xs text-court-500 uppercase tracking-widest mb-1">
          {tournament?.name ?? "Tournament"}
        </p>
        <h1 className="font-display text-3xl sm:text-5xl font-black uppercase tracking-tight text-white">
          Leaderboard
        </h1>
        <p className="text-gray-500 text-sm font-mono mt-1">
          {completedGames} games complete -- {brackets.length} brackets
        </p>
      </div>

      <div className="bg-hardwood-800 border border-hardwood-600 rounded-2xl overflow-hidden">
        {leaderboard.length > 0 && (
          <>
            <div className="hidden md:grid grid-cols-[4rem_1fr_8rem_8rem_8rem_8rem] gap-6 px-8 py-4 border-b border-hardwood-600 bg-hardwood-700">
              <span className="font-mono text-sm text-gray-600 uppercase">#</span>
              <span className="font-mono text-sm text-gray-600 uppercase">Player</span>
              <span className="font-mono text-sm text-gray-600 uppercase text-right">Score</span>
              <span className="font-mono text-sm text-gray-600 uppercase text-right">Max</span>
              <span className="font-mono text-sm text-gray-600 uppercase text-right">Correct</span>
              <span className="font-mono text-sm text-gray-600 uppercase text-right">Status</span>
            </div>
            <div className="md:hidden px-4 py-3 border-b border-hardwood-600 bg-hardwood-700/80 grid grid-cols-4 gap-2 text-center">
              <span className="font-mono text-[10px] text-gray-600 uppercase tracking-wide">Score</span>
              <span className="font-mono text-[10px] text-gray-600 uppercase tracking-wide">Max</span>
              <span className="font-mono text-[10px] text-gray-600 uppercase tracking-wide">Correct</span>
              <span className="font-mono text-[10px] text-gray-600 uppercase tracking-wide">Status</span>
            </div>
          </>
        )}

        {leaderboard.length === 0 ? (
          <div className="p-12 text-center text-gray-600 font-body">
            No brackets submitted yet.
          </div>
        ) : (
          <div className="divide-y divide-hardwood-700">
            {leaderboard.map((entry) => (
              <LeaderboardRow key={entry.bracketId} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const STATUS_CONFIG: Record<BracketStatus, { label: string; color: string }> = {
  leader:     { label: "Leader",     color: "text-yellow-400" },
  alive:      { label: "Alive",      color: "text-green-400" },
  longshot:   { label: "Long Shot",  color: "text-amber-400" },
  eliminated: { label: "Eliminated", color: "text-red-400" },
};

function StatusBadge({ status }: { status: BracketStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <span className={clsx("text-xs md:text-base font-mono leading-tight", config.color)}>
      {config.label}
    </span>
  );
}

function LeaderboardRow({ entry }: { entry: LeaderboardEntry }) {
  const rankColors: Record<number, string> = {
    1: "text-yellow-400",
    2: "text-gray-300",
    3: "text-amber-600",
  };

  return (
    <Link href={`/bracket/${entry.bracketId}`}>
      <div
        className={clsx(
          "flex flex-col gap-3 px-4 py-4 md:px-8 md:py-5 md:grid md:grid-cols-[4rem_1fr_8rem_8rem_8rem_8rem] md:gap-6 md:items-center",
          "hover:bg-hardwood-700 transition-colors"
        )}
      >
        <div className="flex items-center gap-3 min-w-0 md:contents">
          <span
            className={clsx(
              "font-display text-2xl md:text-3xl font-black w-10 shrink-0 text-center md:w-auto md:text-left",
              rankColors[entry.rank] ?? "text-gray-600"
            )}
          >
            {entry.rank}
          </span>

          <div className="flex items-center gap-3 min-w-0 flex-1 md:flex-initial md:min-w-0">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-court-700 flex-shrink-0 flex items-center justify-center">
              <span className="font-display text-base md:text-lg font-bold text-white">
                {entry.userName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <p className="font-display text-base md:text-lg font-bold uppercase tracking-wide truncate text-white">
                {entry.userName}
              </p>
              <p className="text-xs md:text-sm text-gray-600 font-body truncate">{entry.bracketName}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 text-center items-center md:contents">
          <div className="flex flex-col gap-0.5 md:block md:text-right">
            <span className="font-mono text-2xl md:text-2xl font-bold text-white tabular-nums">
              {entry.score}
            </span>
          </div>
          <div className="flex flex-col gap-0.5 md:block md:text-right">
            <span className="font-mono text-sm md:text-lg text-gray-500 tabular-nums">
              {entry.maxPossibleScore}
            </span>
          </div>
          <div className="flex flex-col gap-0.5 md:block md:text-right">
            <span className="font-mono text-sm md:text-lg text-gray-400 tabular-nums">
              {entry.correctPicks}/{entry.totalPicks}
            </span>
          </div>
          <div className="flex justify-center md:justify-end md:text-right">
            <StatusBadge status={entry.status} />
          </div>
        </div>
      </div>
    </Link>
  );
}
