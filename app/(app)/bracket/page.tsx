import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { getBracketsByUser } from "@/lib/dynamo/queries/brackets";
import { getTournament } from "@/lib/dynamo/queries/games";
import { picksEffectivelyClosed } from "@/lib/picks-lock";
import Link from "next/link";
import { TrophyIcon, PlusIcon } from "lucide-react";

const TOURNAMENT_ID = process.env.TOURNAMENT_ID ?? "2026";

export default async function BracketsListPage() {
  const session = await getServerSession(getAuthOptions());
  const userId = (session!.user as any).userId;

  const [brackets, tournament] = await Promise.all([
    getBracketsByUser(userId),
    getTournament(TOURNAMENT_ID),
  ]);

  const isLocked = picksEffectivelyClosed(tournament);

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-court-500 text-xs uppercase tracking-widest mb-1">
            Tournament
          </p>
          <h1 className="font-display text-5xl font-black uppercase tracking-tight text-white flex items-center gap-3">
            <TrophyIcon className="w-10 h-10 text-court-500" />
            My Brackets
          </h1>
        </div>
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
        <div className="bg-hardwood-800 border border-hardwood-600 rounded-xl p-12 text-center">
          <p className="text-ink-300 font-body mb-4 text-lg">
            You haven't created any brackets yet.
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
          {brackets.map((bracket) => (
            <Link key={bracket.bracketId} href={`/bracket/${bracket.bracketId}`}>
              <div className="bg-hardwood-800 border border-hardwood-600 hover:border-court-500 rounded-xl p-6 transition-all duration-150 hover:shadow-lg hover:-translate-y-0.5 group">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-display text-xl font-bold text-white group-hover:text-court-400 uppercase tracking-wide">
                    {bracket.name}
                  </h3>
                  <span className="font-mono text-2xl font-bold text-court-500">
                    {bracket.score}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs font-mono text-ink-300">
                  <span>{Object.keys(bracket.picks).length}/63 picks</span>
                  <span>Max: {bracket.maxPossibleScore}</span>
                </div>
                {bracket.isEliminated && (
                  <p className="text-red-400 text-xs font-mono mt-2">Eliminated</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
