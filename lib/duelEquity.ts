// Per-street win equity for a duel runout, from the spectator's view: only
// the board cards revealed so far are known, the rest of the deck is live.
// With 1-2 cards to come the enumeration is exact; with 3+ to come it's
// Monte Carlo (exact would be millions of boards).

import { cardKey, compareScores, evaluate7, PlayingCard, RANKS, SUITS } from "./poker";
import { DuelDeal } from "./types";

export interface Equity {
  /** percentages; ties counted half each, so a + b === 100 */
  a: number;
  b: number;
}

const MC_SAMPLES = 1500;

function tally(holeA: PlayingCard[], holeB: PlayingCard[], board: PlayingCard[]) {
  const cmp = compareScores(
    evaluate7([...holeA, ...board]).score,
    evaluate7([...holeB, ...board]).score
  );
  return cmp > 0 ? 1 : cmp < 0 ? 0 : 0.5;
}

function toEquity(aWins: number, total: number): Equity {
  const a = (aWins / total) * 100;
  return { a: Math.round(a), b: Math.round(100 - a) };
}

/** Cards still unseen at a street: full deck minus holes and revealed board. */
function liveDeck(deal: DuelDeal, revealed: number): PlayingCard[] {
  const known = new Set(
    [...deal.holes[0], ...deal.holes[1], ...deal.board.slice(0, revealed)].map(cardKey)
  );
  const deck: PlayingCard[] = [];
  for (const suit of SUITS)
    for (const rank of RANKS) {
      const c = { rank, suit };
      if (!known.has(cardKey(c))) deck.push(c);
    }
  return deck;
}

function equityAt(deal: DuelDeal, revealed: number): Equity {
  const [holeA, holeB] = deal.holes;
  const partial = deal.board.slice(0, revealed);
  const live = liveDeck(deal, revealed);
  const need = 5 - revealed;

  let aWins = 0;
  let total = 0;

  if (need === 1) {
    for (const c of live) {
      aWins += tally(holeA, holeB, [...partial, c]);
      total++;
    }
  } else if (need === 2) {
    for (let i = 0; i < live.length; i++)
      for (let j = i + 1; j < live.length; j++) {
        aWins += tally(holeA, holeB, [...partial, live[i]!, live[j]!]);
        total++;
      }
  } else {
    for (let s = 0; s < MC_SAMPLES; s++) {
      // partial Fisher-Yates: first `need` of a fresh shuffle
      const deck = live.slice();
      for (let i = 0; i < need; i++) {
        const j = i + Math.floor(Math.random() * (deck.length - i));
        [deck[i], deck[j]] = [deck[j]!, deck[i]!];
      }
      aWins += tally(holeA, holeB, [...partial, ...deck.slice(0, need)]);
      total++;
    }
  }

  return toEquity(aWins, total);
}

/**
 * equities[r] = win equity with r board cards revealed, r = 0..4 — one
 * fresh number after every single card. The 5th card decides the winner.
 */
export function duelEquities(deal: DuelDeal): Equity[] {
  return [0, 1, 2, 3, 4].map((r) => equityAt(deal, r));
}
