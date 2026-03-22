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
        <h1 className="font-display text-5xl font-black uppercase tracking-tight text-white">
          Leaderboard
        </h1>
        <p className="text-gray-500 text-sm font-mono mt-1">
          {completedGames} games complete -- {brackets.length} brackets
        </p>
      </div>

      <div className="bg-hardwood-800 border border-hardwood-600 rounded-2xl overflow-hidden">
        <div className="hidden md:grid grid-cols-[3rem_1fr_6rem_6rem_6rem_6rem] gap-4 px-6 py-3 border-b border-hardwood-600 bg-hardwood-700">
          <span className="font-mono text-xs text-gray-600 uppercase">#</span>
          <span className="font-mono text-xs text-gray-600 uppercase">Player</span>
          <span className="font-mono text-xs text-gray-600 uppercase text-right">Score</span>
          <span className="font-mono text-xs text-gray-600 uppercase text-right">Max</span>
          <span className="font-mono text-xs text-gray-600 uppercase text-right">Correct</span>
          <span className="font-mono text-xs text-gray-600 uppercase text-right">Status</span>
        </div>

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
    <span className={clsx("text-xs font-mono", config.color)}>
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
        className="grid grid-cols-[3rem_1fr] md:grid-cols-[3rem_1fr_6rem_6rem_6rem_6rem] gap-4 px-6 py-4 items-center hover:bg-hardwood-700 transition-colors"
      >
        <span
          className={clsx(
            "font-display text-2xl font-black",
            rankColors[entry.rank] ?? "text-gray-600"
          )}
        >
          {entry.rank}
        </span>

        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full bg-court-700 flex-shrink-0 flex items-center justify-center">
            <span className="font-display text-sm font-bold text-white">
              {entry.userName.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <p className="font-display font-bold uppercase tracking-wide truncate text-white">
              {entry.userName}
            </p>
            <p className="text-xs text-gray-600 font-body truncate">{entry.bracketName}</p>
          </div>
        </div>

        <div className="hidden md:block text-right">
          <span className="font-mono text-xl font-bold text-white">{entry.score}</span>
        </div>

        <div className="hidden md:block text-right">
          <span className="font-mono text-sm text-gray-500">{entry.maxPossibleScore}</span>
        </div>

        <div className="hidden md:block text-right">
          <span className="font-mono text-sm text-gray-400">
            {entry.correctPicks}/{entry.totalPicks}
          </span>
        </div>

        <div className="hidden md:block text-right">
          <StatusBadge status={entry.status} />
        </div>
      </div>
    </Link>
  );
}
