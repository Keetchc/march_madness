"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { clsx } from "clsx";
import { Menu, X } from "lucide-react";

interface NavbarProps {
  user: { name?: string; email?: string; image?: string; isAdmin?: boolean };
}

const NAV_LINKS = [
  { href: "/dashboard",   label: "Dashboard" },
  { href: "/bracket",     label: "My Brackets" },
  { href: "/groups",      label: "Groups" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/compare",     label: "Compare" },
];

export function Navbar({ user }: NavbarProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

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
      <div className="container mx-auto px-4 sm:px-6 md:px-8 lg:px-10 max-w-[min(100%,2000px)]">
        <div className="flex items-center justify-between h-14 gap-2 min-w-0">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-1.5 sm:gap-2 group min-w-0 shrink">
            <span className="text-xl sm:text-2xl shrink-0">🏀</span>
            <span className="font-display text-base sm:text-xl font-black uppercase tracking-tight text-white group-hover:text-court-400 transition-colors truncate">
              Bracket<span className="text-court-500">Bash</span>
            </span>
          </Link>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-1 flex-shrink-0">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={clsx(
                  "font-body text-sm font-medium px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap",
                  pathname.startsWith(link.href)
                    ? "text-court-400 bg-hardwood-700"
                    : "text-gray-400 hover:text-white hover:bg-hardwood-700"
                )}
              >
                {link.label}
              </Link>
            ))}
            {user.isAdmin && (
              <Link
                href="/admin"
                className={clsx(
                  "font-body text-sm font-medium px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap",
                  pathname.startsWith("/admin")
                    ? "text-court-400 bg-hardwood-700"
                    : "text-yellow-500 hover:text-yellow-400 hover:bg-hardwood-700"
                )}
              >
                ⚡ Admin
              </Link>
            )}
          </nav>

          {/* User menu + mobile toggle */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <button
              type="button"
              aria-expanded={menuOpen}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              className="md:hidden flex items-center justify-center w-10 h-10 rounded-lg text-gray-300 hover:text-white hover:bg-hardwood-700 transition-colors"
              onClick={() => setMenuOpen((o) => !o)}
            >
              {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            {user.image && (
              <Image
                src={user.image}
                alt={user.name ?? ""}
                width={32}
                height={32}
                className="rounded-full ring-2 ring-hardwood-600 w-7 h-7 sm:w-8 sm:h-8"
              />
            )}
            <span className="hidden sm:block text-sm text-gray-400 font-body max-w-[8rem] truncate">
              {user.name?.split(" ")[0]}
            </span>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="hidden sm:inline text-xs text-gray-500 hover:text-gray-300 font-mono transition-colors"
            >
              Sign out
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
          <nav className="md:hidden absolute left-0 right-0 top-full border-b border-hardwood-600 bg-hardwood-800 shadow-xl z-50 flex flex-col p-3 gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={clsx(
                  "font-body text-sm font-medium px-4 py-3 rounded-lg transition-colors",
                  pathname.startsWith(link.href)
                    ? "text-court-400 bg-hardwood-700"
                    : "text-gray-400 hover:text-white hover:bg-hardwood-700"
                )}
              >
                {link.label}
              </Link>
            ))}
            {user.isAdmin && (
              <Link
                href="/admin"
                className={clsx(
                  "font-body text-sm font-medium px-4 py-3 rounded-lg transition-colors",
                  pathname.startsWith("/admin")
                    ? "text-court-400 bg-hardwood-700"
                    : "text-yellow-500 hover:text-yellow-400 hover:bg-hardwood-700"
                )}
              >
                ⚡ Admin
              </Link>
            )}
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-left font-mono text-sm text-gray-500 hover:text-gray-300 px-4 py-3 rounded-lg hover:bg-hardwood-700 transition-colors sm:hidden"
            >
              Sign out
            </button>
          </nav>
        </>
      )}
    </header>
  );
}
