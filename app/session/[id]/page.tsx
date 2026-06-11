import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getSessionBundle, getPlayerIdByKey, getHostCode, isHost } from "@/lib/queries";
import { hostCookieName, playerCookieName } from "@/lib/cookie-names";
import { playerStats, sessionTotals, chipsPerCash } from "@/lib/derive";
import { formatCash, formatChips } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Card, CardHeader, StatusBadge } from "@/components/ui";
import { StatusControls } from "@/components/StatusControls";
import { PlayersPanel } from "@/components/PlayersPanel";
import { QrButton } from "@/components/QrButton";
import { AddPlayerForm } from "@/components/AddPlayerForm";
import { ActivityLog } from "@/components/ActivityLog";
import { TotalsBar } from "@/components/TotalsBar";
import { RealtimeRefresher } from "@/components/RealtimeRefresher";
import { TvModeButton } from "@/components/tv/TvModeButton";

export const dynamic = "force-dynamic";

export default async function SessionDashboard({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const bundle = await getSessionBundle(id);
  if (!bundle) notFound();

  const { session, players, txs, avatars } = bundle;

  const jar = await cookies();
  const hostKey = jar.get(hostCookieName(id))?.value;
  if (!(await isHost(id, hostKey))) {
    // Not the host: players go to their own view, strangers to the join page
    const playerId = await getPlayerIdByKey(jar.get(playerCookieName(id))?.value);
    redirect(playerId ? `/session/${id}/me` : `/join/${session.join_code}`);
  }

  const rows = players.map((p) => ({ player: p, stats: playerStats(session, p, txs) }));
  const totals = sessionTotals(session, players, txs);
  const balanced = Math.abs(totals.discrepancy) < 0.01;
  const hostCode = await getHostCode(id);

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
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-[0.15em]",
                balanced ? "border-win/50 text-win" : "border-loss/50 text-loss"
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  balanced ? "bg-win" : "bg-loss animate-pulse"
                )}
              />
              {balanced
                ? "Bank balanced"
                : `Bank ${formatCash(totals.discrepancy, session.currency_code)}`}
            </span>
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
          {session.status !== "ended" && (
            <QrButton joinCode={session.join_code} hostCode={hostCode} />
          )}
          <TvModeButton session={session} players={players} txs={txs} avatars={avatars} />
          <StatusControls sessionId={id} status={session.status} />
        </div>
      </div>

      <TotalsBar totals={totals} session={session} className="mt-6" />

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
              avatars={avatars}
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
          <ActivityLog session={session} players={players} txs={txs} />
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
