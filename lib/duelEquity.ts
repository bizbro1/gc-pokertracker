// Stage-by-stage win equity for a duel runout, computed from the spectator's
// view at each street: only the cards revealed so far are known, the rest of
// the deck is live. Flop and turn are exact enumerations; pre-flop uses
// Monte Carlo (1.7M exact boards is too slow for a TV frame).

import { cardKey, compareScores, evaluate7, PlayingCard, RANKS, SUITS } from "./poker";
import { DuelDeal } from "./types";

export interface Equity {
  /** percentages; ties counted half each, so a + b === 100 */
  a: number;
  b: number;
}

export interface DuelEquities {
  preflop: Equity;
  flop: Equity;
  turn: Equity;
}

function tally(holeA: PlayingCard[], holeB: PlayingCard[], board: PlayingCard[]) {
  const cmp = compareScores(
    evaluate7([...holeA, ...board]).score,
    evaluate7([...holeB, ...board]).score
  );
  return cmp > 0 ? [1, 0] : cmp < 0 ? [0, 1] : [0.5, 0.5];
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

export function duelEquities(deal: DuelDeal): DuelEquities {
  const [holeA, holeB] = deal.holes;

  // Pre-flop: Monte Carlo over 5-card boards from the 48 unseen cards
  const pre = liveDeck(deal, 0);
  const SAMPLES = 2500;
  let aPre = 0;
  for (let s = 0; s < SAMPLES; s++) {
    // partial Fisher-Yates: first 5 of a fresh shuffle
    const deck = pre.slice();
    for (let i = 0; i < 5; i++) {
      const j = i + Math.floor(Math.random() * (deck.length - i));
      [deck[i], deck[j]] = [deck[j]!, deck[i]!];
    }
    aPre += tally(holeA, holeB, deck.slice(0, 5))[0]!;
  }

  // Flop: exact over C(45,2) turn/river pairs
  const flop = deal.board.slice(0, 3);
  const liveFlop = liveDeck(deal, 3);
  let aFlop = 0;
  let nFlop = 0;
  for (let i = 0; i < liveFlop.length; i++)
    for (let j = i + 1; j < liveFlop.length; j++) {
      aFlop += tally(holeA, holeB, [...flop, liveFlop[i]!, liveFlop[j]!])[0]!;
      nFlop++;
    }

  // Turn: exact over the 44 possible rivers
  const four = deal.board.slice(0, 4);
  const liveTurn = liveDeck(deal, 4);
  let aTurn = 0;
  for (const river of liveTurn) aTurn += tally(holeA, holeB, [...four, river])[0]!;

  return {
    preflop: toEquity(aPre, SAMPLES),
    flop: toEquity(aFlop, nFlop),
    turn: toEquity(aTurn, liveTurn.length),
  };
}
