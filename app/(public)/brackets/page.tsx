import { getBracketsByTournament } from "@/lib/dynamo/queries/brackets";
import { getTournament } from "@/lib/dynamo/queries/games";
import { getUser } from "@/lib/dynamo/queries/users";
import Link from "next/link";

const TOURNAMENT_ID = process.env.TOURNAMENT_ID ?? "2026";

export default async function AllBracketsPage() {
  const [brackets, tournament] = await Promise.all([
    getBracketsByTournament(TOURNAMENT_ID),
    getTournament(TOURNAMENT_ID),
  ]);

  const enriched = await Promise.all(
    brackets.map(async (b) => {
      const user = await getUser(b.userId);
      return { ...b, userName: user?.name ?? "Unknown" };
    })
  );

  enriched.sort((a, b) => a.userName.localeCompare(b.userName));

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <p className="font-mono text-xs text-court-500 uppercase tracking-widest mb-1">
          {tournament?.name ?? "Tournament"}
        </p>
        <h1 className="font-display text-5xl font-black uppercase tracking-tight text-white">
          All Brackets
        </h1>
        <p className="text-gray-500 text-sm font-mono mt-1">
          {enriched.length} brackets
        </p>
      </div>

      {enriched.length === 0 ? (
        <div className="bg-hardwood-800 border border-hardwood-600 rounded-2xl p-12 text-center text-gray-600 font-body">
          No brackets submitted yet.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {enriched.map((b) => (
            <Link
              key={b.bracketId}
              href={`/bracket/${b.bracketId}`}
              className="bg-hardwood-800 border border-hardwood-600 rounded-xl p-5 hover:border-court-600 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-court-700 flex-shrink-0 flex items-center justify-center">
                  <span className="font-display text-sm font-bold text-white">
                    {b.userName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="font-display font-bold uppercase tracking-wide text-white group-hover:text-court-400 transition-colors truncate">
                    {b.userName}
                  </p>
                  <p className="text-xs text-gray-600 font-body truncate">
                    {b.name}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
