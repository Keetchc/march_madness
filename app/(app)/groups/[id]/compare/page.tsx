import Link from "next/link";
import { clsx } from "clsx";
import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getGroup, getGroupMembers, getGroupMembership } from "@/lib/dynamo/queries/groups";
import { getBracket } from "@/lib/dynamo/queries/brackets";
import { getAllGames, getAllTeams, getTournament } from "@/lib/dynamo/queries/games";
import { resolveUserDisplayProfile } from "@/lib/dynamo/queries/users";
import { scoreBracket } from "@/lib/scoring/engine";
import { ROUNDS_IN_ORDER, type Bracket } from "@/lib/types";
import { computeBracketCompareDiffs, type CompareDiffGame } from "@/lib/compare-brackets";

export const dynamic = "force-dynamic";

const TOURNAMENT_ID = process.env.TOURNAMENT_ID ?? "2026";

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
  if (!membership && group.adminUserId !== userId && !isAdmin) {
    redirect("/dashboard");
  }

  const members = await getGroupMembers(params.id);
  const bracketIds = members.map((m) => m.bracketId).filter(Boolean);
  const brackets = (await Promise.all(bracketIds.map((id) => getBracket(id)))).filter(Boolean) as Bracket[];

  const tid = group.tournamentId ?? TOURNAMENT_ID;
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
        <p className="font-mono text-xs text-court-500 uppercase tracking-widest mb-1">
          <Link href={groupBase} className="hover:text-court-400 transition-colors">
            {group.name}
          </Link>
        </p>
        <h1 className="font-display text-3xl sm:text-5xl font-black uppercase tracking-tight text-white">
          Compare Brackets
        </h1>
        <p className="text-gray-500">Need at least two brackets in this group to compare.</p>
        <Link href={`${groupBase}/brackets`} className="text-sm font-mono text-court-400 hover:text-court-300">
          ← Group brackets
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
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="font-mono text-xs text-court-500 uppercase tracking-widest mb-1">
            <Link href={groupBase} className="hover:text-court-400 transition-colors">
              {group.name}
            </Link>
            {" · "}
            {tournament?.name ?? "Tournament"}
          </p>
          <h1 className="font-display text-3xl sm:text-5xl font-black uppercase tracking-tight text-white">
            Compare Brackets
          </h1>
        </div>
        <div className="flex flex-col items-end gap-1 text-xs font-mono">
          <Link href={groupBase} className="text-gray-500 hover:text-gray-300 transition-colors">
            Back to group
          </Link>
          <Link href={`${groupBase}/brackets`} className="text-gray-500 hover:text-gray-300 transition-colors">
            All group brackets
          </Link>
        </div>
      </div>

      <form method="get" className="bg-hardwood-800 border border-hardwood-600 rounded-2xl p-4 md:p-5">
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
                  {b.name} — {usersMap.get(b.userId)?.name ?? "Unknown"}
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
            {ROUNDS_IN_ORDER.map((round) => (
              <span
                key={round}
                className="px-2 py-1 rounded-md bg-hardwood-700 text-xs font-mono text-gray-300 border border-hardwood-500"
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
        <div className="p-4 text-sm text-gray-500">{emptyText}</div>
      ) : (
        <div className="divide-y divide-hardwood-700">
          {data.map((game) => (
            <div key={game.gameId} className="px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-gray-600 mb-1">
                {game.round} - {game.gameId}
              </p>
              <div className="grid grid-cols-[1fr_auto] gap-2 text-sm">
                <p className="text-gray-300 truncate">
                  {aLabel}: {game.aTeamName}
                </p>
                <p
                  className={clsx(
                    "font-mono tabular-nums",
                    game.aPoints > game.bPoints ? "text-green-400" : "text-gray-500"
                  )}
                >
                  +{game.aPoints}
                </p>
                <p className="text-gray-300 truncate">
                  {bLabel}: {game.bTeamName}
                </p>
                <p
                  className={clsx(
                    "font-mono tabular-nums",
                    game.bPoints > game.aPoints ? "text-green-400" : "text-gray-500"
                  )}
                >
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
