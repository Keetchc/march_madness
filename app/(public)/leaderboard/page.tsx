import { getBracketsByTournament } from "@/lib/dynamo/queries/brackets";
import { getAllGames, getAllTeams, getTournament } from "@/lib/dynamo/queries/games";
import { resolveUserDisplayProfile } from "@/lib/dynamo/queries/users";
import { buildLeaderboard } from "@/lib/scoring/engine";
import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import {
  PoolLeaderboardRow,
  PoolLeaderboardTableHeaders,
} from "@/components/leaderboard/PoolLeaderboardRow";
import { RoundMiniLeaderboard } from "@/components/leaderboard/RoundMiniLeaderboard";

export const dynamic = "force-dynamic";

const TOURNAMENT_ID = process.env.TOURNAMENT_ID ?? "2026";

export default async function PublicLeaderboardPage() {
  const session = await getServerSession(getAuthOptions());
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
      const u = await resolveUserDisplayProfile(b.userId);
      return [b.userId, { name: u.name, picture: u.picture }] as const;
    })
  );
  const usersMap = new Map(userRecords);
  const teamsMap = new Map(teams.map((t) => [t.id, t]));

  const leaderboard = buildLeaderboard(brackets, usersMap, games, teamsMap);

  const completedGames = games.filter((g) => g.status === "final").length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <p className="font-mono text-xs text-court-500 uppercase tracking-widest mb-1">
          {tournament?.name ?? "Tournament"}
        </p>
        <h1 className="font-display text-3xl sm:text-5xl font-black uppercase tracking-tight text-white">
          Global Leaderboard
        </h1>
        <p className="text-ink-300 text-sm font-mono mt-1">
          {completedGames} games complete -- {brackets.length} brackets
        </p>
        <p className="text-ink-400 text-xs font-mono mt-3 max-w-md">
          Pool-wide view. To browse or compare picks with your crew, open a group from your dashboard.
        </p>
      </div>

      <div className="bg-hardwood-800 border border-hardwood-600 rounded-2xl overflow-hidden">
        {leaderboard.length > 0 && <PoolLeaderboardTableHeaders />}

        {leaderboard.length === 0 ? (
          <div className="p-12 text-center text-ink-400 font-body">No brackets submitted yet.</div>
        ) : (
          <div className="divide-y divide-hardwood-700">
            {leaderboard.map((entry) => (
              <PoolLeaderboardRow
                key={entry.bracketId}
                entry={entry}
                isCurrentUser={!!currentUserId && entry.userId === currentUserId}
                maskStats={false}
                rankDisplay={entry.rank}
              />
            ))}
          </div>
        )}
      </div>

      {leaderboard.length > 0 && (
        <div className="mt-6 space-y-2">
          <p className="text-[10px] text-ink-400 font-mono max-w-xl">
            Round scores below use the site default scoring rules, not a private group&apos;s custom rules.
          </p>
          <RoundMiniLeaderboard leaderboard={leaderboard} />
        </div>
      )}
    </div>
  );
}
