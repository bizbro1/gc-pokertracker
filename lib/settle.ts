export interface Balance {
  id: string;
  /** net result in cash: positive is owed money, negative owes money */
  amount: number;
}

export interface Transfer {
  fromId: string;
  toId: string;
  amount: number;
}

const EPSILON = 0.005;

/**
 * Turn net results into the fewest sensible payments: repeatedly match the
 * biggest debtor with the biggest creditor. Guarantees at most n−1 transfers
 * and keeps each one as large as possible.
 */
export function settle(balances: Balance[]): Transfer[] {
  const creditors = balances
    .filter((b) => b.amount > EPSILON)
    .map((b) => ({ ...b }))
    .sort((a, b) => b.amount - a.amount);
  const debtors = balances
    .filter((b) => b.amount < -EPSILON)
    .map((b) => ({ id: b.id, amount: -b.amount }))
    .sort((a, b) => b.amount - a.amount);

  const transfers: Transfer[] = [];
  let ci = 0;
  let di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const creditor = creditors[ci]!;
    const debtor = debtors[di]!;
    const amount = Math.min(creditor.amount, debtor.amount);
    if (amount > EPSILON) {
      transfers.push({
        fromId: debtor.id,
        toId: creditor.id,
        amount: Math.round(amount * 100) / 100,
      });
    }
    creditor.amount -= amount;
    debtor.amount -= amount;
    if (creditor.amount <= EPSILON) ci++;
    if (debtor.amount <= EPSILON) di++;
  }
  return transfers;
}
