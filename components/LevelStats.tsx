"use client";

import { useEffect, useState, useTransition } from "react";
import { adjustBlindSchedule, BlindScheduleOp, pauseBlindClock, resumeBlindClock } from "@/lib/actions";
import {
  blindElapsedMs,
  isBlindPaused,
  levelAt,
  nextLevel,
  planOf,
  realLevelCount,
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
 * time until the next blind increase — with host clock controls: pause,
 * extend the level, skip ahead, or call a break.
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
  let onBreak = false;
  const running = session.status === "active" && session.started_at && now !== null;

  if (plan) {
    const total = realLevelCount(plan);
    if (running) {
      const elapsedSec = Math.floor(blindElapsedMs(session, now) / 1000);
      const current = levelAt(plan, elapsedSec / 60);
      if (current) {
        const next = nextLevel(plan, current);
        onBreak = !!current.isBreak;
        blind = onBreak
          ? "Break"
          : `${formatChips(current.smallBlind)}/${formatChips(current.bigBlind)}`;
        level = onBreak ? "—" : `${current.level}/${total}`;
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
        level = `1/${total}`;
      }
    }
  }

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok && res.error) alert(res.error);
    });
  }
  const adjust = (op: BlindScheduleOp) => run(() => adjustBlindSchedule(session.id, op));

  const btn =
    "cursor-pointer rounded px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-cream-dim transition hover:bg-white/5 hover:text-brass disabled:opacity-40";

  return (
    <>
      <Cell label="Current blind" value={blind} tone={onBreak ? "text-brass" : undefined} />
      <Cell label="Level" value={level} />
      <Cell label="Next blind in" value={untilNext} tone={paused ? "text-loss" : undefined}>
        {plan && session.status === "active" && (
          <div className="mt-1 flex flex-wrap gap-1">
            <button
              type="button"
              disabled={pending}
              className={btn}
              onClick={() =>
                run(() => (paused ? resumeBlindClock(session.id) : pauseBlindClock(session.id)))
              }
            >
              {paused ? "▶ Resume" : "⏸ Pause"}
            </button>
            <button
              type="button"
              disabled={pending}
              className={btn}
              title="Add 5 minutes to the current level"
              onClick={() => adjust({ type: "extend", minutes: 5 })}
            >
              +5m
            </button>
            <button
              type="button"
              disabled={pending}
              className={btn}
              title="Jump to the next level now"
              onClick={() => adjust({ type: "skip" })}
            >
              Skip
            </button>
            <button
              type="button"
              disabled={pending}
              className={btn}
              title="15 minute break after this level"
              onClick={() => adjust({ type: "break", minutes: 15 })}
            >
              Break
            </button>
          </div>
        )}
      </Cell>
    </>
  );
}
