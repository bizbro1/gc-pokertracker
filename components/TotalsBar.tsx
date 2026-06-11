import { SessionTotals } from "@/lib/derive";
import { formatCash, formatChips } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui";
import { LevelStats } from "@/components/LevelStats";
import { Session } from "@/lib/types";

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="px-5 py-4">
      <p className="text-[10px] uppercase tracking-[0.2em] text-cream-dim">{label}</p>
      <p className={cn("mt-1 font-display text-2xl tabular-nums", tone ?? "text-cream")}>
        {value}
      </p>
    </div>
  );
}

export function TotalsBar({
  totals,
  session,
  className,
}: {
  totals: SessionTotals;
  session: Session;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-x divide-white/5",
        className
      )}
    >
      <Stat label="Cash in" value={formatCash(totals.cashIn, session.currency_code)} />
      <Stat label="Chips in play" value={formatChips(totals.chipsInPlay)} />
      <LevelStats session={session} />
    </Card>
  );
}
