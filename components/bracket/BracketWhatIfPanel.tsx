"use client";

import { useMemo, useState } from "react";
import type { Bracket, Game, Picks, ScoringRules, Team } from "@/lib/types";
import { DEFAULT_SCORING_RULES } from "@/lib/types";
import { scoreBracket, isGameFinalStatus } from "@/lib/scoring/engine";
import { applyWhatIfWinners } from "@/lib/scoring/what-if";
import { clsx } from "clsx";
import { FlaskConicalIcon, RotateCcwIcon } from "lucide-react";

type Props = {
  picks: Picks;
  games: Game[];
  teams: Map<string, Team>;
  /** Defaults to site standard scoring when omitted (public bracket view). */
  scoringRules?: ScoringRules;
  /** When set (e.g. opened from a group), clarifies which pool’s rules apply. */
  scoringSourceLabel?: string;
};

const ghostBracket = (picks: Picks): Bracket => ({
  bracketId: "what-if",
  userId: "",
  tournamentId: "",
  name: "",
  picks,
  score: 0,
  maxPossibleScore: 0,
  isEliminated: false,
  createdAt: "",
  updatedAt: "",
});

export function BracketWhatIfPanel({
  picks,
  games,
  teams,
  scoringRules = DEFAULT_SCORING_RULES,
  scoringSourceLabel,
}: Props) {
  const [winnerByGameId, setWinnerByGameId] = useState<Record<string, string>>({});

  const pending = useMemo(
    () =>
      games.filter((g) => !isGameFinalStatus(g.status) && g.team1Id && g.team2Id),
    [games]
  );

  const baseline = useMemo(
    () => scoreBracket(ghostBracket(picks), games, teams, scoringRules),
    [picks, games, teams, scoringRules]
  );

  const simulated = useMemo(() => {
    const g2 = applyWhatIfWinners(games, winnerByGameId);
    return scoreBracket(ghostBracket(picks), g2, teams, scoringRules);
  }, [picks, games, teams, scoringRules, winnerByGameId]);

  const delta = simulated.score - baseline.score;
  const hasOverrides = Object.keys(winnerByGameId).length > 0;

  if (pending.length === 0) return null;

  return (
    <div className="bg-hardwood-800 border border-hardwood-600 rounded-2xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FlaskConicalIcon className="w-4 h-4 text-amber-400" />
            <h2 className="font-display font-bold uppercase tracking-wide text-sm text-white">What if…</h2>
          </div>
          <p className="text-xs text-ink-300 font-body max-w-xl">
            Pick hypothetical winners for unfinished games. Scores use{" "}
            {scoringSourceLabel ? (
              <>
                <span className="text-court-400 font-medium">{scoringSourceLabel}</span>&apos;s pool scoring rules
              </>
            ) : (
              "the default site scoring rules"
            )}
            — doesn&apos;t change your bracket or real results.
          </p>
        </div>
        {hasOverrides ? (
          <button
            type="button"
            onClick={() => setWinnerByGameId({})}
            className="inline-flex items-center gap-1.5 text-xs font-mono text-ink-200 hover:text-white border border-hardwood-600 rounded-lg px-2 py-1.5"
          >
            <RotateCcwIcon className="w-3.5 h-3.5" />
            Reset
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-4 font-mono text-sm">
        <div>
          <span className="text-ink-300">Live score</span>
          <span className="text-white tabular-nums ml-2">{baseline.score}</span>
        </div>
        <div>
          <span className="text-ink-300">Simulated</span>
          <span className="text-amber-200 tabular-nums ml-2">{simulated.score}</span>
          {hasOverrides && delta !== 0 ? (
            <span className={clsx("ml-2 tabular-nums", delta > 0 ? "text-green-400" : "text-red-400")}>
              ({delta > 0 ? "+" : ""}
              {delta})
            </span>
          ) : null}
        </div>
        <div>
          <span className="text-ink-300">Max possible (sim)</span>
          <span className="text-ink-100 tabular-nums ml-2">{simulated.maxPossibleScore}</span>
        </div>
      </div>

      <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
        {pending.slice(0, 48).map((g) => {
          const t1 = g.team1Id ? teams.get(g.team1Id) : undefined;
          const t2 = g.team2Id ? teams.get(g.team2Id) : undefined;
          const pick = winnerByGameId[g.gameId] ?? winnerByGameId[String(g.gameId)];
          return (
            <div
              key={g.gameId}
              className="flex flex-wrap items-center gap-2 text-xs border border-hardwood-700 rounded-lg px-2 py-2 bg-hardwood-900/40"
            >
              <span className="text-ink-300 font-mono w-10 shrink-0">{g.round}</span>
              <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
                {[g.team1Id, g.team2Id].filter(Boolean).map((tid) => {
                  const t = tid ? teams.get(tid) : undefined;
                  const label = t?.shortName ?? t?.name ?? tid;
                  const active = pick === tid;
                  return (
                    <button
                      key={String(tid)}
                      type="button"
                      onClick={() =>
                        setWinnerByGameId((prev) => {
                          const next = { ...prev };
                          const id = g.gameId;
                          if (prev[id] === tid || prev[String(id)] === tid) {
                            delete next[id];
                            delete next[String(id)];
                          } else {
                            next[id] = tid!;
                          }
                          return next;
                        })
                      }
                      className={clsx(
                        "rounded-full px-2 py-1 font-mono border transition-colors",
                        active
                          ? "bg-amber-500/25 border-amber-500 text-amber-100"
                          : "bg-hardwood-800 border-hardwood-600 text-ink-100 hover:border-hardwood-500"
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {pending.length > 48 ? (
        <p className="text-[10px] text-ink-400 font-mono">Showing first 48 unfinished games. Reset to try others.</p>
      ) : null}
    </div>
  );
}
