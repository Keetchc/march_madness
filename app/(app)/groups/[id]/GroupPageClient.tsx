"use client";
import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ROUNDS_IN_ORDER, type Bracket, type Group, type LeaderboardEntry } from "@/lib/types";
import Link from "next/link";
import { clsx } from "clsx";
import {
  PoolLeaderboardRow,
  PoolLeaderboardTableHeaders,
} from "@/components/leaderboard/PoolLeaderboardRow";
import { CopyIcon, CheckIcon, RefreshCwIcon, TrophyIcon, LinkIcon, SettingsIcon, GitCompareIcon, LayoutGridIcon } from "lucide-react";

interface GroupPageClientProps {
  group: Group;
  leaderboard: LeaderboardEntry[];
  currentUserId: string;
  isGroupAdmin: boolean;
  isAppAdmin: boolean;
  /** True when the signed-in user is a member but has not linked a bracket yet (e.g. group creator). */
  needsBracket: boolean;
  /** When true, hide other members' scores / bracket names until picks lock (you still see your row). */
  maskOpponentStandings: boolean;
  gamesCompletedCount: number;
  tournamentName?: string | null;
}

export function GroupPageClient({
  group,
  leaderboard,
  currentUserId,
  isGroupAdmin,
  isAppAdmin,
  needsBracket,
  maskOpponentStandings,
  gamesCompletedCount,
  tournamentName,
}: GroupPageClientProps) {
  const [inviteToken, setInviteToken] = useState(group.inviteToken);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  /** Relative path only — matches SSR so hydration never differs from using `window.location.origin` in the UI. */
  const invitePath = `/groups/join/${inviteToken}`;

  const canSeeEveryoneStats = !maskOpponentStandings || isGroupAdmin || isAppAdmin;

  const displayLeaderboard = useMemo(() => {
    if (canSeeEveryoneStats) return leaderboard;
    const copy = [...leaderboard].sort((a, b) =>
      a.userName.localeCompare(b.userName, undefined, { sensitivity: "base" })
    );
    return copy;
  }, [leaderboard, canSeeEveryoneStats]);

  async function copyInvite() {
    const absolute = `${window.location.origin}${invitePath}`;
    await navigator.clipboard.writeText(absolute);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function regenerateInvite() {
    setRegenerating(true);
    try {
      const res = await fetch(`/api/groups/${group.groupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regenerateInvite: true }),
      });
      const data = await res.json();
      if (data.inviteToken) setInviteToken(data.inviteToken);
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="font-mono text-xs text-court-500 uppercase tracking-widest mb-1">Group</p>
          <h1 className="font-display text-5xl font-black uppercase tracking-tight text-white">
            {group.name}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/groups/${group.groupId}/brackets`}
            className="flex items-center gap-2 bg-hardwood-700 hover:bg-hardwood-600 border border-hardwood-500 text-gray-300 text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            <LayoutGridIcon className="w-4 h-4" />
            All brackets
          </Link>
          <Link
            href={`/groups/${group.groupId}/compare`}
            className="flex items-center gap-2 bg-hardwood-700 hover:bg-hardwood-600 border border-hardwood-500 text-gray-300 text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            <GitCompareIcon className="w-4 h-4" />
            Compare
          </Link>
          {isGroupAdmin && (
            <Link
              href={`/groups/${group.groupId}/settings`}
              className="flex items-center gap-2 bg-hardwood-700 hover:bg-hardwood-600 border border-hardwood-500 text-gray-300 text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              <SettingsIcon className="w-4 h-4" />
              Settings
            </Link>
          )}
        </div>
      </div>

      {/* Invite link card */}
      <div className="bg-hardwood-800 border border-hardwood-600 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <LinkIcon className="w-4 h-4 text-court-500" />
          <h2 className="font-display font-bold uppercase tracking-wide text-sm text-white">
            Invite Link
          </h2>
        </div>
        <p className="text-xs text-gray-500 font-body mb-3">
          Share this link with friends. Anyone with it can join this group.
        </p>
        <div className="flex gap-2">
          <div className="flex-1 bg-hardwood-700 border border-hardwood-500 rounded-lg px-3 py-2 font-mono text-xs text-gray-400 truncate">
            {invitePath}
          </div>
          <button
            onClick={copyInvite}
            className="flex items-center gap-1.5 bg-court-500 hover:bg-court-600 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors flex-shrink-0"
          >
            {copied ? <CheckIcon className="w-3.5 h-3.5" /> : <CopyIcon className="w-3.5 h-3.5" />}
            {copied ? "Copied!" : "Copy"}
          </button>
          {isGroupAdmin && (
            <button
              onClick={regenerateInvite}
              disabled={regenerating}
              className="flex items-center gap-1.5 bg-hardwood-700 hover:bg-hardwood-600 border border-hardwood-500 text-gray-400 text-xs font-semibold px-3 py-2 rounded-lg transition-colors flex-shrink-0"
              title="Regenerate invite link (invalidates old one)"
            >
              <RefreshCwIcon className={clsx("w-3.5 h-3.5", regenerating && "animate-spin")} />
            </button>
          )}
        </div>
      </div>

      {needsBracket && <LinkYourBracketCard groupId={group.groupId} />}

      {/* Leaderboard */}
      <div>
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <TrophyIcon className="w-5 h-5 text-court-500" />
            <h2 className="font-display text-2xl sm:text-3xl font-bold uppercase tracking-wide text-white">
              Standings
            </h2>
          </div>
          <p className="font-mono text-xs text-court-500 uppercase tracking-widest">
            {tournamentName ?? "Tournament"}
          </p>
          <p className="text-gray-500 text-sm font-mono mt-1">
            {gamesCompletedCount} games complete — {leaderboard.length} brackets in this group
          </p>
        </div>

        {maskOpponentStandings && !canSeeEveryoneStats && (
          <p className="text-xs font-mono text-gray-500 mb-3 max-w-xl">
            Before the first game goes final, other members’ scores and bracket titles stay hidden so nobody scouts early
            entries. You always see your own row; once games start finishing, everyone’s standings match the pool.
          </p>
        )}

        {!maskOpponentStandings && leaderboard.length > 0 && gamesCompletedCount === 0 && (
          <p className="text-xs font-mono text-amber-600/90 mb-3 max-w-xl">
            Picks are locked, but there are no finished games in this pool yet — scores stay at 0 until games are
            marked final (e.g. ESPN sync / admin tools). Max points can still show from your remaining picks.
          </p>
        )}

        <div className="bg-hardwood-800 border border-hardwood-600 rounded-2xl overflow-hidden">
          {leaderboard.length > 0 && <PoolLeaderboardTableHeaders />}

          {leaderboard.length === 0 ? (
            <div className="p-12 text-center text-gray-600 font-body">
              No brackets submitted yet.
            </div>
          ) : (
            <div className="divide-y divide-hardwood-700">
              {displayLeaderboard.map((entry) => (
                <PoolLeaderboardRow
                  key={entry.bracketId}
                  entry={entry}
                  isCurrentUser={String(entry.userId) === String(currentUserId)}
                  maskStats={maskOpponentStandings && !canSeeEveryoneStats}
                  rankDisplay={entry.rank}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Scoring rules summary */}
      <div className="bg-hardwood-800 border border-hardwood-600 rounded-2xl p-5">
        <h2 className="font-display font-bold uppercase tracking-wide text-sm text-white mb-1">
          Scoring Rules
        </h2>
        <p className="text-xs font-mono text-gray-500 mb-3">
          Each correct pick: <span className="text-gray-400">base × team seed</span>
          {Object.values(group.scoringRules.rounds).some((r) => r.upsetMultiplier > 0) ? (
            <span className="text-gray-600">; upset rounds apply a multiplier when a worse seed wins</span>
          ) : null}
          {group.scoringRules.bonuses.correctChampion > 0 ? (
            <span className="text-gray-600">; champion bonus if set</span>
          ) : null}
          .
        </p>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {ROUNDS_IN_ORDER.map((round) => {
            const rule = group.scoringRules.rounds[round];
            return (
              <div key={round} className="text-center">
                <p className="font-mono text-xs text-gray-600 mb-1">{round}</p>
                <p className="font-display font-bold text-white text-lg">{rule.basePoints}</p>
                {rule.upsetMultiplier > 0 && (
                  <p className="font-mono text-[10px] text-court-500">+upset×{rule.upsetMultiplier}</p>
                )}
              </div>
            );
          })}
        </div>
        {group.scoringRules.bonuses.correctChampion > 0 && (
          <p className="text-xs font-mono text-gray-500 mt-3 pt-3 border-t border-hardwood-600">
            🏆 Champion bonus: +{group.scoringRules.bonuses.correctChampion} pts
          </p>
        )}
      </div>
    </div>
  );
}

function LinkYourBracketCard({ groupId }: { groupId: string }) {
  const router = useRouter();
  const [brackets, setBrackets] = useState<Bracket[]>([]);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/bracket")
      .then((r) => r.json())
      .then((d) => setBrackets(Array.isArray(d) ? d : []));
  }, []);

  async function link() {
    if (!selected) return;
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(`/api/groups/${groupId}/link-bracket`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bracketId: selected }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "Could not link bracket.");
        return;
      }
      router.refresh();
    } catch {
      setErr("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-court-500/10 border border-court-500/40 rounded-2xl p-5">
      <h2 className="font-display font-bold uppercase tracking-wide text-court-400 text-sm mb-2">
        Add your bracket
      </h2>
      <p className="text-xs text-gray-400 font-body mb-4 max-w-xl">
        You&apos;re in this group but no bracket is linked to your entry yet — group creators start here too.
        Pick an existing bracket or create one; you can also use the invite link flow (&quot;join now, add later&quot;)
        for the same options.
      </p>
      {brackets.length > 0 ? (
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="flex-1 min-w-0 bg-hardwood-700 border border-hardwood-500 focus:border-court-500 rounded-lg px-4 py-2.5 text-white font-body text-sm outline-none transition-colors"
          >
            <option value="">-- Choose a bracket --</option>
            {brackets.map((b) => (
              <option key={b.bracketId} value={b.bracketId}>
                {b.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={link}
            disabled={busy || !selected}
            className="shrink-0 bg-court-500 hover:bg-court-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-display font-bold uppercase text-xs tracking-wide px-4 py-2.5 rounded-lg transition-colors"
          >
            {busy ? "Linking..." : "Link to group"}
          </button>
        </div>
      ) : (
        <p className="text-sm text-gray-500 font-body mb-3">You don&apos;t have any brackets in this pool yet.</p>
      )}
      <Link
        href={`/bracket/new?returnTo=${encodeURIComponent(`/groups/${groupId}`)}`}
        className="inline-block mt-3 text-sm font-semibold text-court-400 hover:text-court-300 transition-colors"
      >
        Create a new bracket →
      </Link>
      {err ? <p className="text-red-400 text-xs font-mono mt-3">{err}</p> : null}
    </div>
  );
}
