"use client";

import { useMemo, useState } from "react";
import { clsx } from "clsx";
import {
  ROUNDS_IN_ORDER,
  ROUND_DISPLAY_LABELS,
  type LeaderboardEntry,
  type Round,
} from "@/lib/types";

type Props = {
  leaderboard: LeaderboardEntry[];
};

export function RoundMiniLeaderboard({ leaderboard }: Props) {
  const [round, setRound] = useState<Round>("R64");

  const rows = useMemo(() => {
    return [...leaderboard]
      .map((e) => ({
        entry: e,
        pts: Math.round(e.roundBreakdown[round] * 10) / 10,
      }))
      .filter((r) => r.pts > 0)
      .sort((a, b) => b.pts - a.pts || b.entry.score - a.entry.score)
      .slice(0, 12);
  }, [leaderboard, round]);

  if (leaderboard.length === 0) return null;

  return (
    <div className="bg-hardwood-800 border border-hardwood-600 rounded-2xl p-5">
      <h2 className="font-display font-bold uppercase tracking-wide text-sm text-white mb-1">
        Points by round
      </h2>
      <p className="text-xs text-ink-300 font-body mb-3">
        Who scored the most from games that finished in each NCAA round (using this pool&apos;s rules).
      </p>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {ROUNDS_IN_ORDER.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRound(r)}
            className={clsx(
              "font-mono text-[10px] uppercase tracking-wide px-2.5 py-1 rounded-lg border transition-colors",
              r === round
                ? "bg-court-500/20 border-court-500 text-court-300"
                : "bg-hardwood-900/50 border-hardwood-600 text-ink-300 hover:border-hardwood-500"
            )}
          >
            {ROUND_DISPLAY_LABELS[r]}
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-ink-400 font-body">No points in this round yet—games need to go final.</p>
      ) : (
        <ol className="space-y-2">
          {rows.map(({ entry, pts }, i) => (
            <li
              key={entry.bracketId}
              className="flex items-center justify-between gap-3 text-sm font-mono border-b border-hardwood-700/80 pb-2 last:border-0 last:pb-0"
            >
              <span className="text-ink-300 w-6 shrink-0">{i + 1}</span>
              <span className="text-white truncate flex-1 min-w-0 font-body">{entry.userName}</span>
              <span className="text-court-400 tabular-nums shrink-0">{pts} pts</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
