// Texas Hold'em hand evaluation: best 5 of 7 cards, lexicographic scores.

export type Suit = "s" | "h" | "d" | "c";

export interface PlayingCard {
  /** 2–14, ace high */
  rank: number;
  suit: Suit;
}

export const SUITS: Suit[] = ["s", "h", "d", "c"];
export const RANKS: number[] = [14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2];

export const SUIT_GLYPH: Record<Suit, string> = { s: "♠", h: "♥", d: "♦", c: "♣" };
export const RED_SUITS: ReadonlySet<Suit> = new Set(["h", "d"]);

export function rankLabel(rank: number): string {
  return { 14: "A", 13: "K", 12: "Q", 11: "J" }[rank] ?? String(rank);
}

const RANK_WORD: Record<number, string> = {
  14: "Ace", 13: "King", 12: "Queen", 11: "Jack", 10: "Ten", 9: "Nine",
  8: "Eight", 7: "Seven", 6: "Six", 5: "Five", 4: "Four", 3: "Three", 2: "Two",
};

function plural(rank: number): string {
  const w = RANK_WORD[rank]!;
  return w === "Six" ? "Sixes" : `${w}s`;
}

export function cardKey(c: PlayingCard): string {
  return `${c.rank}${c.suit}`;
}

/**
 * Score a 5-card hand as [category, tiebreakers...] — compare
 * lexicographically. Categories: 8 straight flush … 0 high card.
 */
function score5(cards: PlayingCard[]): number[] {
  const ranks = cards.map((c) => c.rank).sort((a, b) => b - a);
  const flush = cards.every((c) => c.suit === cards[0]!.suit);

  // Straight: 5 distinct descending ranks, with A-5 wheel as the special case
  const distinct = [...new Set(ranks)];
  let straightHigh = 0;
  if (distinct.length === 5) {
    if (distinct[0]! - distinct[4]! === 4) straightHigh = distinct[0]!;
    else if (distinct.join(",") === "14,5,4,3,2") straightHigh = 5;
  }

  // Group ranks by count, order by count then rank (e.g. full house: trips first)
  const counts = new Map<number, number>();
  for (const r of ranks) counts.set(r, (counts.get(r) ?? 0) + 1);
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const shape = groups.map(([, n]) => n).join("");
  const ordered = groups.map(([r]) => r);

  if (flush && straightHigh) return [8, straightHigh];
  if (shape === "41") return [7, ...ordered];
  if (shape === "32") return [6, ...ordered];
  if (flush) return [5, ...ranks];
  if (straightHigh) return [4, straightHigh];
  if (shape === "311") return [3, ...ordered];
  if (shape === "221") return [2, ...ordered];
  if (shape === "2111") return [1, ...ordered];
  return [0, ...ranks];
}

export function compareScores(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

function describe(score: number[]): string {
  const [cat, a, b] = score as [number, number, number];
  switch (cat) {
    case 8:
      return a === 14 ? "Royal Flush" : `Straight Flush, ${RANK_WORD[a!]} high`;
    case 7:
      return `Four of a Kind, ${plural(a!)}`;
    case 6:
      return `Full House, ${plural(a!)} full of ${plural(b!)}`;
    case 5:
      return `Flush, ${RANK_WORD[a!]} high`;
    case 4:
      return `Straight, ${RANK_WORD[a!]} high`;
    case 3:
      return `Three of a Kind, ${plural(a!)}`;
    case 2:
      return `Two Pair, ${plural(a!)} and ${plural(b!)}`;
    case 1:
      return `Pair of ${plural(a!)}`;
    default:
      return `${RANK_WORD[a!]} high`;
  }
}

export interface HandResult {
  score: number[];
  name: string;
  /** the winning 5 cards out of the 7 */
  best: PlayingCard[];
}

/** Best 5-card hand from 7 cards (2 hole + 5 board). */
export function evaluate7(cards: PlayingCard[]): HandResult {
  let bestScore: number[] | null = null;
  let bestCards: PlayingCard[] = [];
  // All 21 ways to drop 2 of the 7
  for (let drop1 = 0; drop1 < 7; drop1++) {
    for (let drop2 = drop1 + 1; drop2 < 7; drop2++) {
      const five = cards.filter((_, i) => i !== drop1 && i !== drop2);
      const s = score5(five);
      if (!bestScore || compareScores(s, bestScore) > 0) {
        bestScore = s;
        bestCards = five;
      }
    }
  }
  return { score: bestScore!, name: describe(bestScore!), best: bestCards };
}
