import { SessionTotals } from "@/lib/derive";
import { formatCash, formatChips } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui";

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
  currency,
  className,
}: {
  totals: SessionTotals;
  currency: string;
  className?: string;
}) {
  const balanced = Math.abs(totals.discrepancy) < 0.01;
  return (
    <Card className={cn("grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-white/5", className)}>
      <Stat label="Cash in" value={formatCash(totals.cashIn, currency)} />
      <Stat label="Chips issued" value={formatChips(totals.chipsIssued)} />
      <Stat label="Chips in play" value={formatChips(totals.chipsInPlay)} />
      <Stat label="Chips returned" value={formatChips(totals.chipsReturned)} />
      <Stat label="Cash paid out" value={formatCash(totals.cashOut, currency)} />
      <Stat
        label="Bank check"
        value={balanced ? "Balanced" : formatCash(totals.discrepancy, currency)}
        tone={balanced ? "text-win" : "text-loss"}
      />
    </Card>
  );
}
