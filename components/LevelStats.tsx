"use client";

import { useEffect, useState, useTransition } from "react";
import { pauseBlindClock, resumeBlindClock } from "@/lib/actions";
import {
  blindElapsedMs,
  isBlindPaused,
  levelAt,
  nextLevel,
  planOf,
} from "@/lib/blindSchedule";
import { cn } from "@/lib/cn";
import { formatChips } from "@/lib/format";
import { Session } from "@/lib/types";

function clock(totalSec: number): string {
  const s = Math.max(0, totalSec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${m}:${String(sec).padStart(2, "0")}`;
}

function Cell({
  label,
  value,
  tone,
  children,
}: {
  label: string;
  value: string;
  tone?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="px-5 py-4">
      <p className="text-[10px] uppercase tracking-[0.2em] text-cream-dim">{label}</p>
      <p className={cn("mt-1 font-display text-2xl tabular-nums", tone ?? "text-cream")}>
        {value}
      </p>
      {children}
    </div>
  );
}

/**
 * Live blind cells for the totals bar: current blind, level (e.g. 1/8) and
 * time until the next blind increase, with a host pause/resume control.
 */
export function LevelStats({ session }: { session: Session }) {
  const plan = planOf(session);
  const paused = isBlindPaused(session);
  const [now, setNow] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  let blind = `${formatChips(session.small_blind)}/${formatChips(session.big_blind)}`;
  let level = "—";
  let untilNext = "—";
  const running = session.status === "active" && session.started_at && now !== null;

  if (plan) {
    if (running) {
      const elapsedSec = Math.floor(blindElapsedMs(session, now) / 1000);
      const current = levelAt(plan, elapsedSec / 60);
      if (current) {
        const next = nextLevel(plan, current);
        blind = `${formatChips(current.smallBlind)}/${formatChips(current.bigBlind)}`;
        level = `${current.level}/${plan.levels.length}`;
        untilNext = paused
          ? "Paused"
          : next
            ? clock(next.startsAtMin * 60 - elapsedSec)
            : "Final level";
      }
    } else {
      const first = plan.levels[0];
      if (first) {
        blind = `${formatChips(first.smallBlind)}/${formatChips(first.bigBlind)}`;
        level = `1/${plan.levels.length}`;
      }
    }
  }

  return (
    <>
      <Cell label="Current blind" value={blind} />
      <Cell label="Level" value={level} />
      <Cell label="Next blind in" value={untilNext} tone={paused ? "text-loss" : undefined}>
        {plan && session.status === "active" && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await (paused ? resumeBlindClock(session.id) : pauseBlindClock(session.id));
              })
            }
            className="mt-1 cursor-pointer text-[10px] uppercase tracking-[0.15em] text-cream-dim transition hover:text-brass disabled:opacity-40"
          >
            {paused ? "▶ Resume" : "⏸ Pause"}
          </button>
        )}
      </Cell>
    </>
  );
}
