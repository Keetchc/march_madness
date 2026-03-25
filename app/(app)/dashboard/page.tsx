import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { getBracketsByUser } from "@/lib/dynamo/queries/brackets";
import { getGroupsByUser, listGroupsUsingBracket } from "@/lib/dynamo/queries/groups";
import { BracketListCard } from "@/components/bracket/BracketListCard";
import { isGroupAdmin } from "@/lib/group-permissions";
import { getTournament } from "@/lib/dynamo/queries/games";
import { picksEffectivelyClosed } from "@/lib/picks-lock";
import Link from "next/link";
import { TrophyIcon, UsersIcon, PlusIcon } from "lucide-react";
import { LockCountdownBadge } from "@/components/layout/LockCountdownBadge";
import { getViewingTournamentIdFromCookies } from "@/lib/viewing-tournament";

export default async function DashboardPage() {
  const session = await getServerSession(getAuthOptions());
  const userId = (session!.user as any).userId;

  const viewingId = getViewingTournamentIdFromCookies();
  const [bracketsAll, groupsAll, tournament] = await Promise.all([
    getBracketsByUser(userId),
    getGroupsByUser(userId),
    getTournament(viewingId),
  ]);

  const brackets = bracketsAll.filter((b) => b.tournamentId === viewingId);
  const groups = groupsAll.filter((g) => g.tournamentId === viewingId);

  const groupsPerBracket = await Promise.all(
    brackets.map((b) => listGroupsUsingBracket(userId, b.bracketId)),
  );

  const isLocked = picksEffectivelyClosed(tournament);

  return (
    <div className="space-y-10 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-court-500 text-xs uppercase tracking-widest mb-1">
            Welcome back
          </p>
          <h1 className="font-display text-5xl font-black uppercase tracking-tight text-white">
            {session!.user?.name?.split(" ")[0]}'s Dashboard
          </h1>
          {tournament && (
            <p className="text-ink-300 text-sm mt-1 font-body">
              Viewing {tournament.year}: {tournament.name} •{" "}
              <span className={isLocked ? "text-red-400" : "text-green-400"}>
                {isLocked ? "🔒 Picks locked" : "✅ Picks open"}
              </span>
            </p>
          )}
        </div>
        <LockCountdownBadge tournament={tournament ?? undefined} variant="default" />
      </div>

      {/* My Brackets */}
      <section className="w-full">
        <div className="w-full rounded-2xl border border-hardwood-600 bg-hardwood-800 overflow-hidden shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-hardwood-700 bg-hardwood-800/90">
            <h2 className="font-display text-xl sm:text-2xl font-bold uppercase tracking-wide text-white flex items-center gap-2 min-w-0">
              <TrophyIcon className="w-5 h-5 text-court-500 shrink-0" />
              My Brackets
            </h2>
            {!isLocked && brackets.length === 0 && (
              <Link
                href="/bracket/new"
                className="shrink-0 flex items-center gap-2 bg-court-500 hover:bg-court-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                <PlusIcon className="w-4 h-4" />
                New Bracket
              </Link>
            )}
          </div>

          <div className="p-4 sm:p-6">
            {brackets.length === 0 ? (
              <div className="rounded-xl border border-dashed border-hardwood-600 bg-hardwood-900/40 px-6 py-10 text-center">
                <p className="text-ink-300 font-body mb-4">No brackets yet.</p>
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

      {/* My Groups */}
      <section className="w-full">
        <div className="w-full rounded-2xl border border-hardwood-600 bg-hardwood-800 overflow-hidden shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-hardwood-700 bg-hardwood-800/90">
            <h2 className="font-display text-xl sm:text-2xl font-bold uppercase tracking-wide text-white flex items-center gap-2 min-w-0">
              <UsersIcon className="w-5 h-5 text-court-500 shrink-0" />
              My Groups
            </h2>
            <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
              <LockCountdownBadge tournament={tournament ?? undefined} variant="compact" />
              {groups.length === 0 && (
                <Link
                  href="/groups/new"
                  className="flex items-center gap-2 bg-hardwood-700 hover:bg-hardwood-600 border border-hardwood-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
                >
                  <PlusIcon className="w-4 h-4" />
                  New Group
                </Link>
              )}
            </div>
          </div>

          <div className="p-4 sm:p-6">
            {groups.length === 0 ? (
              <div className="rounded-xl border border-dashed border-hardwood-600 bg-hardwood-900/40 px-6 py-10 text-center">
                <p className="text-ink-300 font-body mb-4">
                  No groups yet. Create one or ask a friend for an invite link.
                </p>
                <Link
                  href="/groups/new"
                  className="inline-flex items-center gap-2 bg-hardwood-700 hover:bg-hardwood-600 border border-hardwood-500 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors"
                >
                  <PlusIcon className="w-4 h-4" /> Create a group
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <Link
                  href="/groups/new"
                  className="flex min-h-[7.5rem] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-hardwood-500 bg-hardwood-900/30 px-4 py-6 text-center transition-colors hover:border-court-500 hover:bg-court-500/5"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-hardwood-600/50 text-ink-200">
                    <PlusIcon className="w-5 h-5" />
                  </span>
                  <span className="font-display text-sm font-bold uppercase tracking-wide text-ink-200">
                    New group
                  </span>
                  <span className="text-[11px] font-mono text-ink-500">Start a pool</span>
                </Link>
                {groups.map((group) => (
                  <Link key={group.groupId} href={`/groups/${group.groupId}`}>
                    <div className="h-full min-h-[7.5rem] bg-hardwood-900/50 border border-hardwood-600 hover:border-court-500 rounded-xl p-5 transition-all duration-150 hover:-translate-y-0.5 group">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-display text-xl font-bold uppercase tracking-wide text-white group-hover:text-court-400 min-w-0">
                          {group.name}
                        </h3>
                        <LockCountdownBadge tournament={tournament ?? undefined} variant="compact" className="shrink-0" />
                      </div>
                      <p className="text-xs text-ink-300 font-mono">
                        {String(group.adminUserId) === String(userId)
                          ? "👑 Owner"
                          : isGroupAdmin(group, userId)
                            ? "🛡️ Admin"
                            : "Member"}{" "}
                        · {new Date(group.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

