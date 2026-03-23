"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { clsx } from "clsx";
import { Menu, X } from "lucide-react";
import { signOut, useSession } from "next-auth/react";

const NAV_LINKS = [
  { href: "/leaderboard",       label: "Leaderboard" },
  { href: "/compare",           label: "Compare" },
  { href: "/brackets",          label: "All Brackets" },
  { href: "/official-bracket",  label: "Official Bracket" },
  { href: "/rules",             label: "Rules" },
];

/** `/bracket` must not match `/brackets` (public directory of all brackets). */
function isBracketAppActive(pathname: string): boolean {
  return pathname.startsWith("/bracket") && !pathname.startsWith("/brackets");
}

function linkActive(href: string, pathname: string): boolean {
  if (href === "/bracket") return isBracketAppActive(pathname);
  return pathname.startsWith(href);
}

export function PublicNavbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const { data: session, status } = useSession();
  const authed = status === "authenticated" && session?.user;

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  return (
    <header className="relative bg-hardwood-800 border-b border-hardwood-600 sticky top-0 z-50">
      <div className="container mx-auto px-4 sm:px-6 md:px-8 lg:px-10 max-w-[2000px]">
        <div className="flex items-center justify-between gap-3 h-14 min-w-0">
          <Link href="/leaderboard" className="flex items-center gap-2 group min-w-0 shrink">
            <span className="font-display text-lg sm:text-xl font-black uppercase tracking-tight text-white group-hover:text-court-400 transition-colors truncate">
              Brian's<span className="text-court-500">Group</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1 flex-shrink-0">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={clsx(
                  "font-body text-sm font-medium px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap",
                  linkActive(link.href, pathname)
                    ? "text-court-400 bg-hardwood-700"
                    : "text-gray-400 hover:text-white hover:bg-hardwood-700"
                )}
              >
                {link.label}
              </Link>
            ))}
            {authed && (
              <>
                <Link
                  href="/dashboard"
                  className={clsx(
                    "font-body text-sm font-medium px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap",
                    pathname.startsWith("/dashboard")
                      ? "text-court-400 bg-hardwood-700"
                      : "text-gray-400 hover:text-white hover:bg-hardwood-700"
                  )}
                >
                  Dashboard
                </Link>
                <Link
                  href="/bracket"
                  className={clsx(
                    "font-body text-sm font-medium px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap",
                    isBracketAppActive(pathname)
                      ? "text-court-400 bg-hardwood-700"
                      : "text-gray-400 hover:text-white hover:bg-hardwood-700"
                  )}
                >
                  My Brackets
                </Link>
                <Link
                  href="/groups"
                  className={clsx(
                    "font-body text-sm font-medium px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap",
                    pathname.startsWith("/groups")
                      ? "text-court-400 bg-hardwood-700"
                      : "text-gray-400 hover:text-white hover:bg-hardwood-700"
                  )}
                >
                  Groups
                </Link>
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: "/leaderboard" })}
                  className="font-mono text-xs text-gray-500 hover:text-gray-300 px-3 py-1.5 transition-colors"
                >
                  Sign out
                </button>
              </>
            )}
            {!authed && status !== "loading" && (
              <Link
                href="/login"
                className="font-body text-sm font-medium px-3 py-1.5 rounded-lg text-court-400 hover:text-court-300 hover:bg-hardwood-700 transition-colors whitespace-nowrap"
              >
                Log in
              </Link>
            )}
          </nav>

          <button
            type="button"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            className="md:hidden flex items-center justify-center w-10 h-10 rounded-lg text-gray-300 hover:text-white hover:bg-hardwood-700 transition-colors flex-shrink-0"
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="md:hidden fixed inset-0 top-14 bg-black/50 z-40"
            onClick={() => setMenuOpen(false)}
          />
          <nav className="md:hidden absolute left-0 right-0 top-full border-b border-hardwood-600 bg-hardwood-800 shadow-xl z-50 flex flex-col p-3 gap-1 animate-fade-in">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={clsx(
                  "font-body text-sm font-medium px-4 py-3 rounded-lg transition-colors",
                  linkActive(link.href, pathname)
                    ? "text-court-400 bg-hardwood-700"
                    : "text-gray-400 hover:text-white hover:bg-hardwood-700"
                )}
              >
                {link.label}
              </Link>
            ))}
            {authed && (
              <>
                <Link
                  href="/dashboard"
                  className={clsx(
                    "font-body text-sm font-medium px-4 py-3 rounded-lg transition-colors",
                    pathname.startsWith("/dashboard")
                      ? "text-court-400 bg-hardwood-700"
                      : "text-gray-400 hover:text-white hover:bg-hardwood-700"
                  )}
                >
                  Dashboard
                </Link>
                <Link
                  href="/bracket"
                  className={clsx(
                    "font-body text-sm font-medium px-4 py-3 rounded-lg transition-colors",
                    isBracketAppActive(pathname)
                      ? "text-court-400 bg-hardwood-700"
                      : "text-gray-400 hover:text-white hover:bg-hardwood-700"
                  )}
                >
                  My Brackets
                </Link>
                <Link
                  href="/groups"
                  className={clsx(
                    "font-body text-sm font-medium px-4 py-3 rounded-lg transition-colors",
                    pathname.startsWith("/groups")
                      ? "text-court-400 bg-hardwood-700"
                      : "text-gray-400 hover:text-white hover:bg-hardwood-700"
                  )}
                >
                  Groups
                </Link>
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: "/leaderboard" })}
                  className="text-left font-mono text-sm text-gray-500 hover:text-gray-300 px-4 py-3 rounded-lg hover:bg-hardwood-700 transition-colors"
                >
                  Sign out
                </button>
              </>
            )}
            {!authed && status !== "loading" && (
              <Link
                href="/login"
                className="font-body text-sm font-medium px-4 py-3 rounded-lg text-court-400 hover:bg-hardwood-700 transition-colors"
              >
                Log in
              </Link>
            )}
          </nav>
        </>
      )}
    </header>
  );
}
