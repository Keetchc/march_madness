import { ROUNDS_IN_ORDER, type ScoringRules } from "@/lib/types";

type Props = {
  scoringRules: ScoringRules;
};

export function GroupScoringRulesPanel({ scoringRules }: Props) {
  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <p className="font-mono text-xs text-court-500 uppercase tracking-widest mb-1">Scoring</p>
        <h2 className="font-display text-2xl sm:text-3xl font-bold uppercase tracking-wide text-white">
          Pool scoring rules
        </h2>
        <p className="text-ink-300 text-sm font-body mt-2">
          Points for this group only—your bracket page may use default rules unless you open it from this pool.
        </p>
      </div>

      <div className="bg-hardwood-800 border border-hardwood-600 rounded-2xl p-5">
        <p className="text-xs font-mono text-ink-300 mb-4">
          Each correct pick: <span className="text-ink-200">base × team seed</span>
          {Object.values(scoringRules.rounds).some((r) => r.upsetMultiplier > 0) ? (
            <span className="text-ink-400">; upset rounds apply a multiplier when a worse seed wins</span>
          ) : null}
          {scoringRules.bonuses.correctChampion > 0 ? (
            <span className="text-ink-400">; champion bonus if set</span>
          ) : null}
          .
        </p>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {ROUNDS_IN_ORDER.map((round) => {
            const rule = scoringRules.rounds[round];
            return (
              <div key={round} className="text-center">
                <p className="font-mono text-xs text-ink-400 mb-1">{round}</p>
                <p className="font-display font-bold text-white text-lg">{rule.basePoints}</p>
                {rule.upsetMultiplier > 0 && (
                  <p className="font-mono text-[10px] text-court-500">+upset×{rule.upsetMultiplier}</p>
                )}
              </div>
            );
          })}
        </div>
        {scoringRules.bonuses.correctChampion > 0 && (
          <p className="text-xs font-mono text-ink-300 mt-3 pt-3 border-t border-hardwood-600">
            🏆 Champion bonus: +{scoringRules.bonuses.correctChampion} pts
          </p>
        )}
        {scoringRules.bonuses.perfectRound > 0 && (
          <p className="text-xs font-mono text-ink-300 mt-2">
            ✓ Perfect round (all games correct in a completed round): +{scoringRules.bonuses.perfectRound} pts per
            round
          </p>
        )}
      </div>
    </div>
  );
}
