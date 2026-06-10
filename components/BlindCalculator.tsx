"use client";

import { useMemo, useState } from "react";
import { generateBlindStructure, formatLevelTime, structureAsText } from "@/lib/blinds";
import { formatChips } from "@/lib/format";
import { Button, Input, Select } from "@/components/ui";
import { cn } from "@/lib/cn";

export function BlindCalculator({
  stackChips,
  onApply,
}: {
  /** chips a player gets for the default buy-in */
  stackChips: number;
  onApply: (smallBlind: number, bigBlind: number, scheduleText: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [players, setPlayers] = useState(6);
  const [durationH, setDurationH] = useState(4);
  const [levelMin, setLevelMin] = useState(20);
  const [applied, setApplied] = useState(false);

  const levels = useMemo(
    () =>
      generateBlindStructure({
        stackChips,
        players,
        durationMin: durationH * 60,
        levelMin,
      }),
    [stackChips, players, durationH, levelMin]
  );

  function apply() {
    const first = levels[0];
    if (!first) return;
    onApply(first.smallBlind, first.bigBlind, structureAsText(levels, levelMin));
    setApplied(true);
    setTimeout(() => setApplied(false), 2500);
  }

  return (
    <div className="rounded-md border hairline bg-ink/40">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left cursor-pointer"
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
        <div className="border-t hairline px-4 py-4 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="mb-1.5 text-[10px] uppercase tracking-[0.18em] text-cream-dim">
                Players
              </p>
              <Input
                type="number"
                min={2}
                max={10}
                value={players}
                onChange={(e) => setPlayers(Number(e.target.value) || 2)}
              />
            </div>
            <div>
              <p className="mb-1.5 text-[10px] uppercase tracking-[0.18em] text-cream-dim">
                Game length
              </p>
              <Select value={durationH} onChange={(e) => setDurationH(Number(e.target.value))}>
                {[2, 3, 4, 5, 6, 7, 8].map((h) => (
                  <option key={h} value={h}>
                    {h} hours
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <p className="mb-1.5 text-[10px] uppercase tracking-[0.18em] text-cream-dim">
                Level length
              </p>
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
            Based on a {formatChips(stackChips)}-chip starting stack: play opens
            ~{Math.round(stackChips / (levels[0]?.bigBlind || 1))} big blinds deep
            and the schedule pushes towards a finish in about {durationH} hours.
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

          <Button type="button" variant="outline" size="sm" className="w-full" onClick={apply}>
            {applied ? "Applied" : "Use this structure (sets blinds + adds schedule to notes)"}
          </Button>
        </div>
      )}
    </div>
  );
}
