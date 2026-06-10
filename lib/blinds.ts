export interface BlindLevel {
  level: number;
  smallBlind: number;
  bigBlind: number;
  /** minutes from the start of the game */
  startsAtMin: number;
}

// "Nice" chip numbers: 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8 times a power of ten,
// never finer than 25-chip steps.
const NICE_MANTISSAS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

function roundToNice(value: number): number {
  if (value <= 25) return 25;
  const exp = Math.floor(Math.log10(value));
  const base = Math.pow(10, exp);
  let best = base * 10;
  let bestDiff = Infinity;
  for (const m of NICE_MANTISSAS) {
    const candidate = m * base;
    if (candidate % 25 !== 0) continue;
    const diff = Math.abs(candidate - value);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = candidate;
    }
  }
  return best;
}

/** Next nice value strictly above the given one. */
function nextNice(value: number): number {
  let v = roundToNice(value * 1.25);
  while (v <= value) v = roundToNice(v * 1.5);
  return v;
}

/**
 * Generate a tournament-style escalating blind schedule.
 *
 * Heuristics: the game starts ~100 big blinds deep and ends when the big
 * blind reaches ~1/20 of all chips in play (forces a finish on time).
 * Levels grow geometrically between those two anchors.
 */
export function generateBlindStructure(opts: {
  stackChips: number;
  players: number;
  durationMin: number;
  levelMin: number;
}): BlindLevel[] {
  const stackChips = Math.max(100, opts.stackChips);
  const players = Math.max(2, opts.players);
  const levelMin = Math.max(5, opts.levelMin);
  const durationMin = Math.max(levelMin, opts.durationMin);

  const levelCount = Math.max(1, Math.round(durationMin / levelMin));
  const startBB = roundToNice(stackChips / 100);
  const endBB = Math.max(nextNice(startBB), roundToNice((stackChips * players) / 20));

  const ratio =
    levelCount > 1 ? Math.pow(endBB / startBB, 1 / (levelCount - 1)) : 1;

  const levels: BlindLevel[] = [];
  let prevBB = 0;
  for (let i = 0; i < levelCount; i++) {
    let bb = roundToNice(startBB * Math.pow(ratio, i));
    if (bb <= prevBB) bb = nextNice(prevBB);
    const sb = Math.max(25, roundToNice(bb / 2));
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

export function structureAsText(levels: BlindLevel[], levelMin: number): string {
  const lines = levels.map(
    (l) =>
      `L${l.level} (${formatLevelTime(l.startsAtMin)}) — ${l.smallBlind} / ${l.bigBlind}`
  );
  return `Blind structure (${levelMin} min levels):\n${lines.join("\n")}`;
}
