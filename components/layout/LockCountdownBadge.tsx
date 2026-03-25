"use client";

import { useEffect, useState } from "react";
import type { Tournament } from "@/lib/types";
import { picksEffectivelyClosed } from "@/lib/picks-lock";
import { clsx } from "clsx";
import { TimerIcon } from "lucide-react";

function formatRemaining(ms: number): string | null {
  if (ms <= 0) return null;
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${Math.max(1, m)}m`;
}

type Props = {
  tournament: Pick<Tournament, "lockDate" | "picksOpenOverride"> | null | undefined;
  className?: string;
  /** Navbar uses compact; group/bracket can use default */
  variant?: "compact" | "default";
};

/**
 * Live countdown until picks lock. Hidden when there is no lock date or picks are already closed.
 */
export function LockCountdownBadge({ tournament, className, variant = "compact" }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!tournament?.lockDate || picksEffectivelyClosed(tournament)) return;
    const tick = () => setNow(Date.now());
    const i = setInterval(tick, 60_000);
    return () => clearInterval(i);
  }, [tournament]);

  if (!tournament?.lockDate || picksEffectivelyClosed(tournament)) return null;

  const lockMs = new Date(tournament.lockDate).getTime();
  const remaining = formatRemaining(lockMs - now);
  const title = `Picks lock ${new Date(tournament.lockDate).toLocaleString()}`;

  if (!remaining) {
    return (
      <span
        className={clsx(
          "inline-flex items-center gap-1 font-mono text-amber-300 border border-amber-700/55 bg-amber-950/35 rounded-lg",
          variant === "compact" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-1",
          className
        )}
        title={title}
      >
        <TimerIcon className="w-3 h-3 shrink-0" />
        Locking…
      </span>
    );
  }

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 font-mono text-amber-300 border border-amber-700/55 bg-amber-950/35 rounded-lg whitespace-nowrap",
        variant === "compact" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-1",
        className
      )}
      title={title}
    >
      <TimerIcon className="w-3 h-3 shrink-0" />
      Locks in {remaining}
    </span>
  );
}
