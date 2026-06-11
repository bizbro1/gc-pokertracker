// Blind structure generator. A good structure raises the blinds gradually
// each level and forces the game to finish on time: play opens deep at the
// starting blind level and the last level's big blind reaches a fixed share
// of all chips in play (~1/20), at which point the game can't drag on.

export interface GeneratedLevel {
  level: number;
  smallBlind: number;
  bigBlind: number;
  /** minutes from the start of the game */
  startsAtMin: number;
}

// "Nice" chip numbers: 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8 times a power of ten.
const NICE_MANTISSAS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

/** Round to a nice chip number that the smallest denomination can pay. */
function roundToNice(value: number, denom: number): number {
  if (value <= denom) return denom;
  const exp = Math.floor(Math.log10(value));
  const base = Math.pow(10, exp);
  let best = 0;
  let bestDiff = Infinity;
  for (const m of NICE_MANTISSAS) {
    const candidate = m * base;
    if (candidate % denom !== 0) continue;
    const diff = Math.abs(candidate - value);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = candidate;
    }
  }
  // No nice number divisible by the denomination — nearest multiple instead
  return best || Math.max(denom, Math.round(value / denom) * denom);
}

/** Next nice value strictly above the given one. */
function nextNice(value: number, denom: number): number {
  // Bounded: rounding can tie back down to the same value (e.g. 50 × 1.5 = 75
  // rounds to 50 with a 25 denomination), so growing the multiplier from the
  // original value — with a hard fallback — guarantees progress.
  let mult = 1.25;
  for (let i = 0; i < 40; i++) {
    const v = roundToNice(value * mult, denom);
    if (v > value) return v;
    mult *= 1.4;
  }
  return Math.ceil((value + denom) / denom) * denom;
}

/**
 * Generate a tournament-style escalating blind schedule.
 *
 * Inputs: the starting small blind (usually the smallest chip denomination),
 * the estimated total chips in play (initial buy-ins plus expected rebuys and
 * add-ons), the target duration, and the level length. Levels grow
 * geometrically from the starting big blind to ~1/20 of all chips in play,
 * which pushes the game to finish on schedule.
 */
export function generateBlindStructure(opts: {
  startingSmallBlind: number;
  totalChips: number;
  durationMin: number;
  levelMin: number;
}): GeneratedLevel[] {
  const denom = Math.max(1, Math.round(opts.startingSmallBlind));
  const totalChips = Math.max(denom * 40, opts.totalChips);
  const levelMin = Math.max(5, opts.levelMin);
  const durationMin = Math.max(levelMin, opts.durationMin);

  const levelCount = Math.max(1, Math.round(durationMin / levelMin));
  const startBB = denom * 2;
  const endBB = Math.max(nextNice(startBB, denom), roundToNice(totalChips / 20, denom));

  const ratio = levelCount > 1 ? Math.pow(endBB / startBB, 1 / (levelCount - 1)) : 1;

  const levels: GeneratedLevel[] = [];
  let prevBB = 0;
  for (let i = 0; i < levelCount; i++) {
    let bb = roundToNice(startBB * Math.pow(ratio, i), denom);
    if (bb <= prevBB) bb = nextNice(prevBB, denom);
    const sb = Math.max(denom, roundToNice(bb / 2, denom));
    levels.push({
      level: i + 1,
      smallBlind: Math.min(sb, bb),
      bigBlind: bb,
      startsAtMin: i * levelMin,
    });
    prevBB = bb;
  }
  return levels;
}

export function formatLevelTime(startsAtMin: number): string {
  const h = Math.floor(startsAtMin / 60);
  const m = startsAtMin % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

/**
 * Render the schedule in the exact text format `parseBlindPlan` reads back
 * from session notes — this is what links the calculator to the TV clock.
 */
export function structureAsText(levels: GeneratedLevel[], levelMin: number): string {
  const lines = levels.map(
    (l) => `L${l.level} (${formatLevelTime(l.startsAtMin)}) — ${l.smallBlind} / ${l.bigBlind}`
  );
  return `Blind structure (${levelMin} min levels):\n${lines.join("\n")}`;
}

