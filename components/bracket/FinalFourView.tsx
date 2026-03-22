"use client";
import type { Game, Team, Picks } from "@/lib/types";
import { GameSlot } from "./GameSlot";

interface FinalFourViewProps {
  games: Game[];
  teams: Map<string, Team>;
  picks: Picks;
  projectedSlots?: Set<string>;
  actualTeamOverrides?: Map<string, string>;
  onPick?: (gameId: string, teamId: string) => void;
  onGameClick: (gameId: string) => void;
  isReadOnly: boolean;
}

export function FinalFourView({ games, teams, picks, projectedSlots, actualTeamOverrides, onPick, onGameClick, isReadOnly }: FinalFourViewProps) {
  const f4Games = games.filter((g) => g.round === "F4").sort((a, b) => a.bracketSlot - b.bracketSlot);
  const ncgGame = games.find((g) => g.round === "NCG");

  return (
    <div className="w-full max-w-xl mx-auto">
      {/* Section label */}
      <div className="text-center mb-3">
        <p className="font-display text-xs font-bold uppercase tracking-widest text-court-600">
          Final Four &amp; Championship
        </p>
      </div>

      {/* Layout: F4 game — Champion slot — F4 game */}
      <div className="flex items-center gap-3">
        {/* Left F4 game */}
        <div className="flex-1">
          {f4Games[0] ? (
            <>
              <p className="font-display text-[9px] uppercase tracking-widest text-gray-700 text-center mb-1">
                Semifinal 1
              </p>
              <GameSlot
                game={f4Games[0]}
                teams={teams}
                picks={picks}
                projectedSlots={projectedSlots}
                actualTeamOverrides={actualTeamOverrides}
                onPick={onPick}
                onInfoClick={() => onGameClick(f4Games[0].gameId)}
                isReadOnly={isReadOnly}
                size="md"
              />
            </>
          ) : (
            <EmptySlot label="Semifinal 1" />
          )}
        </div>

        {/* Championship + champion display */}
        <div className="flex-1 flex flex-col items-center gap-2">
          {ncgGame ? (
            <>
              <p className="font-display text-[9px] uppercase tracking-widest text-court-500 text-center">
                Championship
              </p>
              <GameSlot
                game={ncgGame}
                teams={teams}
                picks={picks}
                projectedSlots={projectedSlots}
                actualTeamOverrides={actualTeamOverrides}
                onPick={onPick}
                onInfoClick={() => onGameClick(ncgGame.gameId)}
                isReadOnly={isReadOnly}
                size="md"
              />
              {ncgGame.winnerId ? (
                <div className="text-center mt-1">
                  <div className="text-2xl">T</div>
                  <p className="font-display font-black uppercase text-court-400 text-sm tracking-wide">
                    {teams.get(ncgGame.winnerId)?.name ?? "Champion"}
                  </p>
                </div>
              ) : picks[ncgGame.gameId] ? (
                <div className="text-center mt-1">
                  <p className="font-display text-[9px] uppercase tracking-widest text-gray-600">
                    Your Champion
                  </p>
                  <p className="font-display font-black uppercase text-court-500/60 text-sm tracking-wide">
                    {teams.get(picks[ncgGame.gameId])?.name ?? "TBD"}
                  </p>
                </div>
              ) : null}
            </>
          ) : (
            <EmptySlot label="Championship" />
          )}
        </div>

        {/* Right F4 game */}
        <div className="flex-1">
          {f4Games[1] ? (
            <>
              <p className="font-display text-[9px] uppercase tracking-widest text-gray-700 text-center mb-1">
                Semifinal 2
              </p>
              <GameSlot
                game={f4Games[1]}
                teams={teams}
                picks={picks}
                projectedSlots={projectedSlots}
                actualTeamOverrides={actualTeamOverrides}
                onPick={onPick}
                onInfoClick={() => onGameClick(f4Games[1].gameId)}
                isReadOnly={isReadOnly}
                size="md"
              />
            </>
          ) : (
            <EmptySlot label="Semifinal 2" />
          )}
        </div>
      </div>
    </div>
  );
}

function EmptySlot({ label }: { label: string }) {
  return (
    <div className="border border-dashed border-hardwood-600 rounded-lg p-4 text-center">
      <p className="font-display text-[9px] uppercase tracking-widest text-gray-700 mb-1">{label}</p>
      <p className="font-mono text-xs text-gray-700">TBD</p>
    </div>
  );
}

