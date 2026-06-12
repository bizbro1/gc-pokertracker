import { BlindLevel, BlindPlan, Session } from "./types";

export type { BlindLevel, BlindPlan };

// Schedules live in sessions.blind_schedule (jsonb) since migration 0002.
// Older sessions stored them as text in notes — parseBlindPlan keeps those
// working as a fallback:
//
//   Blind structure (20 min levels):
//   L1 (0:00) — 25 / 50

const HEADER_RE = /Blind structure \((\d+)\s*min levels\):/i;
const LEVEL_RE = /L(\d+)\s*\((\d+):(\d{2})\)\s*[—–-]\s*(\d+)\s*\/\s*(\d+)/g;

export function parseBlindPlan(notes: string): BlindPlan | null {
  const header = notes.match(HEADER_RE);
  if (!header) return null;
  const levelMin = Number(header[1]);

  const levels: BlindLevel[] = [];
  for (const m of notes.matchAll(LEVEL_RE)) {
    levels.push({
      level: Number(m[1]),
      startsAtMin: Number(m[2]) * 60 + Number(m[3]),
      smallBlind: Number(m[4]),
      bigBlind: Number(m[5]),
    });
  }
  if (levels.length === 0) return null;
  levels.sort((a, b) => a.startsAtMin - b.startsAtMin);
  return { levelMin, levels };
}

/** The session's blind plan: the jsonb column, falling back to notes text. */
export function planOf(session: Session): BlindPlan | null {
  const stored = session.blind_schedule;
  if (stored && Array.isArray(stored.levels) && stored.levels.length > 0) return stored;
  return parseBlindPlan(session.notes ?? "");
}

export function isBlindPaused(session: Session): boolean {
  return !!session.blind_paused_at;
}

/**
 * Milliseconds on the blind clock: wall time since start, minus accumulated
 * pauses; frozen at the pause point while paused and at end once ended.
 */
export function blindElapsedMs(session: Session, now: number): number {
  if (!session.started_at) return 0;
  const start = new Date(session.started_at).getTime();
  const stop = session.blind_paused_at
    ? new Date(session.blind_paused_at).getTime()
    : session.status === "ended" && session.ended_at
      ? new Date(session.ended_at).getTime()
      : now;
  return Math.max(0, stop - start - (session.blind_paused_ms ?? 0));
}

/** The level in play at the given elapsed time, or null before the first level. */
export function levelAt(plan: BlindPlan, elapsedMin: number): BlindLevel | null {
  let cur: BlindLevel | null = null;
  for (const l of plan.levels) {
    if (l.startsAtMin <= elapsedMin) cur = l;
    else break;
  }
  return cur ?? plan.levels[0] ?? null;
}

export function nextLevel(plan: BlindPlan, current: BlindLevel): BlindLevel | null {
  // Position-based: breaks don't carry unique level numbers
  const i = plan.levels.findIndex(
    (l) => l.startsAtMin === current.startsAtMin && l.level === current.level
  );
  return i >= 0 ? (plan.levels[i + 1] ?? null) : null;
}

/** How many actual blind levels the plan has (breaks excluded). */
export function realLevelCount(plan: BlindPlan): number {
  return plan.levels.filter((l) => !l.isBreak).length;
}
