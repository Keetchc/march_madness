import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getGroup, getGroupMembers, getGroupMembership } from "@/lib/dynamo/queries/groups";
import { getBracket } from "@/lib/dynamo/queries/brackets";
import { getTournament } from "@/lib/dynamo/queries/games";
import { getUser } from "@/lib/dynamo/queries/users";
import type { Bracket } from "@/lib/types";

export const dynamic = "force-dynamic";

const TOURNAMENT_ID = process.env.TOURNAMENT_ID ?? "2026";

export default async function GroupBracketsPage({ params }: { params: { id: string } }) {
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
  const brackets = (await Promise.all(bracketIds.map((id) => getBracket(id)))).filter(
    (b): b is Bracket => b != null
  );

  const tournament = await getTournament(group.tournamentId ?? TOURNAMENT_ID);

  const enriched = await Promise.all(
    brackets.map(async (b) => {
      const user = await getUser(b.userId);
      return { ...b, userName: user?.name ?? "Unknown" };
    })
  );

  enriched.sort((a, b) => a.userName.localeCompare(b.userName));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-court-500 uppercase tracking-widest mb-1">
            <Link href={`/groups/${group.groupId}`} className="hover:text-court-400 transition-colors">
              {group.name}
            </Link>
            {" · "}
            {tournament?.name ?? "Tournament"}
          </p>
          <h1 className="font-display text-3xl sm:text-5xl font-black uppercase tracking-tight text-white">
            Group Brackets
          </h1>
          <p className="text-gray-500 text-sm font-mono mt-1">{enriched.length} brackets</p>
        </div>
        <Link
          href={`/groups/${group.groupId}/compare`}
          className="text-sm font-mono text-court-400 hover:text-court-300 transition-colors"
        >
          Compare two brackets →
        </Link>
      </div>

      {enriched.length === 0 ? (
        <div className="bg-hardwood-800 border border-hardwood-600 rounded-2xl p-12 text-center text-gray-600 font-body">
          No brackets in this group yet.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {enriched.map((b) => (
            <Link
              key={b.bracketId}
              href={`/bracket/${b.bracketId}`}
              className="bg-hardwood-800 border border-hardwood-600 rounded-xl p-6 hover:border-court-600 transition-colors group"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-court-700 flex-shrink-0 flex items-center justify-center">
                  <span className="font-display text-xl font-bold text-white">
                    {b.userName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="font-display text-xl font-bold uppercase tracking-wide text-white group-hover:text-court-400 transition-colors truncate">
                    {b.userName}
                  </p>
                  <p className="text-base text-gray-600 font-body truncate">{b.name}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
