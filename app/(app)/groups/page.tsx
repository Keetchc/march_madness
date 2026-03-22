import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getGroupsByUser } from "@/lib/dynamo/queries/groups";
import Link from "next/link";
import { PlusIcon, UsersIcon, LinkIcon } from "lucide-react";

export default async function GroupsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const userId = (session.user as any).userId as string;
  const groups = await getGroupsByUser(userId);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-end justify-between">
        <div>
          <p className="font-mono text-xs text-court-500 uppercase tracking-widest mb-1">
            March Madness
          </p>
          <h1 className="font-display text-5xl font-black uppercase tracking-tight text-white">
            Groups
          </h1>
        </div>
        <Link
          href="/groups/new"
          className="flex items-center gap-2 bg-court-500 hover:bg-court-600 text-white font-display font-bold uppercase tracking-wide text-sm px-4 py-2.5 rounded-xl transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          New Group
        </Link>
      </div>

      {groups.length === 0 ? (
        <div className="bg-hardwood-800 border border-hardwood-600 rounded-2xl p-16 text-center">
          <UsersIcon className="w-12 h-12 text-hardwood-600 mx-auto mb-4" />
          <p className="text-gray-500 font-body mb-2">No groups yet.</p>
          <p className="text-gray-600 text-sm font-body mb-6">
            Create a group and share the invite link with your friends.
          </p>
          <Link
            href="/groups/new"
            className="inline-flex items-center gap-2 bg-court-500 hover:bg-court-600 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors"
          >
            <PlusIcon className="w-4 h-4" /> Create your first group
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group) => (
            <Link key={group.groupId} href={`/groups/${group.groupId}`}>
              <div className="bg-hardwood-800 border border-hardwood-600 hover:border-court-500 rounded-2xl p-6 transition-all hover:-translate-y-0.5 hover:shadow-xl group">
                <div className="flex items-start justify-between mb-4">
                  <h2 className="font-display text-2xl font-black uppercase tracking-wide text-white group-hover:text-court-400 transition-colors">
                    {group.name}
                  </h2>
                  {group.adminUserId === userId && (
                    <span className="text-xs font-mono text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 px-2 py-0.5 rounded-full">
                      Admin
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs font-mono text-gray-600">
                  <LinkIcon className="w-3 h-3" />
                  <span>Invite link available</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

