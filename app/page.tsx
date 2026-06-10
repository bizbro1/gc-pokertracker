import Link from "next/link";
import { listSessions } from "@/lib/queries";
import { formatCash } from "@/lib/format";
import { Card, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

function SuitDivider() {
  return (
    <div className="flex items-center justify-center gap-3 text-brass-dim/70 text-sm select-none">
      <span className="h-px w-16 bg-brass-dim/40" />
      <span>&#9824;</span>
      <span>&#9829;</span>
      <span>&#9830;</span>
      <span>&#9827;</span>
      <span className="h-px w-16 bg-brass-dim/40" />
    </div>
  );
}

export default async function HomePage() {
  let sessions: Awaited<ReturnType<typeof listSessions>> = [];
  let dbError: string | null = null;
  try {
    sessions = await listSessions(["setup", "active"]);
  } catch (e) {
    dbError = e instanceof Error ? e.message : "Could not reach the database";
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-16">
      <header className="text-center">
        <p className="text-[11px] uppercase tracking-[0.5em] text-cream-dim">
          Members Only
        </p>
        <h1 className="mt-4 font-display text-6xl sm:text-7xl brass-text tracking-wide">
          GC PokerTracker
        </h1>
        <p className="mt-3 text-sm text-cream-dim tracking-wide">
          Gentleman&apos;s Club &mdash; private table ledger
        </p>
        <div className="mt-8">
          <SuitDivider />
        </div>
        <div className="mt-10">
          <Link
            href="/session/new"
            className="inline-flex h-12 items-center rounded-md bg-gradient-to-b from-brass-bright via-brass to-brass-dim px-8 text-sm font-semibold uppercase tracking-[0.18em] text-ink shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_6px_20px_rgba(0,0,0,0.5)] transition hover:brightness-110"
          >
            Open a New Table
          </Link>
        </div>
      </header>

      <section className="mt-16">
        <h2 className="mb-4 text-[11px] uppercase tracking-[0.3em] text-cream-dim">
          Open Tables
        </h2>

        {dbError ? (
          <Card className="px-5 py-6 text-sm text-loss">
            Could not reach the database. Has the SQL migration been run in
            Supabase? <span className="text-cream-faint">({dbError})</span>
          </Card>
        ) : sessions.length === 0 ? (
          <Card className="px-5 py-10 text-center">
            <p className="font-display text-2xl text-brass-dim">No open tables tonight.</p>
            <p className="mt-2 text-sm text-cream-dim">
              Open a new table, or browse past nights in{" "}
              <Link href="/history" className="text-brass hover:text-brass-bright">
                History
              </Link>
              .
            </p>
          </Card>
        ) : (
          <ul className="space-y-3">
            {sessions.map((s) => (
              <li key={s.id}>
                <Link href={`/session/${s.id}`} className="block group">
                  <Card className="flex items-center justify-between gap-4 px-5 py-4 transition group-hover:border-brass/50">
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <span className="font-display text-xl text-cream truncate">
                          {s.name}
                        </span>
                        <StatusBadge status={s.status} />
                      </div>
                      <p className="mt-1 text-xs text-cream-dim tabular-nums">
                        {new Date(s.created_at).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                        {" · "}
                        {s.players?.[0]?.count ?? 0} players
                        {" · "}
                        blinds {s.small_blind}/{s.big_blind}
                        {" · "}
                        buy-in {formatCash(s.default_buy_in_cash, s.currency_code)}
                      </p>
                    </div>
                    <span className="text-brass-dim transition group-hover:text-brass">
                      &rarr;
                    </span>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
