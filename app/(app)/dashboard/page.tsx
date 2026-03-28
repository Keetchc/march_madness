import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getBracketsByUser } from "@/lib/dynamo/queries/brackets";
import { getGroupsByUser } from "@/lib/dynamo/queries/groups";
import { getTournament } from "@/lib/dynamo/queries/games";
import Link from "next/link";
import { TrophyIcon, UsersIcon, PlusIcon } from "lucide-react";

const TOURNAMENT_ID = process.env.TOURNAMENT_ID ?? "2026";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const userId = session!.user.userId;

  const [brackets, groups, tournament] = await Promise.all([
    getBracketsByUser(userId),
    getGroupsByUser(userId),
    getTournament(TOURNAMENT_ID),
  ]);

  const isLocked = tournament
    ? new Date() > new Date(tournament.lockDate) && tournament.status !== "pending"
    : false;

  return (
    <div className="space-y-10 animate-fade-in">
      {/* Header */}
      <div>
        <p className="font-mono text-court-500 text-xs uppercase tracking-widest mb-1">
          Welcome back
        </p>
        <h1 className="font-display text-5xl font-black uppercase tracking-tight text-white">
          {session!.user?.name?.split(" ")[0]}'s Dashboard
        </h1>
        {tournament && (
          <p className="text-gray-500 text-sm mt-1 font-body">
            {tournament.name} •{" "}
            <span className={isLocked ? "text-red-400" : "text-green-400"}>
              {isLocked ? "🔒 Picks locked" : "✅ Picks open"}
            </span>
          </p>
        )}
      </div>

      {/* My Brackets */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-white flex items-center gap-2">
            <TrophyIcon className="w-5 h-5 text-court-500" />
            My Brackets
          </h2>
          {!isLocked && (
            <Link
              href="/bracket/new"
              className="flex items-center gap-2 bg-court-500 hover:bg-court-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              <PlusIcon className="w-4 h-4" />
              New Bracket
            </Link>
          )}
        </div>

        {brackets.length === 0 ? (
          <div className="bg-hardwood-800 border border-hardwood-600 rounded-xl p-8 text-center">
            <p className="text-gray-500 font-body mb-4">No brackets yet.</p>
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
            {brackets.map((bracket) => (
              <Link key={bracket.bracketId} href={`/bracket/${bracket.bracketId}`}>
                <div className="bg-hardwood-800 border border-hardwood-600 hover:border-court-500 rounded-xl p-5 transition-all duration-150 hover:shadow-lg hover:-translate-y-0.5 group">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-display text-xl font-bold text-white group-hover:text-court-400 uppercase tracking-wide">
                      {bracket.name}
                    </h3>
                    <span className="font-mono text-2xl font-bold text-court-500">
                      {bracket.score}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-mono text-gray-500">
                    <span>Max possible: {bracket.maxPossibleScore}</span>
                    {bracket.isEliminated && (
                      <span className="text-red-400">Eliminated</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* My Groups */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-white flex items-center gap-2">
            <UsersIcon className="w-5 h-5 text-court-500" />
            My Groups
          </h2>
          <Link
            href="/groups/new"
            className="flex items-center gap-2 bg-hardwood-700 hover:bg-hardwood-600 border border-hardwood-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            New Group
          </Link>
        </div>

        {groups.length === 0 ? (
          <div className="bg-hardwood-800 border border-hardwood-600 rounded-xl p-8 text-center">
            <p className="text-gray-500 font-body mb-4">
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
            {groups.map((group) => (
              <Link key={group.groupId} href={`/groups/${group.groupId}`}>
                <div className="bg-hardwood-800 border border-hardwood-600 hover:border-court-500 rounded-xl p-5 transition-all duration-150 hover:-translate-y-0.5 group">
                  <h3 className="font-display text-xl font-bold uppercase tracking-wide text-white group-hover:text-court-400 mb-1">
                    {group.name}
                  </h3>
                  <p className="text-xs text-gray-500 font-mono">
                    {group.adminUserId === userId ? "👑 Admin" : "Member"} ·{" "}
                    {new Date(group.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

