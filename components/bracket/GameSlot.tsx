"use client";
import type { MouseEvent } from "react";
import type { Game, Team, Picks } from "@/lib/types";
import { clsx } from "clsx";

interface GameSlotProps {
  game: Game;
  teams: Map<string, Team>;
  picks: Picks;
  projectedSlots?: Set<string>;
  actualTeamOverrides?: Map<string, string>;
  onPick?: (gameId: string, teamId: string) => void;
  onInfoClick: () => void;
  isReadOnly: boolean;
  size: "sm" | "md";
}

export function GameSlot({ game, teams, picks, projectedSlots, actualTeamOverrides, onPick, onInfoClick, isReadOnly, size }: GameSlotProps) {
  const team1 = game.team1Id ? teams.get(game.team1Id) : null;
  const team2 = game.team2Id ? teams.get(game.team2Id) : null;
  const userPick = picks[game.gameId];
  const isComplete = game.status === "final";
  const isTeam1Projected = projectedSlots?.has(`${game.gameId}:1`) ?? false;
  const isTeam2Projected = projectedSlots?.has(`${game.gameId}:2`) ?? false;

  const actualTeam1Id = actualTeamOverrides?.get(`${game.gameId}:1`) ?? null;
  const actualTeam2Id = actualTeamOverrides?.get(`${game.gameId}:2`) ?? null;
  const actualTeam1 = actualTeam1Id ? teams.get(actualTeam1Id) : null;
  const actualTeam2 = actualTeam2Id ? teams.get(actualTeam2Id) : null;

  const card = (
      <div
        className={clsx(
          "bg-hardwood-800 border border-hardwood-600 rounded-lg overflow-hidden",
          isReadOnly && "transition-all duration-150 hover:border-court-600",
        )}
      >
        <TeamRow
          team={team1}
          actualTeam={actualTeam1}
          isWinner={isComplete && game.winnerId === game.team1Id}
          isLoser={isComplete && game.winnerId !== game.team1Id && !!game.winnerId}
          isPicked={userPick === game.team1Id}
          isCorrect={isComplete && userPick === game.team1Id && game.winnerId === game.team1Id}
          isWrong={isComplete && userPick === game.team1Id && game.winnerId !== game.team1Id}
          isProjected={isTeam1Projected}
          isOverridden={actualTeam1Id !== null}
          onClick={() => {
            if (!isReadOnly && game.team1Id) onPick?.(game.gameId, game.team1Id);
          }}
          canPick={!isReadOnly && !isComplete && !!game.team1Id}
          size={size}
          score={game.score1}
        />
        <div className="border-t border-hardwood-700" />
        <TeamRow
          team={team2}
          actualTeam={actualTeam2}
          isWinner={isComplete && game.winnerId === game.team2Id}
          isLoser={isComplete && game.winnerId !== game.team2Id && !!game.winnerId}
          isPicked={userPick === game.team2Id}
          isCorrect={isComplete && userPick === game.team2Id && game.winnerId === game.team2Id}
          isWrong={isComplete && userPick === game.team2Id && game.winnerId !== game.team2Id}
          isProjected={isTeam2Projected}
          isOverridden={actualTeam2Id !== null}
          onClick={() => !isReadOnly && game.team2Id && onPick?.(game.gameId, game.team2Id)}
          canPick={!isReadOnly && !isComplete && !!game.team2Id}
          size={size}
          score={game.score2}
        />
      </div>
  );

  if (isReadOnly) {
    return (
      <div
        onClick={onInfoClick}
        className="cursor-pointer"
        title="Click to see all picks"
      >
        {card}
      </div>
    );
  }

  return card;
}

function TeamRow({
  team, actualTeam, isWinner, isLoser, isPicked, isCorrect, isWrong, isProjected, isOverridden,
  onClick, canPick, size, score,
}: {
  team: Team | null | undefined;
  actualTeam: Team | null | undefined;
  isWinner: boolean; isLoser: boolean;
  isPicked: boolean; isCorrect: boolean; isWrong: boolean;
  isProjected: boolean; isOverridden: boolean;
  onClick: () => void; canPick: boolean;
  size: "sm" | "md"; score: number | null;
}) {
  return (
    <div className="flex flex-col">
      {/* Actual team annotation when user's pick was wrong and a different team advanced */}
      {isOverridden && actualTeam && (
        <div className={clsx(
          "flex items-center gap-1 bg-green-950/30 border-b border-green-900/30",
          size === "sm" ? "px-2 py-0.5" : "px-3 py-0.5",
        )}>
          <span className={clsx(
            "font-mono text-green-600/80 flex-shrink-0 w-5 text-right",
            size === "sm" ? "text-sm" : "text-[9px]",
          )}>
            {actualTeam.seed}
          </span>
          <span className={clsx(
            "font-display font-bold uppercase tracking-wide text-green-500/70 truncate",
            size === "sm" ? "text-sm" : "text-[10px]",
          )}>
            {size === "sm" ? actualTeam.shortName : actualTeam.name}
          </span>
          <span className={clsx(
            "font-mono text-green-600/60 flex-shrink-0 ml-auto",
            size === "sm" ? "text-xs" : "text-[9px]",
          )}>
            actual
          </span>
        </div>
      )}
      <div
        onClick={
          canPick
            ? (e: MouseEvent<HTMLDivElement>) => {
                e.stopPropagation();
                onClick();
              }
            : undefined
        }
        className={clsx(
          "flex items-center gap-2 transition-colors select-none",
          size === "sm" ? "px-2.5 py-2" : "px-3 py-2.5",
          canPick && "cursor-pointer",
          isCorrect && "bg-green-950/50",
          isWrong && "bg-red-950/40",
          isOverridden && "bg-red-950/30",
          isPicked && !isCorrect && !isWrong && !isOverridden && "bg-hardwood-700/60",
          canPick && !isPicked && "hover:bg-hardwood-700",
          isLoser && !isPicked && !isOverridden && "opacity-40",
        )}
      >
        {team && (
          <span className={clsx(
            "font-mono flex-shrink-0 w-5 text-right",
            size === "sm" ? "text-base" : "text-xs",
            isPicked && isCorrect ? "text-green-400"
              : isPicked && isWrong ? "text-red-400"
              : isOverridden ? "text-red-400/60"
              : isWinner ? "text-court-400"
              : isProjected ? "text-court-400"
              : "text-ink-400",
          )}>
            {team.seed}
          </span>
        )}

        <span className={clsx(
          "font-display font-bold uppercase tracking-wide flex-1 truncate",
          size === "sm" ? "text-base" : "text-sm",
          isPicked && isCorrect ? "text-green-400"
            : isPicked && isWrong ? "text-red-400/70"
            : isOverridden ? "text-red-400/50 line-through"
            : team
              ? isWinner
                ? "text-white"
                : isProjected
                  ? "text-ink-300 italic"
                  : isPicked
                    ? "text-ink-100"
                    : "text-ink-100"
              : "text-ink-400",
        )}>
          {team ? (size === "sm" ? team.shortName : team.name) : "TBD"}
        </span>

        {score !== null && !isOverridden && (
          <span className={clsx(
            "font-mono flex-shrink-0",
            size === "sm" ? "text-sm" : "text-xs",
            isWinner ? "text-white font-bold" : "text-ink-300"
          )}>
            {score}
          </span>
        )}

        {isPicked && (
          <span className={clsx(
            "flex-shrink-0 ml-0.5 font-mono",
            size === "sm" ? "text-sm" : "text-xs",
            isCorrect ? "text-green-400" : isWrong ? "text-red-400" : "text-ink-400",
          )}>
            {isCorrect ? "✓" : isWrong ? "✗" : "●"}
          </span>
        )}

        {isOverridden && !isPicked && (
          <span className={clsx(
            "flex-shrink-0 ml-0.5 font-mono text-red-400/60",
            size === "sm" ? "text-sm" : "text-xs",
          )}>
            ✗
          </span>
        )}
      </div>
    </div>
  );
}
