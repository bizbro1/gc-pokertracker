import { Player, Session, Tx } from "./types";

export function chipsPerCash(s: Session): number {
  return s.chips_per_rate / s.cash_per_rate;
}

export function cashToChips(s: Session, cash: number): number {
  return Math.round(cash * chipsPerCash(s));
}

export function chipsToCash(s: Session, chips: number): number {
  return chips / chipsPerCash(s);
}

export interface PlayerStats {
  buyInCount: number;
  buyInCash: number;
  buyInChips: number;
  adjustChips: number;
  cashOutCash: number;
  cashOutChips: number;
  /** chips currently in front of the player */
  currentChips: number;
  /** cash value of currentChips */
  currentValue: number;
  /** realized + unrealized profit/loss in cash */
  pnl: number;
}

export function playerStats(session: Session, player: Player, txs: Tx[]): PlayerStats {
  const mine = txs.filter((t) => t.player_id === player.id);
  let buyInCount = 0,
    buyInCash = 0,
    buyInChips = 0,
    adjustChips = 0,
    cashOutCash = 0,
    cashOutChips = 0;

  for (const t of mine) {
    if (t.type === "buy_in") {
      buyInCount++;
      buyInCash += Number(t.cash_amount);
      buyInChips += Number(t.chip_amount);
    } else if (t.type === "cash_out") {
      cashOutCash += Number(t.cash_amount);
      cashOutChips += Number(t.chip_amount);
    } else {
      adjustChips += Number(t.chip_amount);
    }
  }

  const currentChips = buyInChips + adjustChips - cashOutChips;
  const currentValue = chipsToCash(session, currentChips);
  const pnl = cashOutCash + currentValue - buyInCash;

  return { buyInCount, buyInCash, buyInChips, adjustChips, cashOutCash, cashOutChips, currentChips, currentValue, pnl };
}

export interface SessionTotals {
  cashIn: number;
  chipsIssued: number;
  cashOut: number;
  chipsReturned: number;
  chipsInPlay: number;
  /** cash in − cash out − value of chips still in play; 0 means the bank balances */
  discrepancy: number;
}

export function sessionTotals(session: Session, players: Player[], txs: Tx[]): SessionTotals {
  let cashIn = 0,
    chipsIssued = 0,
    cashOut = 0,
    chipsReturned = 0,
    chipsInPlay = 0;

  for (const p of players) {
    const s = playerStats(session, p, txs);
    cashIn += s.buyInCash;
    chipsIssued += s.buyInChips + s.adjustChips;
    cashOut += s.cashOutCash;
    chipsReturned += s.cashOutChips;
    chipsInPlay += s.currentChips;
  }

  const discrepancy = cashIn - cashOut - chipsToCash(session, chipsInPlay);
  return { cashIn, chipsIssued, cashOut, chipsReturned, chipsInPlay, discrepancy };
}
