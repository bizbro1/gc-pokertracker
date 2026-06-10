import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getSessionBundle, getPlayerIdByKey, isHost } from "@/lib/queries";
import { hostCookieName, playerCookieName } from "@/lib/cookie-names";
import { playerStats, sessionTotals, chipsPerCash } from "@/lib/derive";
import { formatCash, formatChips } from "@/lib/format";
import { Card, CardHeader, StatusBadge } from "@/components/ui";
import { StatusControls } from "@/components/StatusControls";
import { SessionTimer } from "@/components/SessionTimer";
import { InvitePanel } from "@/components/InvitePanel";
import { PlayersPanel } from "@/components/PlayersPanel";
import { AddPlayerForm } from "@/components/AddPlayerForm";
import { SeatMap } from "@/components/SeatMap";
import { TotalsBar } from "@/components/TotalsBar";
import { RealtimeRefresher } from "@/components/RealtimeRefresher";

export const dynamic = "force-dynamic";

export default async function SessionDashboard({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const bundle = await getSessionBundle(id);
  if (!bundle) notFound();

  const { session, players, txs } = bundle;

  const jar = await cookies();
  const hostKey = jar.get(hostCookieName(id))?.value;
  if (!(await isHost(id, hostKey))) {
    // Not the host: players go to their own view, strangers to the join page
    const playerId = await getPlayerIdByKey(jar.get(playerCookieName(id))?.value);
    redirect(playerId ? `/session/${id}/me` : `/join/${session.join_code}`);
  }

  const rows = players.map((p) => ({ player: p, stats: playerStats(session, p, txs) }));
  const totals = sessionTotals(session, players, txs);

  return (
    <main className="mx-auto max-w-7xl px-5 py-8">
      <RealtimeRefresher sessionId={id} />

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            href="/"
            className="text-xs uppercase tracking-[0.2em] text-cream-dim hover:text-brass transition"
          >
            &larr; The ledger
          </Link>
          <div className="mt-2 flex items-center gap-4">
            <h1 className="font-display text-4xl brass-text">{session.name}</h1>
            <StatusBadge status={session.status} />
          </div>
          <p className="mt-1 text-xs text-cream-dim tabular-nums">
            Blinds {formatChips(session.small_blind)}/{formatChips(session.big_blind)}
            {" · "}
            {formatCash(session.cash_per_rate, session.currency_code)} ={" "}
            {formatChips(session.chips_per_rate)} chips
            {" · "}
            default buy-in {formatCash(session.default_buy_in_cash, session.currency_code)}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {session.status === "active" && session.started_at && (
            <SessionTimer startedAt={session.started_at} />
          )}
          <StatusControls sessionId={id} status={session.status} />
        </div>
      </div>

      <TotalsBar totals={totals} currency={session.currency_code} className="mt-6" />

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Players */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader
              title="The Table"
              subtitle={`${players.length} player${players.length === 1 ? "" : "s"} · ${formatChips(totals.chipsInPlay)} chips in play`}
              right={<AddPlayerForm sessionId={id} />}
            />
            <PlayersPanel
              sessionId={id}
              currency={session.currency_code}
              chipRatio={chipsPerCash(session)}
              defaultBuyIn={session.default_buy_in_cash}
              rows={rows}
              sessionEnded={session.status === "ended"}
            />
          </Card>

          {session.notes && (
            <Card>
              <CardHeader title="House Notes" />
              <p className="whitespace-pre-wrap px-5 py-4 text-sm text-cream-dim">
                {session.notes}
              </p>
            </Card>
          )}
        </div>

        {/* Side column */}
        <div className="space-y-6">
          <InvitePanel joinCode={session.join_code} disabled={session.status === "ended"} />
          <Card>
            <CardHeader title="Seating" subtitle="Tap a seat to assign a player" />
            <div className="px-4 py-5">
              <SeatMap
                sessionId={id}
                players={players}
                interactive={session.status !== "ended"}
              />
            </div>
          </Card>
          {session.status === "ended" && (
            <Link
              href={`/session/${id}/summary`}
              className="block rounded-xl border border-brass/50 bg-gradient-to-b from-espresso to-coal px-5 py-4 text-center font-display text-xl text-brass hover:border-brass transition"
            >
              View final results &rarr;
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
