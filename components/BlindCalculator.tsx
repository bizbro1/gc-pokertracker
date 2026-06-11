"use client";

import { useMemo, useState } from "react";
import { formatLevelTime, generateBlindStructure } from "@/lib/blinds";
import { formatChips } from "@/lib/format";
import { BlindPlan } from "@/lib/types";
import { Button, Input, Label, Select } from "@/components/ui";
import { cn } from "@/lib/cn";

/**
 * Blind structure calculator for the session builder. The structure is one
 * of the most important details of a good tournament: blinds rise gradually
 * each level and the game finishes on time. Needs the starting blind level
 * (usually the smallest chip denomination), the estimated total chips in
 * play (buy-ins plus expected rebuys and add-ons) and the target duration.
 */
export function BlindCalculator({
  stackChips,
  onApply,
}: {
  /** chips a player gets for the default buy-in */
  stackChips: number;
  onApply: (smallBlind: number, bigBlind: number, plan: BlindPlan) => void;
}) {
  const [open, setOpen] = useState(false);
  const [players, setPlayers] = useState(6);
  const [startSb, setStartSb] = useState(25);
  const [chipsOverride, setChipsOverride] = useState<number | null>(null);
  const [durationH, setDurationH] = useState(4);
  const [levelMin, setLevelMin] = useState(20);
  const [applied, setApplied] = useState(false);

  // Buy-ins for everyone by default; type your own figure to budget for
  // rebuys and add-ons
  const totalChips = chipsOverride ?? players * stackChips;

  const levels = useMemo(
    () =>
      generateBlindStructure({
        startingSmallBlind: startSb,
        totalChips,
        durationMin: durationH * 60,
        levelMin,
      }),
    [startSb, totalChips, durationH, levelMin]
  );

  const openingDepth = Math.round(stackChips / (levels[0]?.bigBlind || 1));

  function apply() {
    const first = levels[0];
    if (!first) return;
    onApply(first.smallBlind, first.bigBlind, { levelMin, levels });
    setApplied(true);
    setTimeout(() => setApplied(false), 2500);
  }

  return (
    <div className="rounded-md border hairline bg-ink/40">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full cursor-pointer items-center justify-between px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span className="text-[11px] uppercase tracking-[0.18em] text-cream-dim">
          Blind structure calculator
        </span>
        <span className={cn("text-brass-dim transition-transform duration-200", open && "rotate-180")}>
          &#9662;
        </span>
      </button>

      {open && (
        <div className="space-y-4 border-t hairline px-4 py-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <Label>Players</Label>
              <Input
                type="number"
                min={2}
                max={10}
                value={players}
                onChange={(e) => setPlayers(Number(e.target.value) || 2)}
              />
            </div>
            <div>
              <Label>Starting small blind</Label>
              <Input
                type="number"
                min={1}
                value={startSb}
                onChange={(e) => setStartSb(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>
            <div>
              <Label>Total chips in play</Label>
              <Input
                type="number"
                min={1}
                value={totalChips}
                onChange={(e) => setChipsOverride(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>
            <div>
              <Label>Game length</Label>
              <Select value={durationH} onChange={(e) => setDurationH(Number(e.target.value))}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                  <option key={h} value={h}>
                    {h} hour{h > 1 ? "s" : ""}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Level length</Label>
              <Select value={levelMin} onChange={(e) => setLevelMin(Number(e.target.value))}>
                {[10, 15, 20, 30, 45, 60].map((m) => (
                  <option key={m} value={m}>
                    {m} min
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <p className="text-[11px] text-cream-dim tabular-nums">
            Set the starting small blind to your smallest chip denomination. Total chips
            defaults to {players} buy-ins ({formatChips(players * stackChips)}) — raise it to
            budget for rebuys and add-ons. Play opens ~{openingDepth} big blinds deep and the
            final level reaches about 1/20 of all chips, forcing a finish in ~{durationH} hours.
          </p>

          <div className="max-h-56 overflow-y-auto rounded-md border border-white/5">
            <table className="w-full text-xs tabular-nums">
              <thead className="sticky top-0 bg-espresso">
                <tr className="text-[9px] uppercase tracking-[0.18em] text-cream-dim">
                  <th className="px-3 py-2 text-left">Level</th>
                  <th className="px-3 py-2 text-left">From</th>
                  <th className="px-3 py-2 text-right">Small blind</th>
                  <th className="px-3 py-2 text-right">Big blind</th>
                </tr>
              </thead>
              <tbody>
                {levels.map((l) => (
                  <tr key={l.level} className="border-t border-white/5">
                    <td className="px-3 py-1.5 text-cream-dim">L{l.level}</td>
                    <td className="px-3 py-1.5 text-cream-dim">{formatLevelTime(l.startsAtMin)}</td>
                    <td className="px-3 py-1.5 text-right text-cream">{formatChips(l.smallBlind)}</td>
                    <td className="px-3 py-1.5 text-right text-brass">{formatChips(l.bigBlind)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn("w-full", applied && "border-win/60 text-win")}
            onClick={apply}
          >
            {applied ? "Applied" : "Use this structure (sets blinds + schedule for the TV clock)"}
          </Button>
        </div>
      )}
    </div>
  );
}
