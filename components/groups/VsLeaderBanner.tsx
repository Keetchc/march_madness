"use client";

import Link from "next/link";
import { GitCompareIcon } from "lucide-react";
import type { VsLeaderSnapshot } from "@/lib/scoring/vs-leader";

type Props = {
  snapshot: VsLeaderSnapshot;
  groupId: string;
  myBracketId: string;
};

export function VsLeaderBanner({ snapshot, groupId, myBracketId }: Props) {
  const bracketHref = `/bracket/${encodeURIComponent(myBracketId)}?fromGroup=${encodeURIComponent(groupId)}`;
  const { leaderName, pointsBehind, disagreePendingGames, maxUpsideOnDisagreements } = snapshot;

  return (
    <div className="bg-court-500/10 border border-court-500/35 rounded-2xl p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <GitCompareIcon className="w-5 h-5 text-court-400 shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1 space-y-2">
          <h2 className="font-display font-bold uppercase tracking-wide text-sm text-white">
            You vs #1
          </h2>
          <p className="text-sm text-ink-100 font-body leading-relaxed">
            <span className="text-white font-medium">{leaderName}</span> leads this pool by{" "}
            <span className="text-court-400 font-mono tabular-nums">{pointsBehind}</span> pts. On games still
            open, you picked a different winner in{" "}
            <span className="text-court-400 font-mono tabular-nums">{disagreePendingGames}</span> of them
            {disagreePendingGames > 0 ? (
              <>
                {" "}
                — rough upside on just those disagreements: up to{" "}
                <span className="text-court-400 font-mono tabular-nums">~{maxUpsideOnDisagreements}</span> pts
                (pool rules).
              </>
            ) : (
              "."
            )}
          </p>
          <Link
            href={bracketHref}
            className="inline-flex text-sm font-semibold text-court-400 hover:text-court-300 transition-colors"
          >
            Open your bracket with this pool&apos;s scoring (what-if) →
          </Link>
        </div>
      </div>
    </div>
  );
}
