"use client";
import { useState, useEffect } from "react";
import type { Game, Team, Tournament, Round } from "@/lib/types";
import { clsx } from "clsx";
import { RefreshCwIcon, CheckCircleIcon } from "lucide-react";
import { AdminBracketBuilder } from "@/components/admin/AdminBracketBuilder";
import { PicksLockPanel } from "@/components/admin/PicksLockPanel";

interface AdminPageClientProps {
  games: Game[];
  teams: Map<string, Team> | Team[];
  tournament: Tournament | null;
}

type AdminTab = "results" | "add-bracket" | "picks";

const ROUND_ORDER: Round[] = ["R64", "R32", "S16", "E8", "F4", "NCG"];
const ROUND_LABELS: Record<Round, string> = {
  R64: "First Round", R32: "Round of 32", S16: "Sweet 16",
  E8: "Elite Eight", F4: "Final Four", NCG: "Championship",
};

export function AdminPageClient({ games, teams: teamsInput, tournament: tournamentProp }: AdminPageClientProps) {
  const teamsMap: Map<string, Team> = teamsInput instanceof Map
    ? teamsInput
    : new Map((teamsInput as Team[]).map((t) => [t.id, t]));

  const [tournament, setTournament] = useState<Tournament | null>(tournamentProp);
  useEffect(() => {
    setTournament(tournamentProp);
  }, [tournamentProp]);

  const [adminTab, setAdminTab] = useState<AdminTab>("results");

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="font-mono text-xs text-yellow-500 uppercase tracking-widest mb-1">Admin</p>
          <h1 className="font-display text-5xl font-black uppercase tracking-tight text-white">
            {adminTab === "results"
              ? "Game Results"
              : adminTab === "add-bracket"
                ? "Add Bracket"
                : "Bracket picks"}
          </h1>
          <p className="text-ink-300 font-mono text-sm mt-1">
            {tournament ? (
              <>
                {tournament.name} · Status:{" "}
                <span
                  className={clsx(
                    tournament.status === "active"
                      ? "text-green-400"
                      : tournament.status === "complete"
                        ? "text-ink-200"
                        : "text-yellow-400"
                  )}
                >
                  {tournament.status}
                </span>
              </>
            ) : (
              <span className="text-amber-400">No tournament META in Dynamo — seed the tournament first.</span>
            )}
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
              : "bg-hardwood-700 text-ink-200 hover:text-white hover:bg-hardwood-600"
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
              : "bg-hardwood-700 text-ink-200 hover:text-white hover:bg-hardwood-600"
          )}
        >
          Add Bracket
        </button>
        <button
          onClick={() => setAdminTab("picks")}
          className={clsx(
            "px-5 py-2 rounded-lg font-display text-sm font-bold uppercase tracking-wide transition-colors",
            adminTab === "picks"
              ? "bg-court-500 text-white"
              : "bg-hardwood-700 text-ink-200 hover:text-white hover:bg-hardwood-600"
          )}
        >
          Bracket picks
        </button>
      </div>

      {/* Tab content */}
      {adminTab === "results" ? (
        <GameResultsPanel
          games={games}
          teamsMap={teamsMap}
          tournamentId={tournament?.tournamentId ?? games[0]?.tournamentId ?? ""}
        />
      ) : adminTab === "add-bracket" ? (
        <AdminBracketBuilder games={games} teams={teamsMap} />
      ) : tournament ? (
        <PicksLockPanel tournament={tournament} onSaved={setTournament} />
      ) : (
        <p className="text-ink-300 font-body">Seed a tournament record to configure picks.</p>
      )}
    </div>
  );
}

function GameResultsPanel({
  games,
  teamsMap,
  tournamentId,
}: {
  games: Game[];
  teamsMap: Map<string, Team>;
  tournamentId: string;
}) {
  const [localGames, setLocalGames] = useState<Game[]>(games);
  useEffect(() => {
    setLocalGames(games);
  }, [games]);
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
    const g = localGames.find((x) => x.gameId === gameId);
    const input = resultInputs[gameId];
    let winnerId = input?.winnerId ?? "";
    let score1Str = input?.score1 ?? "";
    let score2Str = input?.score2 ?? "";
    if (g?.status === "final") {
      if (!winnerId) winnerId = g.winnerId ?? "";
      if (score1Str === "" && g.score1 != null) score1Str = String(g.score1);
      if (score2Str === "" && g.score2 != null) score2Str = String(g.score2);
    }
    if (!winnerId) return;

    const score1 = parseInt(score1Str, 10);
    const score2 = parseInt(score2Str, 10);
    if (Number.isNaN(score1) || Number.isNaN(score2)) return;

    setSavingId(gameId);
    try {
      const res = await fetch(`/api/games/${gameId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          winnerId,
          score1,
          score2,
          tournamentId: tournamentId || undefined,
        }),
      });
      if (res.ok) {
        setLocalGames((prev) =>
          prev.map((game) =>
            game.gameId === gameId
              ? {
                  ...game,
                  winnerId,
                  status: "final",
                  score1,
                  score2,
                }
              : game
          )
        );
        setResultInputs((prev) => {
          const n = { ...prev };
          delete n[gameId];
          return n;
        });
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
          <p className="text-xs font-mono text-ink-300">{syncResult}</p>
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
                  : "text-ink-300 border-transparent hover:text-ink-100"
              )}
            >
              {ROUND_LABELS[round]}
              {count > 0 && (
                <span className={clsx(
                  "ml-2 text-[10px] font-mono",
                  done === count ? "text-green-500" : "text-ink-400"
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
          <p className="text-ink-400 font-mono text-sm py-8 text-center">
            No games in this round yet.
          </p>
        )}
        {roundGames.map((game) => {
          const team1 = game.team1Id ? teamsMap.get(game.team1Id) : null;
          const team2 = game.team2Id ? teamsMap.get(game.team2Id) : null;
          const input = resultInputs[game.gameId];
          const isFinal = game.status === "final";

          const winnerSelectValue =
            input?.winnerId ?? (isFinal ? game.winnerId ?? "" : "");
          const score1InputValue =
            input?.score1 !== undefined && input.score1 !== ""
              ? input.score1
              : isFinal && game.score1 != null
                ? String(game.score1)
                : "";
          const score2InputValue =
            input?.score2 !== undefined && input.score2 !== ""
              ? input.score2
              : isFinal && game.score2 != null
                ? String(game.score2)
                : "";

          const canSave =
            !!winnerSelectValue &&
            score1InputValue !== "" &&
            score2InputValue !== "" &&
            !Number.isNaN(parseInt(score1InputValue, 10)) &&
            !Number.isNaN(parseInt(score2InputValue, 10));

          return (
            <div
              key={game.gameId}
              className={clsx(
                "bg-hardwood-800 border rounded-xl p-4",
                isFinal ? "border-green-900/50" : "border-hardwood-600"
              )}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="text-sm font-body">
                    <span className={clsx(
                      "font-display font-bold uppercase",
                      isFinal && game.winnerId === game.team1Id ? "text-green-400" : "text-white"
                    )}>
                      {team1 ? `#${team1.seed} ${team1.name}` : "TBD"}
                    </span>
                    <span className="text-ink-400 mx-2 font-mono">vs</span>
                    <span className={clsx(
                      "font-display font-bold uppercase",
                      isFinal && game.winnerId === game.team2Id ? "text-green-400" : "text-white"
                    )}>
                      {team2 ? `#${team2.seed} ${team2.name}` : "TBD"}
                    </span>
                  </div>
                  <span className="font-mono text-xs text-ink-400">
                    {game.region} · Slot {game.bracketSlot}
                  </span>
                  {isFinal && (
                    <span className="inline-flex items-center gap-1 text-green-400 text-xs font-mono">
                      <CheckCircleIcon className="w-3.5 h-3.5" />
                      Final
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={winnerSelectValue}
                    onChange={(e) =>
                      setResultInputs((prev) => ({
                        ...prev,
                        [game.gameId]: {
                          winnerId: e.target.value,
                          score1: prev[game.gameId]?.score1 ?? score1InputValue,
                          score2: prev[game.gameId]?.score2 ?? score2InputValue,
                        },
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
                    value={score1InputValue}
                    onChange={(e) =>
                      setResultInputs((prev) => ({
                        ...prev,
                        [game.gameId]: {
                          winnerId: prev[game.gameId]?.winnerId ?? winnerSelectValue,
                          score1: e.target.value,
                          score2: prev[game.gameId]?.score2 ?? score2InputValue,
                        },
                      }))
                    }
                    className="w-20 bg-hardwood-700 border border-hardwood-500 rounded-lg px-2 py-1.5 text-white text-sm font-mono text-center outline-none focus:border-court-500"
                  />
                  <span className="text-ink-400 font-mono">-</span>
                  <input
                    type="number"
                    placeholder={team2?.shortName ?? "T2"}
                    value={score2InputValue}
                    onChange={(e) =>
                      setResultInputs((prev) => ({
                        ...prev,
                        [game.gameId]: {
                          winnerId: prev[game.gameId]?.winnerId ?? winnerSelectValue,
                          score1: prev[game.gameId]?.score1 ?? score1InputValue,
                          score2: e.target.value,
                        },
                      }))
                    }
                    className="w-20 bg-hardwood-700 border border-hardwood-500 rounded-lg px-2 py-1.5 text-white text-sm font-mono text-center outline-none focus:border-court-500"
                  />

                  <button
                    onClick={() => saveResult(game.gameId)}
                    disabled={!canSave || savingId === game.gameId}
                    className="bg-court-500 hover:bg-court-600 disabled:opacity-40 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors"
                  >
                    {savingId === game.gameId
                      ? "Saving..."
                      : isFinal
                        ? "Update"
                        : "Save"}
                  </button>
                </div>
              </div>
              {isFinal && (
                <p className="mt-2 text-[11px] font-mono text-amber-500/90">
                  Tip: change only scores to fix a typo. Changing the winner updates the next round slot; fix later games if they were based on the wrong winner.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
