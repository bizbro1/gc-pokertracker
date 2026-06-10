import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionBundle } from "@/lib/queries";
import { playerStats, sessionTotals } from "@/lib/derive";
import { formatCash, formatChips, formatSignedCash } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Card, CardHeader, PnL, StatusBadge } from "@/components/ui";
import { RealtimeRefresher } from "@/components/RealtimeRefresher";

export const dynamic = "force-dynamic";

export default async function SummaryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const bundle = await getSessionBundle(id);
  if (!bundle) notFound();
  const { session, players, txs } = bundle;

  const ranked = players
    .map((p) => ({ player: p, stats: playerStats(session, p, txs) }))
    .sort((a, b) => b.stats.pnl - a.stats.pnl);

  const totals = sessionTotals(session, players, txs);
  const duration =
    session.started_at && session.ended_at
      ? Math.round(
          (new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / 60000
        )
      : null;

  return (
    <main className="mx-auto max-w-2xl px-5 py-12">
      <RealtimeRefresher sessionId={id} />

      <div className="text-center">
        <Link
          href={`/session/${id}`}
          className="text-xs uppercase tracking-[0.2em] text-cream-dim hover:text-brass transition"
        >
          &larr; Back to the table
        </Link>
        <p className="mt-6 text-[10px] uppercase tracking-[0.4em] text-cream-dim">
          The night&apos;s reckoning
        </p>
        <h1 className="mt-3 font-display text-5xl brass-text">{session.name}</h1>
        <div className="mt-3 flex items-center justify-center gap-3">
          <StatusBadge status={session.status} />
          {duration !== null && (
            <span className="text-xs text-cream-dim tabular-nums">
              {Math.floor(duration / 60)}h {duration % 60}m at the table
            </span>
          )}
        </div>
      </div>

      <Card className="mt-10">
        <CardHeader
          title="Final Standings"
          subtitle={`${formatCash(totals.cashIn, session.currency_code)} crossed the felt`}
        />
        <ol>
          {ranked.map(({ player, stats }, i) => (
            <li
              key={player.id}
              className={cn(
                "flex items-center gap-4 border-b border-white/5 px-5 py-4 last:border-0",
                i === 0 && stats.pnl > 0 && "bg-brass/5"
              )}
            >
              <span
                className={cn(
                  "w-8 text-center font-display text-2xl tabular-nums",
                  i === 0 ? "text-brass-bright" : i === 1 ? "text-cream" : "text-cream-faint"
                )}
              >
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-cream">
                  {player.name}
                  {i === 0 && stats.pnl > 0 && (
                    <span className="ml-2 text-[10px] uppercase tracking-[0.2em] text-brass">
                      Top of the night
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-cream-dim tabular-nums">
                  in {formatCash(stats.buyInCash, session.currency_code)} &middot; out{" "}
                  {formatCash(stats.cashOutCash, session.currency_code)}
                  {stats.currentChips !== 0 &&
                    ` · ${formatChips(stats.currentChips)} chips unsettled`}
                </p>
              </div>
              <PnL
                value={stats.pnl}
                currency={session.currency_code}
                format={formatSignedCash}
                className="font-display text-xl"
              />
            </li>
          ))}
          {ranked.length === 0 && (
            <li className="px-5 py-8 text-center text-sm text-cream-dim">
              Nobody sat down at this table.
            </li>
          )}
        </ol>
      </Card>

      <Card className="mt-6 grid grid-cols-3 divide-x divide-white/5 text-center">
        <div className="px-3 py-4">
          <p className="text-[9px] uppercase tracking-[0.2em] text-cream-dim">Cash in</p>
          <p className="mt-1 font-display text-xl tabular-nums text-cream">
            {formatCash(totals.cashIn, session.currency_code)}
          </p>
        </div>
        <div className="px-3 py-4">
          <p className="text-[9px] uppercase tracking-[0.2em] text-cream-dim">Cash out</p>
          <p className="mt-1 font-display text-xl tabular-nums text-cream">
            {formatCash(totals.cashOut, session.currency_code)}
          </p>
        </div>
        <div className="px-3 py-4">
          <p className="text-[9px] uppercase tracking-[0.2em] text-cream-dim">Bank check</p>
          <p
            className={cn(
              "mt-1 font-display text-xl tabular-nums",
              Math.abs(totals.discrepancy) < 0.01 ? "text-win" : "text-loss"
            )}
          >
            {Math.abs(totals.discrepancy) < 0.01
              ? "Balanced"
              : formatCash(totals.discrepancy, session.currency_code)}
          </p>
        </div>
      </Card>
    </main>
  );
}
