import { getAllData } from "@/lib/queries";
import { playerStats } from "@/lib/derive";
import { formatCash, formatSignedCash } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Card, CardHeader, PnL } from "@/components/ui";

export const dynamic = "force-dynamic";

interface Ranking {
  name: string;
  sessionsPlayed: number;
  totalBuyIn: number;
  pnl: number;
}

export default async function RankingsPage() {
  const { sessions, players, txs } = await getAllData();

  const byName = new Map<string, Ranking>();
  for (const player of players) {
    const session = sessions.find((s) => s.id === player.session_id);
    if (!session) continue;
    const stats = playerStats(session, player, txs);

    const key = player.name.trim().toLowerCase();
    const entry = byName.get(key) ?? {
      name: player.name.trim(),
      sessionsPlayed: 0,
      totalBuyIn: 0,
      pnl: 0,
    };
    entry.sessionsPlayed += 1;
    entry.totalBuyIn += stats.buyInCash;
    entry.pnl += stats.pnl;
    byName.set(key, entry);
  }

  const ranked = [...byName.values()].sort((a, b) => b.pnl - a.pnl);
  // The club runs on one currency; take it from the latest session
  const currency = sessions[0]?.currency_code ?? "NOK";

  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <p className="text-[10px] uppercase tracking-[0.4em] text-cream-dim">Hall of fame</p>
      <h1 className="mt-2 font-display text-4xl brass-text">Player Rankings</h1>
      <p className="mt-2 text-sm text-cream-dim">
        Lifetime profit and loss across every night at the club.
      </p>

      <Card className="mt-8">
        <CardHeader
          title="The Standings"
          subtitle={`${ranked.length} player${ranked.length === 1 ? "" : "s"} in the books`}
        />
        {ranked.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-cream-dim">
            Nobody has played a hand yet.
          </p>
        ) : (
          <ol>
            {ranked.map((r, i) => (
              <li
                key={r.name.toLowerCase()}
                className={cn(
                  "flex items-center gap-4 border-b border-white/5 px-5 py-4 last:border-0",
                  i === 0 && r.pnl > 0 && "bg-brass/5"
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
                  <p className="truncate font-medium text-cream">{r.name}</p>
                  <p className="text-[11px] text-cream-dim tabular-nums">
                    {r.sessionsPlayed} session{r.sessionsPlayed === 1 ? "" : "s"}
                    {" · "}
                    {formatCash(r.totalBuyIn, currency)} in buy-ins
                  </p>
                </div>
                <PnL
                  value={r.pnl}
                  currency={currency}
                  format={formatSignedCash}
                  className="font-display text-xl"
                />
              </li>
            ))}
          </ol>
        )}
      </Card>
    </main>
  );
}
