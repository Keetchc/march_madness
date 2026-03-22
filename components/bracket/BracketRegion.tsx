"use client";
import type { Game, Team, Picks, Region, Round } from "@/lib/types";
import { GameSlot } from "./GameSlot";

interface BracketRegionProps {
  region: Region;
  games: Game[];
  teams: Map<string, Team>;
  picks: Picks;
  projectedSlots?: Set<string>;
  actualTeamOverrides?: Map<string, string>;
  onPick?: (gameId: string, teamId: string) => void;
  onGameClick: (gameId: string) => void;
  isReadOnly: boolean;
  layout: "horizontal" | "vertical";
  mirrored?: boolean;
}

// Rounds within a region (excludes FinalFour/NCG)
const REGION_ROUNDS: Round[] = ["R64", "R32", "S16", "E8"];
const ROUND_LABELS: Record<Round, string> = {
  R64: "First Round",
  R32: "Round of 32",
  S16: "Sweet 16",
  E8:  "Elite Eight",
  F4:  "Final Four",
  NCG: "Championship",
};

export function BracketRegion({
  region,
  games,
  teams,
  picks,
  projectedSlots,
  actualTeamOverrides,
  onPick,
  onGameClick,
  isReadOnly,
  layout,
  mirrored = false,
}: BracketRegionProps) {
  const rounds = mirrored ? [...REGION_ROUNDS].reverse() : REGION_ROUNDS;

  const gamesByRound = (round: Round) =>
    games
      .filter((g) => g.round === round)
      .sort((a, b) => a.bracketSlot - b.bracketSlot);

  // ── Vertical layout (mobile) ──────────────────────────────────────────────
  if (layout === "vertical") {
    return (
      <div className="space-y-6">
        {REGION_ROUNDS.map((round) => {
          const roundGames = gamesByRound(round);
          if (roundGames.length === 0) return null;
          return (
            <div key={round}>
              <p className="font-display text-xs font-bold uppercase tracking-widest text-gray-600 mb-3">
                {ROUND_LABELS[round]}
              </p>
              <div className="space-y-2">
                {roundGames.map((game) => (
                  <GameSlot
                    key={game.gameId}
                    game={game}
                    teams={teams}
                    picks={picks}
                    projectedSlots={projectedSlots}
                    actualTeamOverrides={actualTeamOverrides}
                    onPick={onPick}
                    onInfoClick={() => onGameClick(game.gameId)}
                    isReadOnly={isReadOnly}
                    size="md"
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ── Horizontal layout (desktop) ───────────────────────────────────────────
  // Each round has half as many games as the previous.
  // We space them out vertically so the bracket "tree" connects properly.
  return (
    <div className="flex gap-1.5">
      {rounds.map((round) => {
        const roundGames = gamesByRound(round);
        const totalSlots = Math.pow(2, REGION_ROUNDS.indexOf(round) === -1
          ? 0
          : REGION_ROUNDS.length - 1 - REGION_ROUNDS.indexOf(round));

        const gapUnits = totalSlots / roundGames.length;

        return (
          <div key={round} className="flex flex-col flex-1 min-w-[188px]">
            <p className="font-display text-xs font-bold uppercase tracking-widest text-gray-700 mb-1 text-center truncate px-1">
              {ROUND_LABELS[round]}
            </p>
            <div className="flex flex-col flex-1 justify-around gap-1">
              {roundGames.map((game, i) => (
                <div
                  key={game.gameId}
                  className="flex flex-col justify-center"
                  style={{
                    // Even distribution with spacing proportional to round depth
                    marginTop: i === 0 ? `${(gapUnits - 1) * 24}px` : undefined,
                    marginBottom:
                      i === roundGames.length - 1 ? `${(gapUnits - 1) * 24}px` : undefined,
                  }}
                >
                  <GameSlot
                    game={game}
                    teams={teams}
                    picks={picks}
                    projectedSlots={projectedSlots}
                    actualTeamOverrides={actualTeamOverrides}
                    onPick={onPick}
                    onInfoClick={() => onGameClick(game.gameId)}
                    isReadOnly={isReadOnly}
                    size="sm"
                  />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

