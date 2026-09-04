export function formatAprParenthetical(aprPct: number): string {
  return `(APR ${aprPct.toFixed(3)}% - includes applicable fees)`;
}

export function formatInterestRateLabel(aprPct: number): string {
  return `Interest Rate ${formatAprParenthetical(aprPct)}`;
}