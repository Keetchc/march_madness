"use client";
import { useEffect, useState } from "react";
import { XIcon, CheckCircleIcon, XCircleIcon, MinusCircleIcon } from "lucide-react";
import type { GamePicksResponse, Team } from "@/lib/types";

interface GamePickModalProps {
  gameId: string | null;
  projectedTeam1Id: string | null;
  projectedTeam2Id: string | null;
  teams: Map<string, Team>;
  onClose: () => void;
  hidePickStatus?: boolean;
}

export function GamePickModal({ gameId, projectedTeam1Id, projectedTeam2Id, teams, onClose, hidePickStatus = false }: GamePickModalProps) {
  const [data, setData] = useState<GamePicksResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!gameId) return;
    setLoading(true);
    setData(null);
    fetch(`/api/games/${gameId}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [gameId]);

  if (!gameId) return null;

  const actualTeam1Id = data?.game.team1Id ?? null;
  const actualTeam2Id = data?.game.team2Id ?? null;
  const effectiveTeam1Id = actualTeam1Id ?? projectedTeam1Id;
  const effectiveTeam2Id = actualTeam2Id ?? projectedTeam2Id;

  const team1 = data?.team1 ?? (effectiveTeam1Id ? teams.get(effectiveTeam1Id) ?? null : null);
  const team2 = data?.team2 ?? (effectiveTeam2Id ? teams.get(effectiveTeam2Id) ?? null : null);

  const isGameFinal = data?.game.status === "final";
  const hasActualTeams = actualTeam1Id != null && actualTeam2Id != null;

  const team1Picks = data?.picks.filter((p) => p.pickedTeamId === effectiveTeam1Id) ?? [];
  const team2Picks = data?.picks.filter((p) => p.pickedTeamId === effectiveTeam2Id) ?? [];

  const otherPicks = data?.picks.filter(
    (p) => p.pickedTeamId !== effectiveTeam1Id && p.pickedTeamId !== effectiveTeam2Id
  ) ?? [];

  const otherByTeam = new Map<string, { teamName: string; picks: GamePicksResponse["picks"] }>();
  for (const pick of otherPicks) {
    const existing = otherByTeam.get(pick.pickedTeamId);
    if (existing) {
      existing.picks.push(pick);
    } else {
      otherByTeam.set(pick.pickedTeamId, { teamName: pick.pickedTeamName, picks: [pick] });
    }
  }

  const totalPicks = (data?.picks.length ?? 0);
  const isProjected = !hasActualTeams && (effectiveTeam1Id != null || effectiveTeam2Id != null);

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-hardwood-800 border border-hardwood-500 rounded-2xl w-full max-w-lg shadow-2xl animate-slide-up max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-hardwood-600">
          <div>
            <p className="font-mono text-xs text-court-500 uppercase tracking-widest mb-0.5">
              {data?.game.round} {data?.game.region ? `-- ${data.game.region}` : ""}
            </p>
            <h2 className="font-display text-2xl font-black uppercase text-white">
              {team1?.name ?? "TBD"}{" "}
              <span className="text-court-500">vs</span>{" "}
              {team2?.name ?? "TBD"}
            </h2>
            {isProjected && (
              <p className="font-mono text-[10px] text-gray-600 mt-0.5">Projected matchup</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors p-1"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Game status */}
        {isGameFinal && (
          <div className="px-5 py-3 bg-hardwood-700 border-b border-hardwood-600">
            <p className="text-sm font-mono text-gray-400">
              Final:{" "}
              <span className="text-white font-semibold">
                {team1?.name} {data!.game.score1} --{" "}
                {data!.game.score2} {team2?.name}
              </span>
              {" -- "}
              <span className="text-green-400">
                Winner: {data!.game.winnerId === actualTeam1Id
                  ? team1?.name
                  : team2?.name}
              </span>
            </p>
          </div>
        )}

        {loading && (
          <div className="p-10 text-center text-gray-500 font-mono text-sm">
            Loading picks...
          </div>
        )}

        {data && !loading && (
          <div className="p-5">
            {totalPicks === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4 font-body">
                No one has picked this game yet.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <PickColumn
                    teamName={team1?.name ?? "TBD"}
                    seed={team1?.seed}
                    picks={team1Picks}
                    isWinner={!hidePickStatus && isGameFinal && data.game.winnerId === actualTeam1Id}
                    isLoser={!hidePickStatus && isGameFinal && data.game.winnerId === actualTeam2Id}
                    hidePickStatus={hidePickStatus}
                  />
                  <PickColumn
                    teamName={team2?.name ?? "TBD"}
                    seed={team2?.seed}
                    picks={team2Picks}
                    isWinner={!hidePickStatus && isGameFinal && data.game.winnerId === actualTeam2Id}
                    isLoser={!hidePickStatus && isGameFinal && data.game.winnerId === actualTeam1Id}
                    hidePickStatus={hidePickStatus}
                  />
                </div>

                {otherByTeam.size > 0 && (
                  <div className="mt-4 pt-4 border-t border-hardwood-600">
                    <p className={`font-mono text-xs uppercase tracking-widest mb-3 ${hidePickStatus ? "text-gray-500" : "text-red-400/80"}`}>
                      {hidePickStatus ? "Other picks" : "Eliminated picks"}
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      {Array.from(otherByTeam.entries()).map(([teamId, { teamName, picks }]) => (
                        <PickColumn
                          key={teamId}
                          teamName={teamName}
                          picks={picks}
                          isWinner={false}
                          isLoser={!hidePickStatus}
                          forceIncorrect={!hidePickStatus}
                          hidePickStatus={hidePickStatus}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Summary bar */}
                <div className="mt-4 pt-4 border-t border-hardwood-600">
                  <div className="flex flex-wrap gap-2 text-xs font-mono text-gray-500">
                    <span>{team1Picks.length} picked {team1?.shortName ?? "T1"}</span>
                    <span>--</span>
                    <span>{team2Picks.length} picked {team2?.shortName ?? "T2"}</span>
                    {otherPicks.length > 0 && (
                      <>
                        <span>--</span>
                        <span className={hidePickStatus ? "text-gray-500" : "text-red-400/60"}>
                          {otherPicks.length} {hidePickStatus ? "other" : "eliminated"}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="mt-2 h-2 bg-hardwood-700 rounded-full overflow-hidden flex">
                    {totalPicks > 0 && (
                      <>
                        <div
                          className="h-full bg-court-500 transition-all duration-500"
                          style={{ width: `${(team1Picks.length / totalPicks) * 100}%` }}
                        />
                        <div
                          className="h-full bg-court-700 transition-all duration-500"
                          style={{ width: `${(team2Picks.length / totalPicks) * 100}%` }}
                        />
                        {otherPicks.length > 0 && (
                          <div
                            className="h-full bg-red-900/60 transition-all duration-500"
                            style={{ width: `${(otherPicks.length / totalPicks) * 100}%` }}
                          />
                        )}
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PickColumn({
  teamName,
  seed,
  picks,
  isWinner,
  isLoser,
  forceIncorrect,
  hidePickStatus,
}: {
  teamName: string;
  seed?: number;
  picks: GamePicksResponse["picks"];
  isWinner: boolean;
  isLoser: boolean;
  forceIncorrect?: boolean;
  hidePickStatus?: boolean;
}) {
  return (
    <div>
      <div
        className={`text-xs font-display font-bold uppercase tracking-wide mb-2 flex items-center gap-1 ${
          hidePickStatus ? "text-gray-400" :
          isWinner ? "text-green-400" : isLoser || forceIncorrect ? "text-red-400" : "text-gray-400"
        }`}
      >
        {seed && <span className="text-gray-600">#{seed}</span>}
        {teamName}
        {!hidePickStatus && isWinner && <CheckCircleIcon className="w-3 h-3" />}
        {!hidePickStatus && (isLoser || forceIncorrect) && <XCircleIcon className="w-3 h-3" />}
      </div>
      <div className="space-y-1.5">
        {picks.map((pick) => {
          const correct = hidePickStatus ? null : forceIncorrect ? false : pick.isCorrect;
          return (
            <div
              key={pick.userId}
              className="flex items-center gap-2 bg-hardwood-700 rounded-lg px-2.5 py-1.5"
            >
              <div className="w-5 h-5 rounded-full bg-court-700 flex-shrink-0 flex items-center justify-center">
                <span className="text-[9px] font-bold text-white">
                  {pick.userName.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="text-sm text-white font-body truncate flex-1">
                {pick.userName.split(" ")[0]}
              </span>
              {correct === true && (
                <CheckCircleIcon className="w-4 h-4 text-green-400 flex-shrink-0" />
              )}
              {correct === false && (
                <XCircleIcon className="w-4 h-4 text-red-400 flex-shrink-0" />
              )}
              {correct === null && (
                <MinusCircleIcon className="w-4 h-4 text-gray-600 flex-shrink-0" />
              )}
            </div>
          );
        })}
        {picks.length === 0 && (
          <p className="text-xs text-gray-600 font-mono py-1">No picks</p>
        )}
      </div>
    </div>
  );
}
