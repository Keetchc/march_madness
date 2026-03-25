import Link from "next/link";
import { clsx } from "clsx";
import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getGroup, getGroupMembers, getGroupMembership } from "@/lib/dynamo/queries/groups";
import { isGroupAdmin } from "@/lib/group-permissions";
import { getBracket } from "@/lib/dynamo/queries/brackets";
import { getAllGames, getAllTeams, getTournament } from "@/lib/dynamo/queries/games";
import { resolveUserDisplayProfile } from "@/lib/dynamo/queries/users";
import { scoreBracket } from "@/lib/scoring/engine";
import { scoringTournamentIdForGroup } from "@/lib/scoring/group-tournament-id";
import { ROUNDS_IN_ORDER, type Bracket } from "@/lib/types";
import { computeBracketCompareDiffs, type CompareDiffGame } from "@/lib/compare-brackets";
import { defaultTournamentId } from "@/lib/viewing-tournament";

export const dynamic = "force-dynamic";

export default async function GroupComparePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { a?: string; b?: string };
}) {
  const session = await getServerSession(getAuthOptions());
  if (!session) redirect("/login");

  const userId = (session.user as { userId?: string }).userId as string;
  const isAdmin = Boolean((session.user as { isAdmin?: boolean }).isAdmin);

  const group = await getGroup(params.id);
  if (!group) notFound();

  const membership = await getGroupMembership(params.id, userId);
  if (!membership && !isGroupAdmin(group, userId) && !isAdmin) {
    redirect("/dashboard");
  }

  const members = await getGroupMembers(params.id);
  const bracketIds = members.map((m) => m.bracketId).filter(Boolean);
  const brackets = (await Promise.all(bracketIds.map((id) => getBracket(id)))).filter(Boolean) as Bracket[];

  const tid = scoringTournamentIdForGroup(group.tournamentId, brackets, defaultTournamentId());
  const [games, teams, tournament] = await Promise.all([
    getAllGames(tid),
    getAllTeams(tid),
    getTournament(tid),
  ]);

  const usersMap = new Map(
    await Promise.all(
      brackets.map(async (b) => {
        const u = await resolveUserDisplayProfile(b.userId);
        return [b.userId, { name: u.name }] as const;
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

  const groupBase = `/groups/${group.groupId}`;

  if (!bracketA || !bracketB) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div>
          <p className="font-mono text-xs text-court-500 uppercase tracking-widest mb-1">Compare</p>
          <h2 className="font-display text-2xl sm:text-3xl font-black uppercase tracking-tight text-white">
            Compare brackets
          </h2>
          <p className="text-ink-300 text-sm font-body mt-2">
            Need at least two brackets in this group to compare.
          </p>
        </div>
        <Link href={`${groupBase}/brackets`} className="text-sm font-mono text-court-400 hover:text-court-300">
          View all brackets →
        </Link>
      </div>
    );
  }

  const {
    diffs,
    roundDiffCounts,
    resolvedWinsA,
    resolvedWinsB,
    pendingPotentialA,
    pendingPotentialB,
  } = computeBracketCompareDiffs(bracketA, bracketB, games, teamsMap, group.scoringRules);

  const resolvedDiffs = diffs.filter((d) => d.status === "final");
  const pendingDiffs = diffs.filter((d) => d.status === "pending");
  const scoreA = scoreBracket(bracketA, games, teamsMap, group.scoringRules);
  const scoreB = scoreBracket(bracketB, games, teamsMap, group.scoringRules);
  const userA = usersMap.get(bracketA.userId)?.name ?? "Unknown";
  const userB = usersMap.get(bracketB.userId)?.name ?? "Unknown";

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <p className="font-mono text-xs text-court-500 uppercase tracking-widest mb-1">
          Compare · {tournament?.name ?? "Tournament"}
        </p>
        <h2 className="font-display text-2xl sm:text-3xl font-black uppercase tracking-tight text-white">
          Side-by-side picks
        </h2>
        <p className="text-ink-300 text-sm font-body mt-2">
          Diffs use this pool&apos;s scoring rules. Switch brackets with the form below.
        </p>
      </div>

      <form method="get" className="bg-hardwood-800 border border-hardwood-600 rounded-2xl p-4 md:p-5">
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="font-mono text-xs text-ink-300 uppercase tracking-widest">Bracket A</span>
            <select
              name="a"
              defaultValue={bracketA.bracketId}
              className="mt-1 w-full bg-hardwood-700 border border-hardwood-500 rounded-lg px-3 py-2.5 text-sm text-white"
            >
              {sortedBrackets.map((b) => (
                <option key={b.bracketId} value={b.bracketId}>
                  {b.name} — {usersMap.get(b.userId)?.name ?? "Unknown"}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="font-mono text-xs text-ink-300 uppercase tracking-widest">Bracket B</span>
            <select
              name="b"
              defaultValue={bracketB.bracketId}
              className="mt-1 w-full bg-hardwood-700 border border-hardwood-500 rounded-lg px-3 py-2.5 text-sm text-white"
            >
              {sortedBrackets.map((b) => (
                <option key={b.bracketId} value={b.bracketId}>
                  {b.name} — {usersMap.get(b.userId)?.name ?? "Unknown"}
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
          <p className="font-mono text-sm text-ink-200 mt-2">Score: {scoreA.score}</p>
          <p className="font-mono text-sm text-ink-300">Max: {scoreA.maxPossibleScore}</p>
        </div>
        <div className="bg-hardwood-800 border border-hardwood-600 rounded-2xl p-4">
          <p className="font-mono text-xs text-court-500 uppercase tracking-widest mb-1">{userB}</p>
          <h2 className="font-display text-2xl font-black uppercase tracking-tight text-white">{bracketB.name}</h2>
          <p className="font-mono text-sm text-ink-200 mt-2">Score: {scoreB.score}</p>
          <p className="font-mono text-sm text-ink-300">Max: {scoreB.maxPossibleScore}</p>
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
          <p className="font-mono text-xs uppercase tracking-widest text-ink-300 mb-2">Differences by Round</p>
          <div className="flex flex-wrap gap-2">
            {ROUNDS_IN_ORDER.map((round) => (
              <span
                key={round}
                className="px-2 py-1 rounded-md bg-hardwood-700 text-xs font-mono text-ink-100 border border-hardwood-500"
              >
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
      <p className="font-mono text-[10px] uppercase tracking-widest text-ink-300">{label}</p>
      <p className="font-display text-2xl font-black text-white mt-1">{value}</p>
      {detail ? <p className="font-mono text-xs text-ink-300 mt-1">{detail}</p> : null}
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
  data: CompareDiffGame[];
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
        <div className="p-4 text-sm text-ink-300">{emptyText}</div>
      ) : (
        <div className="divide-y divide-hardwood-700">
          {data.map((game) => (
            <div key={game.gameId} className="px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-ink-400 mb-1">
                {game.round} - {game.gameId}
              </p>
              <div className="grid grid-cols-[1fr_auto] gap-2 text-sm">
                <p className="text-ink-100 truncate">
                  {aLabel}: {game.aTeamName}
                </p>
                <p
                  className={clsx(
                    "font-mono tabular-nums",
                    game.aPoints > game.bPoints ? "text-green-400" : "text-ink-300"
                  )}
                >
                  +{game.aPoints}
                </p>
                <p className="text-ink-100 truncate">
                  {bLabel}: {game.bTeamName}
                </p>
                <p
                  className={clsx(
                    "font-mono tabular-nums",
                    game.bPoints > game.aPoints ? "text-green-400" : "text-ink-300"
                  )}
                >
                  +{game.bPoints}
                </p>
              </div>
              {game.status === "final" && (
                <p className="font-mono text-[10px] text-ink-300 mt-1">Winner: {game.winnerName}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
