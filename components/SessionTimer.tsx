"use client";

import { useEffect, useState } from "react";
import {
  blindElapsedMs,
  isBlindPaused,
  levelAt,
  nextLevel,
  planOf,
  realLevelCount,
} from "@/lib/blindSchedule";
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

/**
 * Player-view timer. With a blind schedule it shows the current level
 * (e.g. "Level 1/9 · 25/50") counting down to the next blind increase;
 * without one it shows time elapsed at the table.
 */
export function SessionTimer({ session }: { session: Session }) {
  const plan = planOf(session);
  const paused = isBlindPaused(session);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  let label = "At the table";
  let value = "—";

  if (now !== null && session.started_at) {
    const elapsedSec = Math.floor((now - new Date(session.started_at).getTime()) / 1000);
    value = clock(elapsedSec);

    if (plan) {
      const blindSec = Math.floor(blindElapsedMs(session, now) / 1000);
      const current = levelAt(plan, blindSec / 60);
      if (current) {
        const next = nextLevel(plan, current);
        label = current.isBreak
          ? `Break${next && !next.isBreak ? ` · back at ${formatChips(next.smallBlind)}/${formatChips(next.bigBlind)}` : ""}`
          : `Level ${current.level}/${realLevelCount(plan)} · ${formatChips(current.smallBlind)}/${formatChips(current.bigBlind)}`;
        value = paused ? "Paused" : next ? clock(next.startsAtMin * 60 - blindSec) : "Final level";
      }
    }
  }

  return (
    <div className="text-right">
      <p className="text-[10px] uppercase tracking-[0.2em] text-cream-dim">{label}</p>
      <p className="font-display text-2xl text-brass tabular-nums leading-none mt-0.5">{value}</p>
    </div>
  );
}
