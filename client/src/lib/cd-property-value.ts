export function isCdPurchasePriceLocked(loan: {
  entryMethod?: string;
  originalPurchasePrice?: number;
}): boolean {
  return loan.entryMethod === "closing_disclosure"
    && typeof loan.originalPurchasePrice === "number"
    && Number.isFinite(loan.originalPurchasePrice)
    && loan.originalPurchasePrice > 0;
}