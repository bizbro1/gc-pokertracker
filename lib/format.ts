export function formatCash(amount: number, currency: string): string {
  const decimals = Math.abs(amount % 1) > 0.005 ? 2 : 0;
  try {
    return new Intl.NumberFormat("nb-NO", {
      style: "currency",
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(amount);
  } catch {
    return `${amount.toFixed(decimals)} ${currency}`;
  }
}

export function formatChips(chips: number): string {
  return new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 }).format(chips);
}

export function formatSignedCash(amount: number, currency: string): string {
  const s = formatCash(Math.abs(amount), currency);
  return amount >= 0 ? `+${s}` : `\u2212${s}`;
}
