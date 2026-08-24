export interface StatementRefreshFields {
  loanNumber?: string;
  currentEscrowBalance?: number;
}

export interface StatementRefreshAnalysis {
  loanNumber?: string | null;
  currentEscrowBalance?: number | null;
}

/** Merge only reliable values from a newly uploaded mortgage statement.
 * Missing extraction values never erase previously saved loan data. */
export function mergeStatementRefresh<T extends StatementRefreshFields>(
  existing: T,
  analysis: StatementRefreshAnalysis,
): T {
  const incomingLoanNumber = typeof analysis.loanNumber === "string"
    ? analysis.loanNumber.trim()
    : "";
  const incomingEscrowBalance =
    typeof analysis.currentEscrowBalance === "number"
    && Number.isFinite(analysis.currentEscrowBalance)
    && analysis.currentEscrowBalance >= 0
      ? analysis.currentEscrowBalance
      : undefined;

  return {
    ...existing,
    ...(incomingLoanNumber ? { loanNumber: incomingLoanNumber } : {}),
    ...(incomingEscrowBalance !== undefined
      ? { currentEscrowBalance: incomingEscrowBalance }
      : {}),
  };
}