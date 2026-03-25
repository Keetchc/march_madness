"use client";
import { useState, useMemo, useCallback, useEffect } from "react";
import type { Game, Team, Round, Picks, Region } from "@/lib/types";
import { clsx } from "clsx";

interface AdminBracketBuilderProps {
  games: Game[];
  teams: Map<string, Team>;
}

interface BracketSummary {
  bracketId: string;
  userId: string;
  name: string;
  userName: string;
  pickCount: number;
}

const ROUND_ORDER: Round[] = ["R64", "R32", "S16", "E8", "F4", "NCG"];
const ROUND_LABELS: Record<Round, string> = {
  R64: "First Round",
  R32: "Round of 32",
  S16: "Sweet 16",
  E8: "Elite Eight",
  F4: "Final Four",
  NCG: "Championship",
};

const REGION_ORDER: Region[] = ["East", "South", "West", "Midwest", "FinalFour"];
const REGION_LABELS: Record<Region, string> = {
  East: "East",
  South: "South",
  West: "West",
  Midwest: "Midwest",
  FinalFour: "Final Four",
};

export function AdminBracketBuilder({ games: rawGames, teams }: AdminBracketBuilderProps) {
  const [mode, setMode] = useState<"new" | "edit">("new");
  const [existingBrackets, setExistingBrackets] = useState<BracketSummary[]>([]);
  const [editingBracketId, setEditingBracketId] = useState<string | null>(null);
  const [loadingBrackets, setLoadingBrackets] = useState(false);
  const [loadingPicks, setLoadingPicks] = useState(false);

  const [name, setName] = useState("");
  const [picks, setPicks] = useState<Picks>({});
  const [activeRound, setActiveRound] = useState<Round>("R64");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    setLoadingBrackets(true);
    fetch("/api/admin/bracket")
      .then((r) => r.json())
      .then((data) => setExistingBrackets(data))
      .catch(() => {})
      .finally(() => setLoadingBrackets(false));
  }, []);

  async function loadBracket(bracketId: string) {
    setLoadingPicks(true);
    setResult(null);
    try {
      const res = await fetch(`/api/admin/bracket/${bracketId}`);
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setPicks(data.picks ?? {});
      setName(data.name?.replace(/'s Bracket$/, "") ?? "");
      setEditingBracketId(bracketId);
      setMode("edit");
      setActiveRound("R64");
    } catch {
      setResult({ ok: false, message: "Failed to load bracket" });
    } finally {
      setLoadingPicks(false);
    }
  }

  function startNew() {
    setMode("new");
    setEditingBracketId(null);
    setName("");
    setPicks({});
    setActiveRound("R64");
    setResult(null);
  }

  const gameMap = useMemo(
    () => new Map(rawGames.map((g) => [g.gameId, g])),
    [rawGames],
  );

  const buildProjectedTeams = useCallback(
    (currentPicks: Picks): Map<string, { team1Id: string | null; team2Id: string | null }> => {
      const projected = new Map<string, { team1Id: string | null; team2Id: string | null }>();
      for (const g of rawGames) {
        projected.set(g.gameId, { team1Id: g.team1Id, team2Id: g.team2Id });
      }

      for (const round of ROUND_ORDER) {
        for (const g of rawGames) {
          if (g.round !== round || !g.nextGameId) continue;
          const picked = currentPicks[g.gameId];
          if (!picked) continue;

          const next = projected.get(g.nextGameId);
          if (!next) continue;

          if (g.nextGameSlot === 1) {
            next.team1Id = picked;
          } else if (g.nextGameSlot === 2) {
            next.team2Id = picked;
          }
        }
      }
      return projected;
    },
    [rawGames],
  );

  const projectedTeams = useMemo(() => buildProjectedTeams(picks), [buildProjectedTeams, picks]);

  const handlePick = useCallback(
    (gameId: string, teamId: string) => {
      setPicks((prev) => {
        const next = { ...prev };
        const oldPick = next[gameId];

        if (oldPick === teamId) return prev;

        next[gameId] = teamId;

        if (oldPick && oldPick !== teamId) {
          const toClear = new Set<string>();
          const queue = [oldPick];

          while (queue.length > 0) {
            const removedTeam = queue.shift()!;
            for (const g of rawGames) {
              if (next[g.gameId] === removedTeam && g.gameId !== gameId) {
                const proj = buildProjectedTeams(next);
                const thisProj = proj.get(g.gameId);
                if (thisProj && thisProj.team1Id !== removedTeam && thisProj.team2Id !== removedTeam) {
                  toClear.add(g.gameId);
                  queue.push(removedTeam);
                }
              }
            }
          }

          Array.from(toClear).forEach((clearId) => {
            delete next[clearId];
          });
        }

        return next;
      });
    },
    [rawGames, buildProjectedTeams],
  );

  const totalGames = rawGames.length;
  const pickedCount = Object.keys(picks).length;

  const roundGames = useMemo(() => {
    const filtered = rawGames.filter((g) => g.round === activeRound);

    if (activeRound === "F4" || activeRound === "NCG") {
      return filtered.sort((a, b) => a.bracketSlot - b.bracketSlot);
    }

    const grouped: Record<string, Game[]> = {};
    for (const g of filtered) {
      const region = g.region;
      if (!grouped[region]) grouped[region] = [];
      grouped[region].push(g);
    }
    for (const region of Object.keys(grouped)) {
      grouped[region].sort((a, b) => a.bracketSlot - b.bracketSlot);
    }

    const result: Game[] = [];
    for (const region of REGION_ORDER) {
      if (grouped[region]) result.push(...grouped[region]);
    }
    return result;
  }, [rawGames, activeRound]);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    setResult(null);

    try {
      if (mode === "edit" && editingBracketId) {
        const res = await fetch(`/api/admin/bracket/${editingBracketId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ picks }),
        });
        if (res.ok) {
          setResult({ ok: true, message: `Updated bracket (${pickedCount} picks)` });
          setExistingBrackets((prev) =>
            prev.map((b) => b.bracketId === editingBracketId ? { ...b, pickCount: pickedCount } : b)
          );
        } else {
          const data = await res.json();
          setResult({ ok: false, message: data.error ?? "Update failed" });
        }
      } else {
        const res = await fetch("/api/admin/bracket", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), picks }),
        });
        const data = await res.json();

        if (res.ok) {
          setResult({ ok: true, message: `Created ${data.bracket.name} (${pickedCount} picks)` });
          setExistingBrackets((prev) => [
            ...prev,
            { bracketId: data.bracket.bracketId, userId: data.user.userId, name: data.bracket.name, userName: data.user.name, pickCount: pickedCount },
          ]);
          setName("");
          setPicks({});
        } else {
          setResult({ ok: false, message: data.error ?? "Save failed" });
        }
      }
    } catch {
      setResult({ ok: false, message: "Network error" });
    } finally {
      setSaving(false);
    }
  }

  let currentRegion: string | null = null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Bracket selector */}
      <div className="bg-hardwood-800 border border-hardwood-600 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-3">
          <button
            onClick={startNew}
            className={clsx(
              "px-4 py-2 rounded-lg font-display text-xs font-bold uppercase tracking-wide transition-colors",
              mode === "new"
                ? "bg-court-500 text-white"
                : "bg-hardwood-700 text-ink-200 hover:text-white hover:bg-hardwood-600"
            )}
          >
            New Bracket
          </button>
          <span className="text-ink-400 font-mono text-xs">or edit existing:</span>
        </div>

        {loadingBrackets ? (
          <p className="font-mono text-xs text-ink-400 animate-pulse">Loading brackets...</p>
        ) : existingBrackets.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {existingBrackets.map((b) => (
              <button
                key={b.bracketId}
                onClick={() => loadBracket(b.bracketId)}
                disabled={loadingPicks}
                className={clsx(
                  "px-3 py-1.5 rounded-lg text-xs font-body transition-colors border",
                  editingBracketId === b.bracketId
                    ? "bg-court-500/20 border-court-500 text-court-400"
                    : "bg-hardwood-700 border-hardwood-500 text-ink-100 hover:border-court-600 hover:text-white"
                )}
              >
                {b.userName}
                <span className="ml-1.5 font-mono text-ink-300">{b.pickCount} picks</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="font-mono text-xs text-ink-400">No existing brackets.</p>
        )}
      </div>

      {loadingPicks && (
        <p className="font-mono text-sm text-ink-200 animate-pulse">Loading bracket picks...</p>
      )}

      {/* Name input (only for new) */}
      {mode === "new" && (
        <div className="bg-hardwood-800 border border-hardwood-600 rounded-xl p-4">
          <label className="block font-display text-sm font-bold uppercase tracking-wide text-ink-200 mb-2">
            Person's Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Brian Dastrup"
            className="w-full max-w-sm bg-hardwood-700 border border-hardwood-500 rounded-lg px-4 py-2.5 text-white font-body text-sm outline-none focus:border-court-500 placeholder:text-ink-400"
          />
        </div>
      )}

      {mode === "edit" && editingBracketId && (
        <div className="bg-hardwood-800 border border-court-900/40 rounded-xl p-4">
          <p className="font-display text-sm font-bold uppercase tracking-wide text-court-400">
            Editing: {name}
          </p>
          <p className="font-mono text-xs text-ink-300 mt-1">
            Bracket ID: {editingBracketId}
          </p>
        </div>
      )}

      {/* Progress + Save */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm text-ink-200">
            {pickedCount}/{totalGames} picks
          </span>
          <div className="w-48 h-2 bg-hardwood-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-court-500 rounded-full transition-all duration-300"
              style={{ width: `${totalGames > 0 ? (pickedCount / totalGames) * 100 : 0}%` }}
            />
          </div>
          {pickedCount === totalGames && (
            <span className="font-mono text-xs text-green-400">Complete</span>
          )}
        </div>

        <button
          onClick={handleSave}
          disabled={saving || (mode === "new" && !name.trim()) || pickedCount === 0}
          className="bg-court-500 hover:bg-court-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-6 py-2.5 rounded-lg transition-colors text-sm"
        >
          {saving ? "Saving..." : mode === "edit" ? "Update Bracket" : "Save Bracket"}
        </button>
      </div>

      {result && (
        <div className={clsx(
          "px-4 py-3 rounded-lg font-mono text-sm",
          result.ok ? "bg-green-950/50 text-green-400 border border-green-900/50" : "bg-red-950/50 text-red-400 border border-red-900/50"
        )}>
          {result.message}
        </div>
      )}

      {/* Round tabs */}
      <div className="flex gap-1 border-b border-hardwood-600 overflow-x-auto">
        {ROUND_ORDER.map((round) => {
          const count = rawGames.filter((g) => g.round === round).length;
          const done = rawGames.filter((g) => g.round === round && picks[g.gameId]).length;
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
              <span className={clsx(
                "ml-2 text-[10px] font-mono",
                done === count && count > 0 ? "text-green-500" : "text-ink-400"
              )}>
                {done}/{count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Games for active round */}
      <div className="space-y-2">
        {roundGames.map((game) => {
          const proj = projectedTeams.get(game.gameId);
          const t1Id = proj?.team1Id ?? game.team1Id;
          const t2Id = proj?.team2Id ?? game.team2Id;
          const team1 = t1Id ? teams.get(t1Id) : null;
          const team2 = t2Id ? teams.get(t2Id) : null;
          const currentPick = picks[game.gameId];
          const bothTeamsKnown = !!t1Id && !!t2Id;

          let regionHeader: React.ReactNode = null;
          if (activeRound !== "F4" && activeRound !== "NCG" && game.region !== currentRegion) {
            currentRegion = game.region;
            regionHeader = (
              <div className="pt-4 pb-1 first:pt-0">
                <p className="font-display text-xs font-bold uppercase tracking-widest text-court-600">
                  {REGION_LABELS[game.region as Region] ?? game.region}
                </p>
              </div>
            );
          }

          return (
            <div key={game.gameId}>
              {regionHeader}
              <div className={clsx(
                "bg-hardwood-800 border rounded-xl p-3 transition-colors",
                currentPick ? "border-green-900/40" : "border-hardwood-600",
              )}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-mono text-[10px] text-ink-400 uppercase">
                    {game.gameId}
                  </span>
                  {currentPick && (
                    <span className="font-mono text-[10px] text-green-500">picked</span>
                  )}
                </div>

                <div className="flex gap-2">
                  <TeamButton
                    team={team1}
                    teamId={t1Id}
                    isPicked={currentPick === t1Id}
                    disabled={!bothTeamsKnown}
                    onClick={() => t1Id && handlePick(game.gameId, t1Id)}
                  />
                  <span className="text-ink-400 font-mono text-xs self-center px-1">vs</span>
                  <TeamButton
                    team={team2}
                    teamId={t2Id}
                    isPicked={currentPick === t2Id}
                    disabled={!bothTeamsKnown}
                    onClick={() => t2Id && handlePick(game.gameId, t2Id)}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TeamButton({
  team,
  teamId,
  isPicked,
  disabled,
  onClick,
}: {
  team: Team | null | undefined;
  teamId: string | null;
  isPicked: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "flex-1 flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-all text-left",
        isPicked
          ? "bg-court-500/20 border-court-500 text-white"
          : disabled
            ? "bg-hardwood-700/50 border-hardwood-700 text-ink-400 cursor-not-allowed"
            : "bg-hardwood-700 border-hardwood-500 text-ink-100 hover:border-court-600 hover:text-white cursor-pointer",
      )}
    >
      {team ? (
        <>
          <span className={clsx(
            "font-mono text-xs flex-shrink-0",
            isPicked ? "text-court-400" : "text-ink-300",
          )}>
            {team.seed}
          </span>
          <span className="font-display font-bold uppercase tracking-wide text-sm truncate">
            {team.name}
          </span>
          {isPicked && (
            <span className="ml-auto font-mono text-xs text-court-400 flex-shrink-0">
              picked
            </span>
          )}
        </>
      ) : (
        <span className="font-mono text-xs text-ink-400 italic">
          {teamId ? teamId : "TBD -- pick earlier rounds first"}
        </span>
      )}
    </button>
  );
}
