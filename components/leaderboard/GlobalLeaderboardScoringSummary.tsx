import { DEFAULT_SCORING_RULES, ROUNDS_IN_ORDER } from "@/lib/types";

/**
 * Site-default scoring for the global leaderboard — compact strip so the page stays leaderboard-first.
 */
export function GlobalLeaderboardScoringSummary() {
  return (
    <div className="w-full rounded-lg border border-hardwood-600/70 bg-hardwood-900/35 px-3 py-2 sm:px-3.5 sm:py-2">
      <p className="text-[11px] sm:text-xs text-ink-300 font-body leading-snug">
        <span className="font-mono text-[10px] uppercase tracking-wider text-court-500/90">Scoring</span>
        {" — "}
        Each correct pick:{" "}
        <span className="text-ink-100 font-medium">round base × winning team seed</span>
        . Bases by round{" "}
        <span className="font-mono text-[10px] sm:text-[11px] text-ink-200 whitespace-normal break-words">
          {ROUNDS_IN_ORDER.map((r, i) => (
            <span key={r}>
              {i > 0 ? <span className="text-ink-600"> · </span> : null}
              <span className="text-ink-500">{r}</span>
              <span className="text-court-400/90"> {DEFAULT_SCORING_RULES.rounds[r].basePoints}</span>
            </span>
          ))}
        </span>
        . Private pools may use different rules; this board uses defaults only.
      </p>
    </div>
  );
}
