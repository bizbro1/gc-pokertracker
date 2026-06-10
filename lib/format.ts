// Hand-rolled formatting (Norwegian style: space groups, comma decimals).
// Intl output differs between Node and browsers, which breaks hydration.

function groupDigits(value: number, decimals: number): string {
  const fixed = Math.abs(value).toFixed(decimals);
  const [int, frac] = fixed.split(".");
  const grouped = int!.replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");
  return (value < 0 ? "\u2212" : "") + grouped + (frac ? `,${frac}` : "");
}

export function formatNumber(value: number, decimals = 0): string {
  return groupDigits(value, decimals);
}

export function formatCash(amount: number, currency: string): string {
  const decimals = Math.abs(amount % 1) > 0.005 ? 2 : 0;
  const suffix = currency === "NOK" ? "kr" : currency;
  return `${groupDigits(amount, decimals)}\u00A0${suffix}`;
}

export function formatChips(chips: number): string {
  return groupDigits(Math.round(chips), 0);
}

export function formatSignedCash(amount: number, currency: string): string {
  const s = formatCash(Math.abs(amount), currency);
  return amount >= 0 ? `+${s}` : `\u2212${s}`;
}
