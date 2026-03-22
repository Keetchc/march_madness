"use client";
import { useState } from "react";
import type { Game, Team, Picks, Region } from "@/lib/types";
import { BracketRegion } from "./BracketRegion";
import { FinalFourView } from "./FinalFourView";
import { GamePickModal } from "./GamePickModal";
import { clsx } from "clsx";

interface BracketViewProps {
  games: Game[];
  teams: Map<string, Team>;
  picks: Picks;
  projectedSlots?: Set<string>;
  actualTeamOverrides?: Map<string, string>;
  onPick?: (gameId: string, teamId: string) => void;
  isReadOnly?: boolean;
  hidePickStatus?: boolean;
}

const REGIONS: Region[] = ["East", "West", "South", "Midwest"];

export function BracketView({ games, teams, picks, projectedSlots, actualTeamOverrides, onPick, isReadOnly = false, hidePickStatus = false }: BracketViewProps) {
  const [activeTab, setActiveTab] = useState<Region | "FinalFour">("East");
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);

  const selectedGame = selectedGameId ? games.find((g) => g.gameId === selectedGameId) ?? null : null;

  const byRegion = (r: Region) => games.filter((g) => g.region === r);
  const finalFourGames = games.filter((g) => g.region === "FinalFour");

  return (
    <>
      {/* ─── Mobile: tabs ──────────────────────────────────────────────── */}
      <div className="md:hidden">
        <div className="flex border-b border-hardwood-600 mb-4 overflow-x-auto">
          {([...REGIONS, "FinalFour"] as const).map((region) => (
            <button
              key={region}
              onClick={() => setActiveTab(region)}
              className={clsx(
                "flex-shrink-0 px-4 py-3 font-display font-bold uppercase text-sm tracking-wide transition-colors border-b-2 -mb-px whitespace-nowrap",
                activeTab === region
                  ? "text-court-400 border-court-500"
                  : "text-gray-500 border-transparent hover:text-gray-300"
              )}
            >
              {region === "FinalFour" ? "F4 / Champ" : region}
            </button>
          ))}
        </div>

        <div className="animate-fade-in">
          {activeTab === "FinalFour" ? (
            <FinalFourView
              games={finalFourGames}
              teams={teams}
              picks={picks}
              projectedSlots={projectedSlots}
              actualTeamOverrides={actualTeamOverrides}
              onPick={onPick}
              onGameClick={setSelectedGameId}
              isReadOnly={isReadOnly}
            />
          ) : (
            <BracketRegion
              region={activeTab}
              games={byRegion(activeTab)}
              teams={teams}
              picks={picks}
              projectedSlots={projectedSlots}
              actualTeamOverrides={actualTeamOverrides}
              onPick={onPick}
              onGameClick={setSelectedGameId}
              isReadOnly={isReadOnly}
              layout="vertical"
            />
          )}
        </div>
      </div>

      {/* ─── Desktop: full bracket ─────────────────────────────────────── */}
      <div className="hidden md:block overflow-x-auto pb-6">
        <div className="min-w-[1800px] space-y-6">
          <div className="flex gap-6">
            <RegionColumn label="East">
              <BracketRegion region="East" games={byRegion("East")} teams={teams} picks={picks}
                projectedSlots={projectedSlots} actualTeamOverrides={actualTeamOverrides} onPick={onPick} onGameClick={setSelectedGameId} isReadOnly={isReadOnly} layout="horizontal" />
            </RegionColumn>
            <RegionColumn label="West">
              <BracketRegion region="West" games={byRegion("West")} teams={teams} picks={picks}
                projectedSlots={projectedSlots} actualTeamOverrides={actualTeamOverrides} onPick={onPick} onGameClick={setSelectedGameId} isReadOnly={isReadOnly} layout="horizontal" mirrored />
            </RegionColumn>
          </div>

          <div className="flex justify-center py-2">
            <FinalFourView games={finalFourGames} teams={teams} picks={picks}
              projectedSlots={projectedSlots} actualTeamOverrides={actualTeamOverrides} onPick={onPick} onGameClick={setSelectedGameId} isReadOnly={isReadOnly} />
          </div>

          <div className="flex gap-6">
            <RegionColumn label="South">
              <BracketRegion region="South" games={byRegion("South")} teams={teams} picks={picks}
                projectedSlots={projectedSlots} actualTeamOverrides={actualTeamOverrides} onPick={onPick} onGameClick={setSelectedGameId} isReadOnly={isReadOnly} layout="horizontal" />
            </RegionColumn>
            <RegionColumn label="Midwest">
              <BracketRegion region="Midwest" games={byRegion("Midwest")} teams={teams} picks={picks}
                projectedSlots={projectedSlots} actualTeamOverrides={actualTeamOverrides} onPick={onPick} onGameClick={setSelectedGameId} isReadOnly={isReadOnly} layout="horizontal" mirrored />
            </RegionColumn>
          </div>
        </div>
      </div>

      <GamePickModal
        gameId={selectedGameId}
        projectedTeam1Id={selectedGame?.team1Id ?? null}
        projectedTeam2Id={selectedGame?.team2Id ?? null}
        teams={teams}
        onClose={() => setSelectedGameId(null)}
        hidePickStatus={hidePickStatus}
      />
    </>
  );
}

function RegionColumn({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex-1">
      <p className="font-display text-sm font-bold uppercase tracking-widest text-gray-600 mb-2 text-center">
        {label}
      </p>
      {children}
    </div>
  );
}

