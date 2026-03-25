import Link from "next/link";
import type { Bracket } from "@/lib/types";

export function BracketListCard({
  bracket,
  pools,
}: {
  bracket: Bracket;
  pools: { groupId: string; name: string }[];
}) {
  return (
    <div className="flex h-full min-h-[7.5rem] flex-col bg-hardwood-900/50 border border-hardwood-600 rounded-xl transition-all duration-150 hover:border-court-500 hover:shadow-lg hover:-translate-y-0.5 overflow-hidden">
      <Link
        href={`/bracket/${bracket.bracketId}`}
        className="group block flex-1 p-5 pb-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-court-500/60 focus-visible:ring-inset"
      >
        <h3 className="font-display text-xl font-bold text-white group-hover:text-court-400 uppercase tracking-wide min-w-0 mb-2">
          {bracket.name}
        </h3>
        <p className="text-xs font-mono text-ink-400 tabular-nums">
          {Object.keys(bracket.picks).length}/63 picks
        </p>
      </Link>
      <div className="border-t border-hardwood-700/80 px-5 py-3 bg-hardwood-950/30">
        <p className="font-mono text-[10px] uppercase tracking-wider text-ink-500 mb-1.5">
          {pools.length > 0 ? "In pools" : "Pools"}
        </p>
        {pools.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {pools.map((g) => (
              <Link
                key={g.groupId}
                href={`/groups/${g.groupId}`}
                className="inline-flex max-w-full items-center rounded-md border border-hardwood-600 bg-hardwood-800/80 px-2 py-1 text-[11px] font-mono text-court-300 hover:border-court-600 hover:text-court-200 transition-colors truncate"
                title={g.name}
              >
                {g.name}
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-ink-500 font-body leading-snug">
            Not linked to a group yet—join a pool and link this bracket from the group page.
          </p>
        )}
      </div>
    </div>
  );
}
