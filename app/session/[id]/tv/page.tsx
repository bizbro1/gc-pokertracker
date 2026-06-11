import { notFound } from "next/navigation";
import { getSessionBundle } from "@/lib/queries";
import { playerStats, sessionTotals } from "@/lib/derive";
import { formatCash, formatChips, formatSignedCash } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Card, CardHeader, PnL, StatusBadge } from "@/components/ui";
import { Avatar } from "@/components/Avatar";
import { RealtimeRefresher } from "@/components/RealtimeRefresher";
import { TvClock } from "@/components/TvClock";
import { TvInvite } from "@/components/TvInvite";

export const dynamic = "force-dynamic";

export default async function TvPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const bundle = await getSessionBundle(id);
  if (!bundle) notFound();
  const { session, players, txs, avatars } = bundle;

  const ended = session.status === "ended";
  const ranked = players
    .map((p) => ({ player: p, stats: playerStats(session, p, txs) }))
    .sort((a, b) => {
      if (ended) return b.stats.pnl - a.stats.pnl;
      // Live: players still in the game ranked by stack, cashed-out at the bottom
      const aOut = a.player.status === "cashed_out" ? 1 : 0;
      const bOut = b.player.status === "cashed_out" ? 1 : 0;
      if (aOut !== bOut) return aOut - bOut;
      return aOut ? b.stats.pnl - a.stats.pnl : b.stats.currentChips - a.stats.currentChips;
    });

  const totals = sessionTotals(session, players, txs);

  return (
    <main className="mx-auto flex min-h-screen max-w-[1600px] flex-col px-10 py-8">
      <RealtimeRefresher sessionId={id} />

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-8">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-cream-dim">
            Gentleman&apos;s Club
          </p>
          <div className="mt-2 flex items-center gap-5">
            <h1 className="font-display text-6xl brass-text">{session.name}</h1>
            <StatusBadge status={session.status} />
          </div>
        </div>
        <div className="flex items-end gap-12">
          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.3em] text-cream-dim">Blinds</p>
            <p className="mt-1 font-display text-6xl tabular-nums leading-none text-cream">
              {formatChips(session.small_blind)}&thinsp;/&thinsp;{formatChips(session.big_blind)}
            </p>
          </div>
          {session.status === "active" && session.started_at && (
            <TvClock startedAt={session.started_at} />
          )}
        </div>
      </div>

      <div className="mt-8 grid flex-1 grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Stacks board */}
        <Card className="lg:col-span-2 self-start">
          <CardHeader
            title={ended ? "Final Standings" : "The Stacks"}
            subtitle={
              ended
                ? `${formatCash(totals.cashIn, session.currency_code)} crossed the felt`
                : `${formatChips(totals.chipsInPlay)} chips in play`
            }
          />
          <ol>
            {ranked.map(({ player, stats }, i) => {
              const out = player.status === "cashed_out";
              return (
                <li
                  key={player.id}
                  className={cn(
                    "flex items-center gap-6 border-b border-white/5 px-6 py-4 last:border-0",
                    i === 0 && !out && "bg-brass/5",
                    out && !ended && "opacity-50"
                  )}
                >
                  <span
                    className={cn(
                      "w-10 text-center font-display text-4xl tabular-nums",
                      i === 0 ? "text-brass-bright" : i === 1 ? "text-cream" : "text-cream-faint"
                    )}
                  >
                    {i + 1}
                  </span>
                  <Avatar
                    name={player.name}
                    url={avatars[player.id]}
                    className="h-14 w-14 shrink-0 text-lg"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-2xl font-medium text-cream">{player.name}</p>
                    <p className="text-sm text-cream-dim tabular-nums">
                      {player.seat ? `Seat ${player.seat}` : "No seat"}
                      {out && !ended && " · cashed out"}
                    </p>
                  </div>
                  <div className="text-right">
                    {ended || out ? (
                      <PnL
                        value={stats.pnl}
                        currency={session.currency_code}
                        format={formatSignedCash}
                        className="font-display text-4xl"
                      />
                    ) : (
                      <>
                        <p className="font-display text-4xl tabular-nums leading-none text-cream">
                          {formatChips(stats.currentChips)}
                        </p>
                        <PnL
                          value={stats.pnl}
                          currency={session.currency_code}
                          format={formatSignedCash}
                          className="text-base"
                        />
                      </>
                    )}
                  </div>
                </li>
              );
            })}
            {ranked.length === 0 && (
              <li className="px-6 py-12 text-center text-lg text-cream-dim">
                Nobody at the table yet — scan the code to take a seat.
              </li>
            )}
          </ol>
        </Card>

        {/* Side column */}
        <div className="space-y-8 self-start">
          {!ended && <TvInvite joinCode={session.join_code} />}

          <Card className="grid grid-cols-2 divide-x divide-white/5 text-center">
            <div className="px-3 py-5">
              <p className="text-[10px] uppercase tracking-[0.2em] text-cream-dim">On the felt</p>
              <p className="mt-1 font-display text-3xl tabular-nums text-cream">
                {formatCash(totals.cashIn, session.currency_code)}
              </p>
            </div>
            <div className="px-3 py-5">
              <p className="text-[10px] uppercase tracking-[0.2em] text-cream-dim">Players</p>
              <p className="mt-1 font-display text-3xl tabular-nums text-cream">
                {players.length}
              </p>
            </div>
          </Card>

          {session.status === "setup" && (
            <p className="text-center text-sm uppercase tracking-[0.3em] text-cream-faint">
              Waiting for the first hand
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
