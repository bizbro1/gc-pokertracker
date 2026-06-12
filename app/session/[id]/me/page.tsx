import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getSessionBundle, getPlayerIdByKey } from "@/lib/queries";
import { playerCookieName } from "@/lib/cookie-names";
import { playerStats } from "@/lib/derive";
import { formatCash, formatChips, formatSignedCash } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Card, PnL, StatusBadge } from "@/components/ui";
import { SessionTimer } from "@/components/SessionTimer";
import { MyChipCount } from "@/components/MyChipCount";
import { Avatar } from "@/components/Avatar";
import { AvatarUploader } from "@/components/AvatarUploader";
import { Collapsible } from "@/components/Collapsible";
import { DuelPanel } from "@/components/DuelPanel";
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
  const { session, players, txs, duels, avatars } = bundle;

  const jar = await cookies();
  const playerId = await getPlayerIdByKey(jar.get(playerCookieName(id))?.value);
  const me = players.find((p) => p.id === playerId);
  if (!me) redirect(`/join/${session.join_code}`);

  // Chip transfers from a duel still playing out on the TV stay invisible
  // here — a jumping stack number would spoil the runout
  const REVEAL_MS = 42_000;
  const freshDuels = new Set(
    duels
      .filter(
        (d) =>
          d.status === "settled" &&
          d.settled_at &&
          Date.now() - new Date(d.settled_at).getTime() < REVEAL_MS
      )
      .map((d) => d.id)
  );
  const visibleTxs = txs.filter((t) => !t.duel_id || !freshDuels.has(t.duel_id));

  const myStats = playerStats(session, me, visibleTxs);
  const others = players
    .filter((p) => p.id !== me.id)
    .map((p) => ({ player: p, stats: playerStats(session, p, visibleTxs) }));

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
          <SessionTimer session={session} />
        </div>
      )}

      {/* My stack */}
      <Card className="mt-6 overflow-hidden">
        <div className="felt-panel border-b border-felt-edge/60 px-5 py-6 text-center">
          <div className="mb-3 flex flex-col items-center gap-1.5">
            <Avatar name={me.name} url={avatars[me.id]} className="h-16 w-16 text-xl" />
            <AvatarUploader sessionId={id} />
          </div>
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
        <div className="grid grid-cols-2 divide-x divide-white/5 text-center">
          <div className="px-2 py-4">
            <p className="text-[9px] uppercase tracking-[0.2em] text-cream-dim">Buy-ins</p>
            <p className="mt-1 text-sm tabular-nums text-cream">
              {formatCash(myStats.buyInCash, session.currency_code)}
            </p>
            <p className="text-[10px] text-cream-faint tabular-nums">&times;{myStats.buyInCount}</p>
          </div>
          <div className="px-2 py-4">
            <p className="text-[9px] uppercase tracking-[0.2em] text-cream-dim">P / L</p>
            <p className="mt-1 text-sm">
              <PnL value={myStats.pnl} currency={session.currency_code} format={formatSignedCash} />
            </p>
          </div>
        </div>
      </Card>

      {session.status !== "ended" && me.status === "active" && (
        <MyChipCount sessionId={id} />
      )}

      {session.status === "active" && me.status === "active" && (
        <DuelPanel
          sessionId={id}
          myId={me.id}
          players={players}
          duels={duels}
          avatars={avatars}
        />
      )}

      {/* The table */}
      <Collapsible
        title="The Table"
        subtitle={`${players.length} players seated`}
        defaultOpen
        className="mt-6"
      >
        <ul className="divide-y divide-white/5">
          {others.length === 0 && (
            <li className="px-5 py-4 text-sm text-cream-dim">Just you so far.</li>
          )}
          {others.map(({ player, stats }) => (
            <li
              key={player.id}
              className={cn(
                "flex items-center justify-between gap-3 px-5 py-3",
                player.status === "cashed_out" && "opacity-50"
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Avatar
                  name={player.name}
                  url={avatars[player.id]}
                  className="h-9 w-9 text-xs shrink-0"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm text-cream">
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
              </div>
              <p className="text-sm tabular-nums text-cream-dim shrink-0">
                {formatChips(stats.currentChips)}
              </p>
            </li>
          ))}
        </ul>
      </Collapsible>

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
