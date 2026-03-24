"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { clsx } from "clsx";
import { Menu, X } from "lucide-react";

const PUBLIC_LINKS = [
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/official-bracket", label: "Official Bracket" },
  { href: "/rules", label: "Rules" },
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
  const { data: session, status } = useSession();
  const authed = status === "authenticated" && session?.user;
  const user = session?.user;
  const isAdmin = Boolean((user as { isAdmin?: boolean } | undefined)?.isAdmin);

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

  const homeHref = authed ? "/dashboard" : "/leaderboard";

  const linkClass = (active: boolean, extra?: string) =>
    clsx(
      "font-body text-sm font-medium rounded-lg transition-colors",
      extra,
      active ? "text-court-400 bg-hardwood-700" : "text-gray-400 hover:text-white hover:bg-hardwood-700"
    );

  return (
    <header className="relative bg-hardwood-800 border-b border-hardwood-600 sticky top-0 z-50">
      <div className="container mx-auto px-4 sm:px-6 md:px-8 lg:px-10 max-w-[min(100%,2000px)]">
        <div className="flex items-center justify-between h-14 gap-2 min-w-0">
          <Link href={homeHref} className="flex items-center gap-1.5 sm:gap-2 group min-w-0 shrink">
            <span className="text-xl sm:text-2xl shrink-0">🏀</span>
            <span className="font-display text-base sm:text-xl font-black uppercase tracking-tight text-white group-hover:text-court-400 transition-colors truncate">
              Brian&apos;s<span className="text-court-500">Group</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1 flex-shrink-0 flex-wrap justify-end">
            {authed &&
              AUTH_PRIMARY_LINKS.map((link) => {
                const active = linkActive(link.href, pathname);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={linkClass(active, "px-3 py-1.5 whitespace-nowrap")}
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
                  className={linkClass(active, "px-3 py-1.5 whitespace-nowrap")}
                >
                  {link.label}
                </Link>
              );
            })}
            {authed && isAdmin && (
              <Link
                href="/admin"
                className={clsx(
                  "font-body text-sm font-medium px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap",
                  pathname.startsWith("/admin")
                    ? "text-yellow-400 bg-hardwood-700"
                    : "text-yellow-500 hover:text-yellow-400 hover:bg-hardwood-700"
                )}
              >
                ⚡ Admin
              </Link>
            )}
            {authed && user?.image && (
              <Image
                src={user.image}
                alt={user.name ?? ""}
                width={32}
                height={32}
                className="rounded-full ring-2 ring-hardwood-600 w-7 h-7 sm:w-8 sm:h-8 ml-1"
              />
            )}
            {authed && (
              <span className="hidden lg:block text-sm text-gray-400 font-body max-w-[6rem] truncate ml-1">
                {user?.name?.split(" ")[0]}
              </span>
            )}
            {authed && (
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/leaderboard" })}
                className="font-mono text-xs text-gray-500 hover:text-gray-300 px-3 py-1.5 transition-colors whitespace-nowrap"
              >
                Sign out
              </button>
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

          <div className="flex items-center gap-2 md:hidden flex-shrink-0">
            {authed && user?.image && (
              <Image
                src={user.image}
                alt={user.name ?? ""}
                width={28}
                height={28}
                className="rounded-full ring-2 ring-hardwood-600 w-7 h-7"
              />
            )}
            <button
              type="button"
              aria-expanded={menuOpen}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              className="flex items-center justify-center w-10 h-10 rounded-lg text-gray-300 hover:text-white hover:bg-hardwood-700 transition-colors"
              onClick={() => setMenuOpen((o) => !o)}
            >
              {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
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
          <nav className="md:hidden absolute left-0 right-0 top-full border-b border-hardwood-600 bg-hardwood-800 shadow-xl z-50 flex flex-col p-3 gap-1 max-h-[calc(100dvh-3.5rem)] overflow-y-auto">
            {authed &&
              AUTH_PRIMARY_LINKS.map((link) => {
                const active = linkActive(link.href, pathname);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={linkClass(active, "px-4 py-3")}
                  >
                    {link.label}
                  </Link>
                );
              })}
            {PUBLIC_LINKS.map((link) => {
              const active = linkActive(link.href, pathname);
              return (
                <Link key={link.href} href={link.href} className={linkClass(active, "px-4 py-3")}>
                  {link.label}
                </Link>
              );
            })}
            {authed && isAdmin && (
              <Link
                href="/admin"
                className={clsx(
                  "font-body text-sm font-medium px-4 py-3 rounded-lg transition-colors",
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
                className="text-left font-mono text-sm text-gray-500 hover:text-gray-300 px-4 py-3 rounded-lg hover:bg-hardwood-700 transition-colors"
              >
                Sign out
              </button>
            )}
            {!authed && status !== "loading" && (
              <Link href="/login" className={linkClass(false, "px-4 py-3 text-court-400")}>
                Log in
              </Link>
            )}
          </nav>
        </>
      )}
    </header>
  );
}
