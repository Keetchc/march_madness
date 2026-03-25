"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserAvatar } from "@/components/UserAvatar";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { clsx } from "clsx";
import { Menu, X } from "lucide-react";
import { LockCountdownBadge } from "@/components/layout/LockCountdownBadge";
import { SeasonSelector } from "@/components/layout/SeasonSelector";
import type { Tournament } from "@/lib/types";

const PUBLIC_LINKS = [
  { href: "/leaderboard", label: "Global Leaderboard" },
  { href: "/official-bracket", label: "Official Bracket" },
] as const;

const AUTH_PRIMARY_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/bracket", label: "My Brackets" },
  { href: "/groups", label: "Groups" },
] as const;

function isBracketAppActive(pathname: string): boolean {
  return pathname.startsWith("/bracket") && !pathname.startsWith("/brackets");
}

function linkActive(href: string, pathname: string): boolean {
  if (href === "/bracket") return isBracketAppActive(pathname);
  return pathname.startsWith(href);
}

export function SiteNavbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [tournamentLockPick, setTournamentLockPick] = useState<
    Pick<Tournament, "lockDate" | "picksOpenOverride"> | null
  >(null);
  const { data: session, status } = useSession();
  // Rely on status, not session.user — JWT/client hydration can briefly omit user while still authenticated.
  const authed = status === "authenticated";
  const user = session?.user;
  const isAdmin = Boolean((user as { isAdmin?: boolean } | undefined)?.isAdmin);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (status !== "authenticated") {
      setTournamentLockPick(null);
      return;
    }
    let cancelled = false;
    fetch("/api/tournament")
      .then((r) => r.json())
      .then((d: { tournament?: Tournament }) => {
        if (cancelled || !d?.tournament) return;
        const t = d.tournament;
        setTournamentLockPick({
          lockDate: t.lockDate,
          picksOpenOverride: t.picksOpenOverride,
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [status]);

  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  const homeHref = authed ? "/dashboard" : "/leaderboard";

  const linkClass = (active: boolean, extra?: string) =>
    clsx(
      "font-body text-xs sm:text-sm font-medium rounded-md transition-colors",
      extra,
      active ? "text-court-400 bg-hardwood-700" : "text-ink-200 hover:text-white hover:bg-hardwood-700"
    );

  return (
    <header className="relative bg-hardwood-800 border-b border-hardwood-600 sticky top-0 z-50">
      <div className="container mx-auto px-3 sm:px-5 md:px-6 lg:px-8 max-w-[min(100%,2000px)]">
        <div className="flex items-center justify-between h-11 gap-1.5 sm:gap-2 min-w-0">
          <Link href={homeHref} className="flex items-center gap-1 sm:gap-1.5 group min-w-0 shrink">
            <span className="text-lg sm:text-xl leading-none shrink-0">🏀</span>
            <span className="font-display text-sm sm:text-base font-black uppercase tracking-tight text-white group-hover:text-court-400 transition-colors truncate">
              Brian&apos;s<span className="text-court-500">Group</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-0.5 flex-shrink-0 flex-wrap justify-end ml-auto">
            {authed &&
              AUTH_PRIMARY_LINKS.map((link) => {
                const active = linkActive(link.href, pathname);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={linkClass(active, "px-2 py-1 whitespace-nowrap")}
                  >
                    {link.label}
                  </Link>
                );
              })}
            {PUBLIC_LINKS.map((link) => {
              const active = linkActive(link.href, pathname);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={linkClass(active, "px-2 py-1 whitespace-nowrap")}
                >
                  {link.label}
                </Link>
              );
            })}
            {authed && isAdmin && (
              <Link
                href="/admin"
                className={clsx(
                  "font-body text-xs sm:text-sm font-medium px-2 py-1 rounded-md transition-colors whitespace-nowrap",
                  pathname.startsWith("/admin")
                    ? "text-yellow-400 bg-hardwood-700"
                    : "text-yellow-500 hover:text-yellow-400 hover:bg-hardwood-700"
                )}
              >
                ⚡ Admin
              </Link>
            )}
            <SeasonSelector className="shrink-0" />
            {authed && (
              <LockCountdownBadge tournament={tournamentLockPick ?? undefined} variant="compact" className="hidden md:inline-flex ml-0.5" />
            )}
            {authed && user && (
              <UserAvatar
                src={user.image}
                name={user.name ?? "User"}
                width={28}
                height={28}
                className="ml-0.5 rounded-full ring-1 ring-hardwood-600 w-6 h-6 sm:w-7 sm:h-7"
              />
            )}
            {authed && (
              <span className="hidden xl:block text-xs text-ink-200 font-body max-w-[5rem] truncate ml-0.5">
                {user?.name?.split(" ")[0]}
              </span>
            )}
            {authed && (
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/leaderboard" })}
                className="font-mono text-[11px] text-ink-300 hover:text-ink-100 px-2 py-1 transition-colors whitespace-nowrap"
              >
                Sign out
              </button>
            )}
            {!authed && status !== "loading" && (
              <Link
                href="/login"
                className="font-body text-xs sm:text-sm font-medium px-2 py-1 rounded-md text-court-400 hover:text-court-300 hover:bg-hardwood-700 transition-colors whitespace-nowrap"
              >
                Log in
              </Link>
            )}
          </nav>

          <div className="flex items-center gap-1.5 md:hidden flex-shrink-0">
            {authed && (
              <LockCountdownBadge tournament={tournamentLockPick ?? undefined} variant="compact" />
            )}
            {authed && user && (
              <UserAvatar
                src={user.image}
                name={user.name ?? "User"}
                width={26}
                height={26}
                className="rounded-full ring-1 ring-hardwood-600 w-6 h-6"
              />
            )}
            <button
              type="button"
              aria-expanded={menuOpen}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              className="flex items-center justify-center w-9 h-9 rounded-md text-ink-100 hover:text-white hover:bg-hardwood-700 transition-colors -mr-0.5"
              onClick={() => setMenuOpen((o) => !o)}
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {menuOpen && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="md:hidden fixed inset-0 top-11 bg-black/50 z-40"
            onClick={() => setMenuOpen(false)}
          />
          <nav className="md:hidden absolute left-0 right-0 top-full border-b border-hardwood-600 bg-hardwood-800 shadow-xl z-50 flex flex-col py-2 px-2 gap-0.5 max-h-[calc(100dvh-2.75rem)] overflow-y-auto">
            <div className="px-3 py-2 border-b border-hardwood-700 mb-1">
              <SeasonSelector />
            </div>
            {authed &&
              AUTH_PRIMARY_LINKS.map((link) => {
                const active = linkActive(link.href, pathname);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={linkClass(active, "px-3 py-2")}
                  >
                    {link.label}
                  </Link>
                );
              })}
            {PUBLIC_LINKS.map((link) => {
              const active = linkActive(link.href, pathname);
              return (
                <Link key={link.href} href={link.href} className={linkClass(active, "px-3 py-2")}>
                  {link.label}
                </Link>
              );
            })}
            {authed && isAdmin && (
              <Link
                href="/admin"
                className={clsx(
                  "font-body text-sm font-medium px-3 py-2 rounded-md transition-colors",
                  pathname.startsWith("/admin")
                    ? "text-yellow-400 bg-hardwood-700"
                    : "text-yellow-500 hover:text-yellow-400 hover:bg-hardwood-700"
                )}
              >
                ⚡ Admin
              </Link>
            )}
            {authed && (
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/leaderboard" })}
                className="text-left font-mono text-xs text-ink-300 hover:text-ink-100 px-3 py-2 rounded-md hover:bg-hardwood-700 transition-colors"
              >
                Sign out
              </button>
            )}
            {!authed && status !== "loading" && (
              <Link href="/login" className={linkClass(false, "px-3 py-2 text-court-400")}>
                Log in
              </Link>
            )}
          </nav>
        </>
      )}
    </header>
  );
}
