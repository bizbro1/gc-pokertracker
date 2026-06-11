"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const LINKS = [
  { href: "/", label: "The Ledger" },
  { href: "/history", label: "History" },
  { href: "/rankings", label: "Rankings" },
  { href: "/showdown", label: "Showdown" },
];

export function NavBar() {
  const pathname = usePathname();

  // TV mode is a clean big-screen view — no chrome
  if (pathname.startsWith("/tv/")) return null;

  return (
    <nav className="sticky top-0 z-50 border-b hairline bg-ink/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-2.5 group">
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-brass-dim/60 font-display text-sm text-brass group-hover:border-brass transition">
            GC
          </span>
          <span className="hidden font-display text-lg text-cream tracking-wide sm:inline">
            PokerTracker
          </span>
        </Link>

        <div className="flex items-center gap-1">
          {LINKS.map(({ href, label }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "rounded-md px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] transition",
                  active
                    ? "text-brass-bright bg-brass/10"
                    : "text-cream-dim hover:text-cream hover:bg-white/5"
                )}
              >
                {label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
