import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { getBracketsByUser } from "@/lib/dynamo/queries/brackets";
import { listGroupsUsingBracket } from "@/lib/dynamo/queries/groups";
import { BracketListCard } from "@/components/bracket/BracketListCard";
import { getTournament } from "@/lib/dynamo/queries/games";
import { picksEffectivelyClosed } from "@/lib/picks-lock";
import Link from "next/link";
import { TrophyIcon, PlusIcon } from "lucide-react";
import { LockCountdownBadge } from "@/components/layout/LockCountdownBadge";
import { getViewingTournamentIdFromCookies } from "@/lib/viewing-tournament";

export default async function BracketsListPage() {
  const session = await getServerSession(getAuthOptions());
  const userId = (session!.user as any).userId;

  const viewingId = await getViewingTournamentIdFromCookies();
  const [bracketsAll, tournament] = await Promise.all([
    getBracketsByUser(userId),
    getTournament(viewingId),
  ]);

  const brackets = bracketsAll.filter((b) => b.tournamentId === viewingId);

  const groupsPerBracket = await Promise.all(
    brackets.map((b) => listGroupsUsingBracket(userId, b.bracketId)),
  );

  const isLocked = picksEffectivelyClosed(tournament);

  return (
    <div className="space-y-6 animate-fade-in w-full">
      <section className="w-full">
        <div className="w-full rounded-2xl border border-hardwood-600 bg-hardwood-800 overflow-hidden shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4 px-4 sm:px-6 py-4 sm:py-5 border-b border-hardwood-700 bg-hardwood-800/90">
            <div className="min-w-0">
              <p className="font-mono text-court-500 text-xs uppercase tracking-widest mb-1">
                {tournament?.name ?? "Tournament"}
              </p>
              <h1 className="font-display text-2xl sm:text-4xl font-black uppercase tracking-tight text-white flex items-center gap-2 sm:gap-3">
                <TrophyIcon className="w-7 h-7 sm:w-9 sm:h-9 text-court-500 shrink-0" />
                My Brackets
              </h1>
              {tournament && (
                <p className="text-ink-300 text-sm mt-2 font-body">
                  <span className={isLocked ? "text-red-400" : "text-green-400"}>
                    {isLocked ? "🔒 Picks locked" : "✅ Picks open"}
                  </span>
                  {" · "}
                  Scores depend on each pool&apos;s rules—open a group to see standings.
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
              <LockCountdownBadge tournament={tournament ?? undefined} variant="compact" />
              {!isLocked && brackets.length === 0 && (
                <Link
                  href="/bracket/new"
                  className="flex items-center gap-2 bg-court-500 hover:bg-court-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
                >
                  <PlusIcon className="w-4 h-4" />
                  New Bracket
                </Link>
              )}
            </div>
          </div>

          <div className="p-4 sm:p-6">
            {brackets.length === 0 ? (
              <div className="rounded-xl border border-dashed border-hardwood-600 bg-hardwood-900/40 px-6 py-10 text-center">
                <p className="text-ink-300 font-body mb-4">
                  You haven&apos;t created any brackets yet.
                </p>
                {!isLocked && (
                  <Link
                    href="/bracket/new"
                    className="inline-flex items-center gap-2 bg-court-500 hover:bg-court-600 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors"
                  >
                    <PlusIcon className="w-4 h-4" /> Create your first bracket
                  </Link>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {!isLocked && (
                  <Link
                    href="/bracket/new"
                    className="flex min-h-[7.5rem] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-hardwood-500 bg-hardwood-900/30 px-4 py-6 text-center transition-colors hover:border-court-500 hover:bg-court-500/5"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-court-500/15 text-court-400">
                      <PlusIcon className="w-5 h-5" />
                    </span>
                    <span className="font-display text-sm font-bold uppercase tracking-wide text-court-400">
                      New bracket
                    </span>
                    <span className="text-[11px] font-mono text-ink-500">Create another entry</span>
                  </Link>
                )}
                {brackets.map((bracket, i) => (
                  <BracketListCard
                    key={bracket.bracketId}
                    bracket={bracket}
                    pools={groupsPerBracket[i] ?? []}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
