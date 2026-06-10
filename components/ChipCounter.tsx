"use client";

import { useMemo, useState } from "react";
import { formatChips } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Button, Input } from "@/components/ui";

const DENOMS = [25, 100, 500, 1000, 5000] as const;

const CHIP_COLORS: Record<number, string> = {
  25: "border-win/60 text-win",
  100: "border-cream/60 text-cream",
  500: "border-loss/60 text-loss",
  1000: "border-brass/70 text-brass-bright",
  5000: "border-purple-400/60 text-purple-300",
};

/**
 * Count a stack by denomination. The loose field catches odd chips,
 * or can be used to type the full total directly.
 */
export function ChipCounter({
  submitLabel,
  pending,
  onSubmit,
  compact,
}: {
  submitLabel: string;
  pending?: boolean;
  onSubmit: (totalChips: number) => void;
  compact?: boolean;
}) {
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [loose, setLoose] = useState(0);

  const total = useMemo(
    () =>
      DENOMS.reduce((sum, d) => sum + d * (counts[d] || 0), 0) + (loose || 0),
    [counts, loose]
  );

  function setCount(denom: number, value: number) {
    setCounts((c) => ({ ...c, [denom]: Math.max(0, Math.floor(value) || 0) }));
  }

  return (
    <div className="space-y-3">
      <div className={cn("grid gap-2", compact ? "grid-cols-3" : "grid-cols-3 sm:grid-cols-6")}>
        {DENOMS.map((denom) => (
          <div key={denom} className="text-center">
            <div
              className={cn(
                "mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-dashed text-[9px] font-semibold tabular-nums",
                CHIP_COLORS[denom]
              )}
            >
              {denom >= 1000 ? `${denom / 1000}k` : denom}
            </div>
            <Input
              type="number"
              min={0}
              inputMode="numeric"
              value={counts[denom] || ""}
              placeholder="0"
              onChange={(e) => setCount(denom, Number(e.target.value))}
              className="h-9 px-1 text-center text-sm"
              aria-label={`Number of ${denom} chips`}
            />
          </div>
        ))}
        <div className="text-center">
          <div className="mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-dashed border-cream-faint/50 text-[8px] uppercase text-cream-faint">
            loose
          </div>
          <Input
            type="number"
            min={0}
            inputMode="numeric"
            value={loose || ""}
            placeholder="0"
            onChange={(e) => setLoose(Math.max(0, Math.floor(Number(e.target.value)) || 0))}
            className="h-9 px-1 text-center text-sm"
            aria-label="Loose chips value"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md felt-panel border border-felt-edge/60 px-4 py-2.5">
        <p className="text-xs text-cream-dim">
          Counted total:{" "}
          <span className="font-display text-lg text-brass-bright tabular-nums">
            {formatChips(total)}
          </span>{" "}
          chips
        </p>
        <Button size="sm" disabled={pending} onClick={() => onSubmit(total)}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
