import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getSessionBundle, getPlayerIdByKey } from "@/lib/queries";
import { playerCookieName } from "@/lib/cookie-names";
import { playerStats } from "@/lib/derive";
import { formatCash, formatChips, formatSignedCash } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Card, CardHeader, PnL, StatusBadge } from "@/components/ui";
import { SessionTimer } from "@/components/SessionTimer";
import { RealtimeRefresher } from "@/components/RealtimeRefresher";

export const dynamic = "force-dynamic";

export default async function PlayerView({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const bundle = await getSessionBundle(id);
  if (!bundle) notFound();
  const { session, players, txs } = bundle;

  const jar = await cookies();
  const playerId = await getPlayerIdByKey(jar.get(playerCookieName(id))?.value);
  const me = players.find((p) => p.id === playerId);
  if (!me) redirect(`/join/${session.join_code}`);

  const myStats = playerStats(session, me, txs);
  const others = players
    .filter((p) => p.id !== me.id)
    .map((p) => ({ player: p, stats: playerStats(session, p, txs) }));

  return (
    <main className="mx-auto max-w-md px-5 py-8 pb-16">
      <RealtimeRefresher sessionId={id} />

      <header className="text-center">
        <p className="text-[10px] uppercase tracking-[0.4em] text-cream-dim">
          Gentleman&apos;s Club
        </p>
        <h1 className="mt-2 font-display text-3xl brass-text">{session.name}</h1>
        <div className="mt-2 flex items-center justify-center gap-3">
          <StatusBadge status={session.status} />
          <span className="text-xs text-cream-dim tabular-nums">
            Blinds {formatChips(session.small_blind)}/{formatChips(session.big_blind)}
          </span>
        </div>
      </header>

      {session.status === "active" && session.started_at && (
        <div className="mt-4 flex justify-center">
          <SessionTimer startedAt={session.started_at} />
        </div>
      )}

      {/* My stack */}
      <Card className="mt-6 overflow-hidden">
        <div className="felt-panel border-b border-felt-edge/60 px-5 py-6 text-center">
          <p className="text-[10px] uppercase tracking-[0.3em] text-cream-dim">
            {me.name}
            {me.seat ? ` · Seat ${me.seat}` : ""}
            {me.status === "cashed_out" ? " · Cashed out" : ""}
          </p>
          <p className="mt-2 font-display text-5xl text-brass-bright tabular-nums">
            {formatChips(myStats.currentChips)}
          </p>
          <p className="mt-1 text-xs text-cream-dim tabular-nums">
            chips &asymp; {formatCash(myStats.currentValue, session.currency_code)}
          </p>
        </div>
        <div className="grid grid-cols-3 divide-x divide-white/5 text-center">
          <div className="px-2 py-4">
            <p className="text-[9px] uppercase tracking-[0.2em] text-cream-dim">Buy-ins</p>
            <p className="mt-1 text-sm tabular-nums text-cream">
              {formatCash(myStats.buyInCash, session.currency_code)}
            </p>
            <p className="text-[10px] text-cream-faint tabular-nums">&times;{myStats.buyInCount}</p>
          </div>
          <div className="px-2 py-4">
            <p className="text-[9px] uppercase tracking-[0.2em] text-cream-dim">Cashed out</p>
            <p className="mt-1 text-sm tabular-nums text-cream">
              {formatCash(myStats.cashOutCash, session.currency_code)}
            </p>
          </div>
          <div className="px-2 py-4">
            <p className="text-[9px] uppercase tracking-[0.2em] text-cream-dim">P / L</p>
            <p className="mt-1 text-sm">
              <PnL value={myStats.pnl} currency={session.currency_code} format={formatSignedCash} />
            </p>
          </div>
        </div>
      </Card>

      {/* The table */}
      <Card className="mt-6">
        <CardHeader title="The Table" subtitle={`${players.length} players seated`} />
        <ul className="divide-y divide-white/5">
          {others.length === 0 && (
            <li className="px-5 py-4 text-sm text-cream-dim">Just you so far.</li>
          )}
          {others.map(({ player, stats }) => (
            <li
              key={player.id}
              className={cn(
                "flex items-center justify-between px-5 py-3",
                player.status === "cashed_out" && "opacity-50"
              )}
            >
              <div>
                <p className="text-sm text-cream">
                  {player.name}
                  {player.seat && (
                    <span className="ml-2 text-[10px] uppercase tracking-wider text-cream-faint">
                      Seat {player.seat}
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-cream-dim tabular-nums">
                  in for {formatCash(stats.buyInCash, session.currency_code)}
                </p>
              </div>
              <p className="text-sm tabular-nums text-cream-dim">
                {formatChips(stats.currentChips)}
              </p>
            </li>
          ))}
        </ul>
      </Card>

      {session.status === "ended" && (
        <Link
          href={`/session/${id}/summary`}
          className="mt-6 block rounded-xl border border-brass/50 bg-gradient-to-b from-espresso to-coal px-5 py-4 text-center font-display text-lg text-brass"
        >
          Final results &rarr;
        </Link>
      )}

      <p className="mt-8 text-center text-[10px] text-cream-faint">
        Buy-ins and cash-outs are handled by the host.
      </p>
    </main>
  );
}
