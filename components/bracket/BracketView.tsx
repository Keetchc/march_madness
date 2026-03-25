"use client";
import { useState, useRef, useLayoutEffect, useCallback } from "react";
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
  /** Limit “who picked this game” to a pool’s linked brackets (requires signed-in member). */
  gamePicksGroupId?: string;
  /** `aggregate` shows pick % / counts only (e.g. official bracket). */
  pickListMode?: "users" | "aggregate";
  /** Dynamo partition for game pick API (ids repeat per season). */
  tournamentId?: string;
}

const REGIONS: Region[] = ["East", "West", "South", "Midwest"];

export function BracketView({
  games,
  teams,
  picks,
  projectedSlots,
  actualTeamOverrides,
  onPick,
  isReadOnly = false,
  hidePickStatus = false,
  gamePicksGroupId,
  pickListMode = "users",
  tournamentId,
}: BracketViewProps) {
  const [activeTab, setActiveTab] = useState<Region | "FinalFour">("East");
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);

  const selectedGame = selectedGameId ? games.find((g) => g.gameId === selectedGameId) ?? null : null;

  const byRegion = (r: Region) => games.filter((g) => g.region === r);
  const finalFourGames = games.filter((g) => g.region === "FinalFour");

  return (
    <>
      {/* ─── Mobile: tabs ──────────────────────────────────────────────── */}
      <div className="md:hidden">
        <div className="flex flex-wrap gap-x-1 border-b border-hardwood-600 mb-4">
          {([...REGIONS, "FinalFour"] as const).map((region) => (
            <button
              key={region}
              onClick={() => setActiveTab(region)}
              className={clsx(
                "px-4 py-3 font-display font-bold uppercase text-sm tracking-wide transition-colors border-b-2 -mb-px whitespace-nowrap",
                activeTab === region
                  ? "text-court-400 border-court-500"
                  : "text-ink-300 border-transparent hover:text-ink-100"
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

      {/* ─── Desktop: full bracket (scales down to fit width — no horizontal scroll) ─ */}
      <div className="hidden md:block w-full max-w-full min-w-0">
        <DesktopBracketFit>
          <div className="min-w-[1680px] space-y-4">
            <div className="flex gap-4">
              <RegionColumn label="East">
                <BracketRegion region="East" games={byRegion("East")} teams={teams} picks={picks}
                  projectedSlots={projectedSlots} actualTeamOverrides={actualTeamOverrides} onPick={onPick} onGameClick={setSelectedGameId} isReadOnly={isReadOnly} layout="horizontal" />
              </RegionColumn>
              <RegionColumn label="West">
                <BracketRegion region="West" games={byRegion("West")} teams={teams} picks={picks}
                  projectedSlots={projectedSlots} actualTeamOverrides={actualTeamOverrides} onPick={onPick} onGameClick={setSelectedGameId} isReadOnly={isReadOnly} layout="horizontal" mirrored />
              </RegionColumn>
            </div>

            <div className="flex justify-center py-1">
              <FinalFourView games={finalFourGames} teams={teams} picks={picks}
                projectedSlots={projectedSlots} actualTeamOverrides={actualTeamOverrides} onPick={onPick} onGameClick={setSelectedGameId} isReadOnly={isReadOnly} />
            </div>

            <div className="flex gap-4">
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
        </DesktopBracketFit>
      </div>

      <GamePickModal
        gameId={selectedGameId}
        projectedTeam1Id={selectedGame?.team1Id ?? null}
        projectedTeam2Id={selectedGame?.team2Id ?? null}
        teams={teams}
        onClose={() => setSelectedGameId(null)}
        hidePickStatus={hidePickStatus}
        groupId={gamePicksGroupId}
        pickListMode={pickListMode}
        tournamentId={tournamentId}
      />
    </>
  );
}

/** Keeps the fixed-layout desktop bracket at 1:1 coordinates but scales it to fit the container width. */
function DesktopBracketFit({ children }: { children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ scale: 1, w: 0, h: 0 });

  const measure = useCallback(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;
    if (container.clientWidth === 0) return;

    const w = content.offsetWidth;
    const h = content.offsetHeight;
    if (w === 0 || h === 0) return;

    const avail = container.clientWidth;
    const scale = avail >= w ? 1 : avail / w;
    setBox((prev) =>
      prev.scale === scale && prev.w === w && prev.h === h ? prev : { scale, w, h },
    );
  }, []);

  useLayoutEffect(() => {
    measure();
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(content);
    return () => ro.disconnect();
  }, [measure]);

  const { scale, w, h } = box;
  const sized = w > 0 && h > 0;

  return (
    <div ref={containerRef} className="w-full max-w-full min-w-0 overflow-hidden pb-6">
      <div className="flex justify-center">
        <div
          style={
            sized
              ? {
                  width: w * scale,
                  height: h * scale,
                  overflow: "hidden",
                }
              : undefined
          }
        >
          <div
            ref={contentRef}
            className="w-max max-w-none"
            style={
              sized && scale < 1
                ? { transform: `scale(${scale})`, transformOrigin: "top left" }
                : undefined
            }
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function RegionColumn({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex-1">
      <p className="font-display text-sm font-bold uppercase tracking-widest text-ink-400 mb-2 text-center">
        {label}
      </p>
      {children}
    </div>
  );
}

