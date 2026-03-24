"use client";
import { useState } from "react";
import { ROUND_DISPLAY_LABELS, type Group, type LeaderboardEntry } from "@/lib/types";
import Image from "next/image";
import Link from "next/link";
import { clsx } from "clsx";
import { CopyIcon, CheckIcon, RefreshCwIcon, TrophyIcon, LinkIcon, SettingsIcon } from "lucide-react";

interface GroupPageClientProps {
  group: Group;
  leaderboard: LeaderboardEntry[];
  currentUserId: string;
  isGroupAdmin: boolean;
}

export function GroupPageClient({ group, leaderboard, currentUserId, isGroupAdmin }: GroupPageClientProps) {
  const [inviteToken, setInviteToken] = useState(group.inviteToken);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const inviteUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/groups/join/${inviteToken}`;

  async function copyInvite() {
    await navigator.clipboard.writeText(inviteUrl);
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
            {inviteUrl}
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

      {/* Leaderboard */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <TrophyIcon className="w-5 h-5 text-court-500" />
          <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-white">
            Standings
          </h2>
        </div>

        <div className="bg-hardwood-800 border border-hardwood-600 rounded-2xl overflow-hidden">
          {leaderboard.length > 0 && (
            <>
              <div className="hidden md:grid grid-cols-[3rem_1fr_5rem_5rem_5rem] gap-4 px-6 py-3 border-b border-hardwood-600 bg-hardwood-700">
                <span className="font-mono text-xs text-gray-600 uppercase">#</span>
                <span className="font-mono text-xs text-gray-600 uppercase">Player</span>
                <span className="font-mono text-xs text-gray-600 uppercase text-right">Score</span>
                <span className="font-mono text-xs text-gray-600 uppercase text-right">Max</span>
                <span className="font-mono text-xs text-gray-600 uppercase text-right">Correct</span>
              </div>
              <div className="md:hidden px-4 py-2.5 border-b border-hardwood-600 bg-hardwood-700/80 grid grid-cols-3 gap-2 text-center">
                <span className="font-mono text-[10px] text-gray-600 uppercase tracking-wide">Score</span>
                <span className="font-mono text-[10px] text-gray-600 uppercase tracking-wide">Max</span>
                <span className="font-mono text-[10px] text-gray-600 uppercase tracking-wide">Correct</span>
              </div>
            </>
          )}

          {leaderboard.length === 0 ? (
            <div className="p-12 text-center text-gray-600 font-body">
              No brackets submitted yet.
            </div>
          ) : (
            <div className="divide-y divide-hardwood-700">
              {leaderboard.map((entry) => (
                <LeaderboardRow
                  key={entry.bracketId}
                  entry={entry}
                  isCurrentUser={entry.userId === currentUserId}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Scoring rules summary */}
      <div className="bg-hardwood-800 border border-hardwood-600 rounded-2xl p-5">
        <h2 className="font-display font-bold uppercase tracking-wide text-sm text-white mb-3">
          Scoring Rules
        </h2>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {(Object.entries(group.scoringRules.rounds) as [string, any][]).map(([round, rule]) => (
            <div key={round} className="text-center">
              <p className="font-mono text-xs text-gray-600 mb-1">{round}</p>
              <p className="font-display font-bold text-white text-lg">{rule.basePoints}</p>
              {rule.upsetMultiplier > 0 && (
                <p className="font-mono text-[10px] text-court-500">+upset×{rule.upsetMultiplier}</p>
              )}
            </div>
          ))}
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

function LeaderboardRow({ entry, isCurrentUser }: { entry: LeaderboardEntry; isCurrentUser: boolean }) {
  const medals: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

  return (
    <Link href={`/bracket/${entry.bracketId}`}>
      <div className={clsx(
        "flex flex-col gap-0 px-4 py-3 md:px-6 md:py-4 md:grid md:grid-cols-[3rem_1fr_5rem_5rem_5rem] md:gap-4 md:items-center",
        "hover:bg-hardwood-700 transition-colors cursor-pointer",
        isCurrentUser && "bg-court-500/5 hover:bg-court-500/10"
      )}>
        <div className="flex items-center gap-3 min-w-0 pb-3 md:contents md:pb-0">
          <span className="font-display text-lg md:text-xl font-black text-gray-400 w-8 shrink-0 text-center md:w-auto">
            {medals[entry.rank] ?? entry.rank}
          </span>

          <div className="flex items-center gap-3 min-w-0 flex-1 md:flex-initial md:min-w-0">
            {entry.userPicture ? (
              <Image src={entry.userPicture} alt={entry.userName} width={32} height={32} className="rounded-full flex-shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-hardwood-600 flex-shrink-0" />
            )}
            <div className="min-w-0">
              <p className={clsx(
                "font-display font-bold uppercase tracking-wide text-sm truncate",
                isCurrentUser ? "text-court-400" : "text-white"
              )}>
                {entry.userName}
                {isCurrentUser && <span className="ml-2 text-[10px] text-court-600 normal-case font-mono">you</span>}
              </p>
              <p className="text-xs text-gray-600 font-body truncate">{entry.bracketName}</p>
            </div>
          </div>
        </div>

        <div
          className={clsx(
            "grid grid-cols-3 gap-x-2 gap-y-1 text-center items-center md:contents",
            "border-t border-hardwood-600/90 pt-3 mt-0",
            "rounded-lg bg-hardwood-900/55 px-2 py-2.5 -mx-1 ring-1 ring-hardwood-600/40",
            "md:mx-0 md:mt-0 md:pt-0 md:px-0 md:py-0 md:rounded-none md:border-t-0 md:bg-transparent md:ring-0"
          )}
        >
          <div className="md:text-right">
            <span className="font-mono text-lg md:text-xl font-bold text-white tabular-nums">{entry.score}</span>
          </div>
          <div className="md:text-right">
            <span className="font-mono text-sm text-gray-500 tabular-nums">{entry.maxPossibleScore}</span>
          </div>
          <div className="md:text-right">
            <span className="font-mono text-sm text-gray-400 tabular-nums">{entry.correctPicks}/{entry.gamesDecidedCount}</span>
          </div>
        </div>

        {entry.criticalGames.length > 0 && entry.status !== "eliminated" && (
          <div className="md:col-start-2 md:col-span-4 mt-2 md:mt-1 px-0">
            <p className="font-mono text-[10px] md:text-xs uppercase tracking-widest text-court-500 mb-1.5">
              Most Important Remaining Games
            </p>
            <div className="flex flex-wrap gap-1.5">
              {entry.criticalGames.slice(0, 3).map((game) => (
                <span
                  key={game.gameId}
                  className={clsx(
                    "inline-flex items-center gap-1 rounded-full px-2 py-1 font-mono text-[10px] md:text-xs border",
                    game.isMustHave
                      ? "text-yellow-300 border-yellow-600/70 bg-yellow-900/25"
                      : "text-gray-300 border-hardwood-500 bg-hardwood-700/60"
                  )}
                >
                  <span>{game.teamName}</span>
                  <span className="text-gray-500">{game.round}</span>
                  <span className="text-white tabular-nums">+{game.potentialPoints}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {entry.nextSliceRound &&
          entry.nextSliceCriticalGames.length > 0 &&
          entry.status !== "eliminated" && (
          <div
            className={clsx(
              "md:col-start-2 md:col-span-4 md:mt-1 px-0",
              entry.criticalGames.length > 0 ? "mt-3" : "mt-2",
            )}
          >
            <p className="font-mono text-[10px] md:text-xs uppercase tracking-widest text-sky-400/90 mb-0.5">
              Next up — {ROUND_DISPLAY_LABELS[entry.nextSliceRound]}
            </p>
            <p className="text-[10px] text-gray-600 font-body mb-1.5 leading-snug">
              Pending games in this round where your pick differs from others in this group.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {entry.nextSliceCriticalGames.slice(0, 4).map((game) => (
                <span
                  key={`slice-${game.gameId}`}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-1 font-mono text-[10px] md:text-xs border text-sky-100 border-sky-700/60 bg-sky-950/35"
                  title={
                    game.rivalsAheadWithDifferentPick > 0
                      ? `${game.rivalsAheadWithDifferentPick} other bracket(s) picked the other team`
                      : undefined
                  }
                >
                  <span>{game.teamName}</span>
                  <span className="text-sky-600/90 tabular-nums">+{game.potentialPoints}</span>
                  {game.rivalsAheadWithDifferentPick > 0 ? (
                    <span className="text-sky-600/70 text-[9px] md:text-[10px]">
                      vs {game.rivalsAheadWithDifferentPick}
                    </span>
                  ) : null}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}

