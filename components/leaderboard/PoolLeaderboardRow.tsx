"use client";

import Link from "next/link";
import { clsx } from "clsx";
import { UserAvatar } from "@/components/UserAvatar";
import { ROUND_DISPLAY_LABELS, type BracketStatus, type LeaderboardEntry } from "@/lib/types";

const STATUS_CONFIG: Record<BracketStatus, { label: string; color: string }> = {
  leader: { label: "Leader", color: "text-yellow-400" },
  alive: { label: "Alive", color: "text-green-400" },
  longshot: { label: "Long Shot", color: "text-amber-400" },
  eliminated: { label: "Eliminated", color: "text-red-400" },
};

export function StatusBadge({ status }: { status: BracketStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <span className={clsx("text-xs md:text-base font-mono leading-tight", config.color)}>{config.label}</span>
  );
}

export function PoolLeaderboardTableHeaders({
  identityColumnLabel = "Player",
}: {
  identityColumnLabel?: string;
} = {}) {
  return (
    <>
      <div className="hidden md:grid grid-cols-[4rem_1fr_8rem_8rem_8rem_8rem] gap-6 px-8 py-4 border-b border-hardwood-600 bg-hardwood-700">
        <span className="font-mono text-sm text-ink-400 uppercase">#</span>
        <span className="font-mono text-sm text-ink-400 uppercase">{identityColumnLabel}</span>
        <span className="font-mono text-sm text-ink-400 uppercase text-right">Score</span>
        <span className="font-mono text-sm text-ink-400 uppercase text-right">Max</span>
        <span
          className="font-mono text-sm text-ink-400 uppercase text-right"
          title="Correct picks out of tournament games already final"
        >
          Correct
        </span>
        <span className="font-mono text-sm text-ink-400 uppercase text-right">Status</span>
      </div>
      <div className="md:hidden px-4 py-3 border-b border-hardwood-600 bg-hardwood-700/80 grid grid-cols-4 gap-2 text-center">
        <span className="font-mono text-[10px] text-ink-400 uppercase tracking-wide">Score</span>
        <span className="font-mono text-[10px] text-ink-400 uppercase tracking-wide">Max</span>
        <span
          className="font-mono text-[10px] text-ink-400 uppercase tracking-wide"
          title="Correct picks out of games already final"
        >
          Correct
        </span>
        <span className="font-mono text-[10px] text-ink-400 uppercase tracking-wide">Status</span>
      </div>
    </>
  );
}

type PoolLeaderboardRowProps = {
  entry: LeaderboardEntry;
  isCurrentUser?: boolean;
  /**
   * When true, non–current-user rows hide competitive details (scores, bracket name, status, critical games)
   * and are not links — used for group standings before picks lock.
   */
  maskStats?: boolean;
  /** Leaderboard rank (1-based). Ignored for masked non–current-user rows (they use the reduced layout). */
  rankDisplay: number;
  /** Appended to bracket URL (e.g. `?fromGroup=…`) for pool-aware what-if. */
  bracketHrefQuery?: string;
  /** Global leaderboard: show bracket title only, no account name or profile photo. */
  bracketNameOnly?: boolean;
};

export function PoolLeaderboardRow({
  entry,
  isCurrentUser,
  maskStats = false,
  rankDisplay,
  bracketHrefQuery = "",
  bracketNameOnly = false,
}: PoolLeaderboardRowProps) {
  const reduced = Boolean(maskStats && !isCurrentUser);
  const bracketSubtitle = reduced ? "Bracket submitted" : entry.bracketName;

  const rankColors: Record<number, string> = {
    1: "text-yellow-400",
    2: "text-ink-100",
    3: "text-amber-600",
  };

  if (reduced) {
    const inner = (
      <div
        className={clsx(
          "flex flex-col gap-0 px-4 py-4 md:gap-0 md:px-8 md:py-5 md:grid md:grid-cols-[4rem_1fr_8rem_8rem_8rem_8rem] md:gap-6 md:items-center",
          "cursor-default"
        )}
      >
        <div className="flex items-center gap-3 min-w-0 pb-3 md:contents md:pb-0">
          <span className="font-display text-2xl md:text-3xl font-black w-10 shrink-0 text-center md:w-auto md:text-left text-ink-400">
            —
          </span>
          <div className="flex items-center gap-3 min-w-0 flex-1 md:flex-initial md:min-w-0">
            {bracketNameOnly ? (
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-court-800 border-2 border-hardwood-600 flex-shrink-0 flex items-center justify-center">
                <span className="font-display text-lg md:text-xl font-bold text-court-200">
                  {(entry.bracketName || "?").charAt(0).toUpperCase()}
                </span>
              </div>
            ) : (
              <UserAvatar
                src={entry.userPicture}
                name={entry.userName}
                width={48}
                height={48}
                fallbackVariant="muted"
                className="w-10 h-10 md:w-12 md:h-12 ring-2 ring-hardwood-600"
              />
            )}
            <div className="min-w-0">
              <p
                className={clsx(
                  "font-display text-base md:text-lg font-bold uppercase tracking-wide truncate",
                  isCurrentUser ? "text-court-400" : "text-white"
                )}
              >
                {bracketNameOnly ? entry.bracketName : entry.userName}
              </p>
              {!bracketNameOnly ? (
                <p className="text-xs md:text-sm text-ink-400 font-body truncate">{bracketSubtitle}</p>
              ) : isCurrentUser ? (
                <p className="text-[10px] md:text-xs text-court-600 font-mono normal-case">you</p>
              ) : null}
            </div>
          </div>
        </div>
        <div
          className={clsx(
            "grid grid-cols-4 gap-x-2 gap-y-1 text-center items-center md:contents",
            "border-t border-hardwood-600/90 pt-3 mt-0",
            "rounded-lg bg-hardwood-900/55 px-2 py-2.5 -mx-1 ring-1 ring-hardwood-600/40",
            "md:mx-0 md:mt-0 md:pt-0 md:px-0 md:py-0 md:rounded-none md:border-t-0 md:bg-transparent md:ring-0"
          )}
        >
          <div className="md:text-right">
            <span className="font-mono text-2xl font-bold text-ink-400 tabular-nums">—</span>
          </div>
          <div className="md:text-right">
            <span className="font-mono text-sm md:text-lg text-ink-400 tabular-nums">—</span>
          </div>
          <div className="md:text-right">
            <span className="font-mono text-sm md:text-lg text-ink-400 tabular-nums">—</span>
          </div>
          <div className="flex justify-center md:justify-end md:text-right">
            <span className="font-mono text-sm text-ink-400">—</span>
          </div>
        </div>
      </div>
    );
    return inner;
  }

  const rankShown = rankDisplay;
  const rankClass = rankColors[rankDisplay] ?? "text-ink-400";

  const inner = (
    <div
      className={clsx(
        "flex flex-col gap-0 px-4 py-4 md:gap-0 md:px-8 md:py-5 md:grid md:grid-cols-[4rem_1fr_8rem_8rem_8rem_8rem] md:gap-6 md:items-center",
        "hover:bg-hardwood-700 transition-colors",
        isCurrentUser && "bg-court-500/5 hover:bg-court-500/10"
      )}
    >
      <div className="flex items-center gap-3 min-w-0 pb-3 md:contents md:pb-0">
        <span
          className={clsx(
            "font-display text-2xl md:text-3xl font-black w-10 shrink-0 text-center md:w-auto md:text-left",
            rankClass
          )}
        >
          {rankShown}
        </span>

        <div className="flex items-center gap-3 min-w-0 flex-1 md:flex-initial md:min-w-0">
          {bracketNameOnly ? (
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-court-800 border-2 border-hardwood-600 flex-shrink-0 flex items-center justify-center">
              <span className="font-display text-lg md:text-xl font-bold text-court-200">
                {(entry.bracketName || "?").charAt(0).toUpperCase()}
              </span>
            </div>
          ) : (
            <UserAvatar
              src={entry.userPicture}
              name={entry.userName}
              width={48}
              height={48}
              className="w-10 h-10 md:w-12 md:h-12 ring-2 ring-hardwood-600"
            />
          )}
          <div className="min-w-0">
            <p
              className={clsx(
                "font-display text-base md:text-lg font-bold uppercase tracking-wide truncate",
                isCurrentUser ? "text-court-400" : "text-white"
              )}
            >
              {bracketNameOnly ? (
                <>
                  {entry.bracketName}
                  {isCurrentUser && (
                    <span className="ml-2 text-[10px] md:text-xs text-court-600 normal-case font-mono">you</span>
                  )}
                </>
              ) : (
                <>
                  {entry.userName}
                  {isCurrentUser && (
                    <span className="ml-2 text-[10px] md:text-xs text-court-600 normal-case font-mono">you</span>
                  )}
                </>
              )}
            </p>
            {!bracketNameOnly ? (
              <p className="text-xs md:text-sm text-ink-400 font-body truncate">{bracketSubtitle}</p>
            ) : null}
          </div>
        </div>
      </div>

      <div
        className={clsx(
          "grid grid-cols-4 gap-x-2 gap-y-1 text-center items-center md:contents",
          "border-t border-hardwood-600/90 pt-3 mt-0",
          "rounded-lg bg-hardwood-900/55 px-2 py-2.5 -mx-1 ring-1 ring-hardwood-600/40",
          "md:mx-0 md:mt-0 md:pt-0 md:px-0 md:py-0 md:rounded-none md:border-t-0 md:bg-transparent md:ring-0"
        )}
      >
        <div className="flex flex-col gap-0.5 md:block md:text-right">
          <span className="font-mono text-2xl md:text-2xl font-bold text-white tabular-nums">{entry.score}</span>
        </div>
        <div className="flex flex-col gap-0.5 md:block md:text-right">
          <span className="font-mono text-sm md:text-lg text-ink-300 tabular-nums">{entry.maxPossibleScore}</span>
        </div>
        <div className="flex flex-col gap-0.5 md:block md:text-right">
          <span className="font-mono text-sm md:text-lg text-ink-200 tabular-nums">
            {entry.correctPicks}/{entry.gamesDecidedCount}
          </span>
        </div>
        <div className="flex justify-center md:justify-end md:text-right">
          <StatusBadge status={entry.status} />
        </div>
      </div>

      {entry.criticalGames.length > 0 && entry.status !== "eliminated" && (
        <div className="md:col-start-2 md:col-end-7 mt-2 md:mt-1">
          <p className="font-mono text-[10px] md:text-xs uppercase tracking-widest text-court-500 mb-1.5">
            {entry.status === "leader" && entry.criticalGames.some((g) => g.rivalsAheadWithDifferentPick > 0)
              ? "Tiebreak — key remaining games"
              : "Most Important Remaining Games"}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {entry.criticalGames.slice(0, 3).map((game) => (
              <span
                key={game.gameId}
                className={clsx(
                  "inline-flex items-center gap-1 rounded-full px-2 py-1 font-mono text-[10px] md:text-xs border",
                  game.isMustHave
                    ? "text-yellow-300 border-yellow-600/70 bg-yellow-900/25"
                    : "text-ink-100 border-hardwood-500 bg-hardwood-700/60"
                )}
              >
                <span>{game.teamName}</span>
                <span className="text-ink-300">{game.round}</span>
                <span className="text-white tabular-nums">+{game.potentialPoints}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {entry.nextSliceRound &&
        entry.nextSliceCriticalGames.length > 0 &&
        entry.status !== "eliminated" && (
          <div
            className={clsx(
              "md:col-start-2 md:col-end-7 md:mt-1",
              entry.criticalGames.length > 0 ? "mt-3" : "mt-2",
            )}
          >
            <p className="font-mono text-[10px] md:text-xs uppercase tracking-widest text-sky-400/90 mb-0.5">
              Next up — {ROUND_DISPLAY_LABELS[entry.nextSliceRound]}
            </p>
            <p className="text-[10px] text-ink-400 font-body mb-1.5 leading-snug">
              Pending games in this round where your pick differs from others in this pool.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {entry.nextSliceCriticalGames.slice(0, 4).map((game) => (
                <span
                  key={`slice-${game.gameId}`}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-1 font-mono text-[10px] md:text-xs border text-sky-100 border-sky-700/60 bg-sky-950/35"
                  title={
                    game.rivalsAheadWithDifferentPick > 0
                      ? `${game.rivalsAheadWithDifferentPick} other bracket(s) picked the other team`
                      : undefined
                  }
                >
                  <span>{game.teamName}</span>
                  <span className="text-sky-600/90 tabular-nums">+{game.potentialPoints}</span>
                  {game.rivalsAheadWithDifferentPick > 0 ? (
                    <span className="text-sky-600/70 text-[9px] md:text-[10px]">
                      vs {game.rivalsAheadWithDifferentPick}
                    </span>
                  ) : null}
                </span>
              ))}
            </div>
          </div>
        )}
    </div>
  );

  return <Link href={`/bracket/${entry.bracketId}${bracketHrefQuery}`}>{inner}</Link>;
}
