import Link from "next/link";
import { listSessions } from "@/lib/queries";
import { formatCash } from "@/lib/format";
import { Card, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const sessions = await listSessions(["ended"]);

  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <p className="text-[10px] uppercase tracking-[0.4em] text-cream-dim">The archive</p>
      <h1 className="mt-2 font-display text-4xl brass-text">History</h1>
      <p className="mt-2 text-sm text-cream-dim">Every night the club has settled.</p>

      <section className="mt-8">
        {sessions.length === 0 ? (
          <Card className="px-5 py-10 text-center">
            <p className="font-display text-2xl text-brass-dim">Nothing in the books yet.</p>
            <p className="mt-2 text-sm text-cream-dim">
              Finished sessions will be archived here.
            </p>
          </Card>
        ) : (
          <ul className="space-y-3">
            {sessions.map((s) => (
              <li key={s.id}>
                <Link href={`/session/${s.id}/summary`} className="block group">
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
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                        {" · "}
                        {s.players?.[0]?.count ?? 0} players
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
