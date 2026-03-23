import { getBracketsByTournament } from "@/lib/dynamo/queries/brackets";
import { getAllGames, getAllTeams, getTournament } from "@/lib/dynamo/queries/games";
import { getUser } from "@/lib/dynamo/queries/users";
import { buildLeaderboard } from "@/lib/scoring/engine";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Image from "next/image";
import Link from "next/link";
import { clsx } from "clsx";
import type { LeaderboardEntry, BracketStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const TOURNAMENT_ID = process.env.TOURNAMENT_ID ?? "2026";

export default async function PublicLeaderboardPage() {
  const session = await getServerSession(authOptions);
  const currentUserId =
    session?.user != null
      ? ((session.user as { userId?: string }).userId ?? "")
      : "";

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
        <Link
          href="/compare"
          className="inline-flex mt-3 text-xs font-mono text-court-400 hover:text-court-300 transition-colors"
        >
          Compare any two brackets →
        </Link>
      </div>

      <div className="bg-hardwood-800 border border-hardwood-600 rounded-2xl overflow-hidden">
        {leaderboard.length > 0 && (
          <>
            <div className="hidden md:grid grid-cols-[4rem_1fr_8rem_8rem_8rem_8rem] gap-6 px-8 py-4 border-b border-hardwood-600 bg-hardwood-700">
              <span className="font-mono text-sm text-gray-600 uppercase">#</span>
              <span className="font-mono text-sm text-gray-600 uppercase">Player</span>
              <span className="font-mono text-sm text-gray-600 uppercase text-right">Score</span>
              <span className="font-mono text-sm text-gray-600 uppercase text-right">Max</span>
              <span
                className="font-mono text-sm text-gray-600 uppercase text-right"
                title="Correct picks out of tournament games already final"
              >
                Correct
              </span>
              <span className="font-mono text-sm text-gray-600 uppercase text-right">Status</span>
            </div>
            <div className="md:hidden px-4 py-3 border-b border-hardwood-600 bg-hardwood-700/80 grid grid-cols-4 gap-2 text-center">
              <span className="font-mono text-[10px] text-gray-600 uppercase tracking-wide">Score</span>
              <span className="font-mono text-[10px] text-gray-600 uppercase tracking-wide">Max</span>
              <span
                className="font-mono text-[10px] text-gray-600 uppercase tracking-wide"
                title="Correct picks out of games already final"
              >
                Correct
              </span>
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
              <LeaderboardRow
                key={entry.bracketId}
                entry={entry}
                isCurrentUser={!!currentUserId && entry.userId === currentUserId}
              />
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

function LeaderboardRow({
  entry,
  isCurrentUser,
}: {
  entry: LeaderboardEntry;
  isCurrentUser?: boolean;
}) {
  const rankColors: Record<number, string> = {
    1: "text-yellow-400",
    2: "text-gray-300",
    3: "text-amber-600",
  };

  return (
    <Link href={`/bracket/${entry.bracketId}`}>
      <div
        className={clsx(
          "flex flex-col gap-0 px-4 py-4 md:gap-0 md:px-8 md:py-5 md:grid md:grid-cols-[4rem_1fr_8rem_8rem_8rem_8rem] md:gap-6 md:items-center",
          "hover:bg-hardwood-700 transition-colors",
          isCurrentUser && "bg-court-500/5 hover:bg-court-500/10"
        )}
      >
        <div className="flex items-center gap-3 min-w-0 pb-3 md:contents md:pb-0">
          <span
            className={clsx(
              "font-display text-2xl md:text-3xl font-black w-10 shrink-0 text-center md:w-auto md:text-left",
              rankColors[entry.rank] ?? "text-gray-600"
            )}
          >
            {entry.rank}
          </span>

          <div className="flex items-center gap-3 min-w-0 flex-1 md:flex-initial md:min-w-0">
            {entry.userPicture ? (
              <Image
                src={entry.userPicture}
                alt={entry.userName}
                width={48}
                height={48}
                unoptimized
                className="w-10 h-10 md:w-12 md:h-12 rounded-full flex-shrink-0 object-cover ring-2 ring-hardwood-600"
              />
            ) : (
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-court-700 flex-shrink-0 flex items-center justify-center">
                <span className="font-display text-base md:text-lg font-bold text-white">
                  {entry.userName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div className="min-w-0">
              <p
                className={clsx(
                  "font-display text-base md:text-lg font-bold uppercase tracking-wide truncate",
                  isCurrentUser ? "text-court-400" : "text-white"
                )}
              >
                {entry.userName}
                {isCurrentUser && (
                  <span className="ml-2 text-[10px] md:text-xs text-court-600 normal-case font-mono">
                    you
                  </span>
                )}
              </p>
              <p className="text-xs md:text-sm text-gray-600 font-body truncate">{entry.bracketName}</p>
            </div>
          </div>
        </div>

        <div
          className={clsx(
            "grid grid-cols-4 gap-x-2 gap-y-1 text-center items-center md:contents",
            "border-t border-hardwood-600/90 pt-3 mt-0",
            "rounded-lg bg-hardwood-900/55 px-2 py-2.5 -mx-1 ring-1 ring-hardwood-600/40",
            "md:mx-0 md:mt-0 md:pt-0 md:px-0 md:py-0 md:rounded-none md:border-t-0 md:bg-transparent md:ring-0"
          )}
        >
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
              {entry.correctPicks}/{entry.gamesDecidedCount}
            </span>
          </div>
          <div className="flex justify-center md:justify-end md:text-right">
            <StatusBadge status={entry.status} />
          </div>
        </div>

        {entry.criticalGames.length > 0 && entry.status !== "leader" && (
          <div className="md:col-start-2 md:col-end-7 mt-2 md:mt-1">
            <p className="font-mono text-[10px] md:text-xs uppercase tracking-widest text-court-500 mb-1.5">
              Most Important Remaining Games
            </p>
            <div className="flex flex-wrap gap-1.5">
              {entry.criticalGames.slice(0, 3).map((game) => (
                <span
                  key={game.gameId}
                  className={clsx(
                    "inline-flex items-center gap-1 rounded-full px-2 py-1 font-mono text-[10px] md:text-xs border",
                    game.isMustHave
                      ? "text-yellow-300 border-yellow-600/70 bg-yellow-900/25"
                      : "text-gray-300 border-hardwood-500 bg-hardwood-700/60"
                  )}
                >
                  <span>{game.teamName}</span>
                  <span className="text-gray-500">{game.round}</span>
                  <span className="text-white tabular-nums">+{game.potentialPoints}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}
