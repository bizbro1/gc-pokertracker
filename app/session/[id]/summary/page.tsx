import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionBundle } from "@/lib/queries";
import { playerStats, sessionTotals } from "@/lib/derive";
import { formatCash, formatChips, formatSignedCash } from "@/lib/format";
import { settle } from "@/lib/settle";
import { cn } from "@/lib/cn";
import { Card, CardHeader, PnL, StatusBadge } from "@/components/ui";
import { Avatar } from "@/components/Avatar";
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
  const { session, players, txs, avatars } = bundle;

  const ranked = players
    .map((p) => ({ player: p, stats: playerStats(session, p, txs) }))
    .sort((a, b) => b.stats.pnl - a.stats.pnl);

  const totals = sessionTotals(session, players, txs);
  const byId = new Map(players.map((p) => [p.id, p]));
  const transfers = settle(
    ranked.map(({ player, stats }) => ({ id: player.id, amount: stats.pnl }))
  );
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
              <Avatar
                name={player.name}
                url={avatars[player.id]}
                className="h-10 w-10 text-sm shrink-0"
              />
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

      <Card className="mt-6">
        <CardHeader
          title="The Settlement"
          subtitle={
            transfers.length === 0
              ? "All square — nobody owes anybody"
              : `${transfers.length} payment${transfers.length === 1 ? "" : "s"} squares the night`
          }
        />
        {transfers.length > 0 && (
          <ol>
            {transfers.map((t, i) => {
              const from = byId.get(t.fromId);
              const to = byId.get(t.toId);
              if (!from || !to) return null;
              return (
                <li
                  key={i}
                  className="flex items-center gap-4 border-b border-white/5 px-5 py-4 last:border-0"
                >
                  <Avatar name={from.name} url={avatars[from.id]} className="h-9 w-9 text-xs shrink-0" />
                  <span className="min-w-0 flex-1 truncate text-sm text-cream">
                    <span className="font-medium">{from.name}</span>
                    <span className="mx-2 text-brass">&rarr;</span>
                    <span className="font-medium">{to.name}</span>
                  </span>
                  <Avatar name={to.name} url={avatars[to.id]} className="h-9 w-9 text-xs shrink-0" />
                  <span className="w-28 text-right font-display text-xl tabular-nums text-brass-bright">
                    {formatCash(t.amount, session.currency_code)}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
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
