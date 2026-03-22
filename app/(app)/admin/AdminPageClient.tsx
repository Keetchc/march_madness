"use client";
import { useState } from "react";
import type { Game, Team, Tournament, Round } from "@/lib/types";
import { clsx } from "clsx";
import { RefreshCwIcon, CheckCircleIcon } from "lucide-react";
import { AdminBracketBuilder } from "@/components/admin/AdminBracketBuilder";

interface AdminPageClientProps {
  games: Game[];
  teams: Map<string, Team> | Team[];
  tournament: Tournament;
}

type AdminTab = "results" | "add-bracket";

const ROUND_ORDER: Round[] = ["R64", "R32", "S16", "E8", "F4", "NCG"];
const ROUND_LABELS: Record<Round, string> = {
  R64: "First Round", R32: "Round of 32", S16: "Sweet 16",
  E8: "Elite Eight", F4: "Final Four", NCG: "Championship",
};

export function AdminPageClient({ games, teams: teamsInput, tournament }: AdminPageClientProps) {
  const teamsMap: Map<string, Team> = teamsInput instanceof Map
    ? teamsInput
    : new Map((teamsInput as Team[]).map((t) => [t.id, t]));

  const [adminTab, setAdminTab] = useState<AdminTab>("results");

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="font-mono text-xs text-yellow-500 uppercase tracking-widest mb-1">Admin</p>
          <h1 className="font-display text-5xl font-black uppercase tracking-tight text-white">
            {adminTab === "results" ? "Game Results" : "Add Bracket"}
          </h1>
          <p className="text-gray-500 font-mono text-sm mt-1">
            {tournament.name} · Status:{" "}
            <span className={clsx(
              tournament.status === "active" ? "text-green-400" :
              tournament.status === "complete" ? "text-gray-400" : "text-yellow-400"
            )}>
              {tournament.status}
            </span>
          </p>
        </div>
      </div>

      {/* Top-level tab toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setAdminTab("results")}
          className={clsx(
            "px-5 py-2 rounded-lg font-display text-sm font-bold uppercase tracking-wide transition-colors",
            adminTab === "results"
              ? "bg-court-500 text-white"
              : "bg-hardwood-700 text-gray-400 hover:text-white hover:bg-hardwood-600"
          )}
        >
          Game Results
        </button>
        <button
          onClick={() => setAdminTab("add-bracket")}
          className={clsx(
            "px-5 py-2 rounded-lg font-display text-sm font-bold uppercase tracking-wide transition-colors",
            adminTab === "add-bracket"
              ? "bg-court-500 text-white"
              : "bg-hardwood-700 text-gray-400 hover:text-white hover:bg-hardwood-600"
          )}
        >
          Add Bracket
        </button>
      </div>

      {/* Tab content */}
      {adminTab === "results" ? (
        <GameResultsPanel games={games} teamsMap={teamsMap} />
      ) : (
        <AdminBracketBuilder games={games} teams={teamsMap} />
      )}
    </div>
  );
}

function GameResultsPanel({ games, teamsMap }: { games: Game[]; teamsMap: Map<string, Team> }) {
  const [localGames, setLocalGames] = useState<Game[]>(games);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [activeRound, setActiveRound] = useState<Round>("R64");

  const [resultInputs, setResultInputs] = useState<
    Record<string, { winnerId: string; score1: string; score2: string }>
  >({});

  async function triggerEspnSync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/espn/sync", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_ESPN_SYNC_SECRET ?? "dev-sync-secret"}` },
      });
      const data = await res.json();
      setSyncResult(`Checked ${data.checked} games -- Updated ${data.updated}`);
    } catch {
      setSyncResult("Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function saveResult(gameId: string) {
    const input = resultInputs[gameId];
    if (!input?.winnerId) return;

    setSavingId(gameId);
    try {
      const res = await fetch(`/api/games/${gameId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          winnerId: input.winnerId,
          score1: parseInt(input.score1) || 0,
          score2: parseInt(input.score2) || 0,
        }),
      });
      if (res.ok) {
        setLocalGames((prev) =>
          prev.map((g) =>
            g.gameId === gameId
              ? { ...g, winnerId: input.winnerId, status: "final",
                  score1: parseInt(input.score1) || 0,
                  score2: parseInt(input.score2) || 0 }
              : g
          )
        );
        setResultInputs((prev) => { const n = { ...prev }; delete n[gameId]; return n; });
      }
    } finally {
      setSavingId(null);
    }
  }

  const roundGames = localGames
    .filter((g) => g.round === activeRound)
    .sort((a, b) => a.bracketSlot - b.bracketSlot);

  return (
    <div className="space-y-6">
      {/* ESPN sync */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={triggerEspnSync}
          disabled={syncing}
          className="flex items-center gap-2 bg-hardwood-700 hover:bg-hardwood-600 border border-hardwood-500 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
        >
          <RefreshCwIcon className={clsx("w-4 h-4", syncing && "animate-spin")} />
          {syncing ? "Syncing ESPN..." : "Sync from ESPN"}
        </button>
        {syncResult && (
          <p className="text-xs font-mono text-gray-500">{syncResult}</p>
        )}
      </div>

      {/* Round tabs */}
      <div className="flex gap-1 border-b border-hardwood-600 overflow-x-auto">
        {ROUND_ORDER.map((round) => {
          const count = localGames.filter((g) => g.round === round).length;
          const done = localGames.filter((g) => g.round === round && g.status === "final").length;
          return (
            <button
              key={round}
              onClick={() => setActiveRound(round)}
              className={clsx(
                "flex-shrink-0 px-4 py-2.5 text-sm font-display font-bold uppercase tracking-wide transition-colors border-b-2 -mb-px whitespace-nowrap",
                activeRound === round
                  ? "text-court-400 border-court-500"
                  : "text-gray-500 border-transparent hover:text-gray-300"
              )}
            >
              {ROUND_LABELS[round]}
              {count > 0 && (
                <span className={clsx(
                  "ml-2 text-[10px] font-mono",
                  done === count ? "text-green-500" : "text-gray-600"
                )}>
                  {done}/{count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Games list */}
      <div className="space-y-3">
        {roundGames.length === 0 && (
          <p className="text-gray-600 font-mono text-sm py-8 text-center">
            No games in this round yet.
          </p>
        )}
        {roundGames.map((game) => {
          const team1 = game.team1Id ? teamsMap.get(game.team1Id) : null;
          const team2 = game.team2Id ? teamsMap.get(game.team2Id) : null;
          const input = resultInputs[game.gameId];
          const isFinal = game.status === "final";

          return (
            <div
              key={game.gameId}
              className={clsx(
                "bg-hardwood-800 border rounded-xl p-4",
                isFinal ? "border-green-900/50" : "border-hardwood-600"
              )}
            >
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="text-sm font-body">
                    <span className={clsx(
                      "font-display font-bold uppercase",
                      isFinal && game.winnerId === game.team1Id ? "text-green-400" : "text-white"
                    )}>
                      {team1 ? `#${team1.seed} ${team1.name}` : "TBD"}
                    </span>
                    <span className="text-gray-600 mx-2 font-mono">vs</span>
                    <span className={clsx(
                      "font-display font-bold uppercase",
                      isFinal && game.winnerId === game.team2Id ? "text-green-400" : "text-white"
                    )}>
                      {team2 ? `#${team2.seed} ${team2.name}` : "TBD"}
                    </span>
                  </div>
                  <span className="font-mono text-xs text-gray-600">
                    {game.region} · Slot {game.bracketSlot}
                  </span>
                </div>

                {isFinal ? (
                  <div className="flex items-center gap-2 text-green-400 text-sm font-mono">
                    <CheckCircleIcon className="w-4 h-4" />
                    Final: {game.score1} - {game.score2}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    <select
                      value={input?.winnerId ?? ""}
                      onChange={(e) =>
                        setResultInputs((prev) => ({
                          ...prev,
                          [game.gameId]: { ...prev[game.gameId], winnerId: e.target.value, score1: prev[game.gameId]?.score1 ?? "", score2: prev[game.gameId]?.score2 ?? "" },
                        }))
                      }
                      disabled={!team1 || !team2}
                      className="bg-hardwood-700 border border-hardwood-500 focus:border-court-500 rounded-lg px-3 py-1.5 text-white text-sm font-body outline-none"
                    >
                      <option value="">-- Winner --</option>
                      {team1 && <option value={team1.id}>{team1.name}</option>}
                      {team2 && <option value={team2.id}>{team2.name}</option>}
                    </select>

                    <input
                      type="number"
                      placeholder={team1?.shortName ?? "T1"}
                      value={input?.score1 ?? ""}
                      onChange={(e) =>
                        setResultInputs((prev) => ({
                          ...prev,
                          [game.gameId]: { ...prev[game.gameId] ?? { winnerId: "", score2: "" }, score1: e.target.value },
                        }))
                      }
                      className="w-20 bg-hardwood-700 border border-hardwood-500 rounded-lg px-2 py-1.5 text-white text-sm font-mono text-center outline-none focus:border-court-500"
                    />
                    <span className="text-gray-600 font-mono">-</span>
                    <input
                      type="number"
                      placeholder={team2?.shortName ?? "T2"}
                      value={input?.score2 ?? ""}
                      onChange={(e) =>
                        setResultInputs((prev) => ({
                          ...prev,
                          [game.gameId]: { ...prev[game.gameId] ?? { winnerId: "", score1: "" }, score2: e.target.value },
                        }))
                      }
                      className="w-20 bg-hardwood-700 border border-hardwood-500 rounded-lg px-2 py-1.5 text-white text-sm font-mono text-center outline-none focus:border-court-500"
                    />

                    <button
                      onClick={() => saveResult(game.gameId)}
                      disabled={!input?.winnerId || savingId === game.gameId}
                      className="bg-court-500 hover:bg-court-600 disabled:opacity-40 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors"
                    >
                      {savingId === game.gameId ? "Saving..." : "Save"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
