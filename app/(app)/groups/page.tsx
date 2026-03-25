import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getGroupsByUser } from "@/lib/dynamo/queries/groups";
import { getTournament } from "@/lib/dynamo/queries/games";
import { isGroupAdmin } from "@/lib/group-permissions";
import { picksEffectivelyClosed } from "@/lib/picks-lock";
import Link from "next/link";
import { getViewingTournamentIdFromCookies } from "@/lib/viewing-tournament";
import { PlusIcon, UsersIcon } from "lucide-react";
import { LockCountdownBadge } from "@/components/layout/LockCountdownBadge";

export default async function GroupsPage() {
  const session = await getServerSession(getAuthOptions());
  if (!session) redirect("/login");

  const userId = (session.user as any).userId as string;
  const viewingId = getViewingTournamentIdFromCookies();
  const [groupsAll, tournament] = await Promise.all([
    getGroupsByUser(userId),
    getTournament(viewingId),
  ]);

  const groups = groupsAll.filter((g) => g.tournamentId === viewingId);

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
                <UsersIcon className="w-7 h-7 sm:w-9 sm:h-9 text-court-500 shrink-0" />
                Groups
              </h1>
              {tournament && (
                <p className="text-ink-300 text-sm mt-2 font-body">
                  <span className={isLocked ? "text-red-400" : "text-green-400"}>
                    {isLocked ? "🔒 Picks locked" : "✅ Picks open"}
                  </span>
                  {" · "}
                  Create pools, share invites, and track standings with your crew.
                </p>
              )}
            </div>
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
                <UsersIcon className="w-10 h-10 text-hardwood-600 mx-auto mb-3" aria-hidden />
                <p className="text-ink-300 font-body mb-2">No groups yet.</p>
                <p className="text-ink-400 text-sm font-body mb-6 max-w-md mx-auto">
                  Create a group and share the invite link with your friends.
                </p>
                <Link
                  href="/groups/new"
                  className="inline-flex items-center gap-2 bg-hardwood-700 hover:bg-hardwood-600 border border-hardwood-500 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors"
                >
                  <PlusIcon className="w-4 h-4" /> Create your first group
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
                    <div className="h-full min-h-[7.5rem] bg-hardwood-900/50 border border-hardwood-600 hover:border-court-500 rounded-xl p-5 transition-all duration-150 hover:shadow-lg hover:-translate-y-0.5 group">
                      <div className="flex items-start justify-between gap-2 mb-3">
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
