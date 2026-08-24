import {
  paymentsMadeFromFirstPaymentDate,
  remainingBalance,
} from "./amortization";
import { amortizeBalance, monthsBetween } from "./refi-calculations";

interface BalanceLoan {
  entryMethod?: string;
  firstPaymentDate?: string;
  originalLoanAmount?: number;
  originalRate?: number;
  originalTermMonths?: number;
  balanceAsOf?: string;
  addedAt: string;
  loanBalance: number;
  currentRate: number;
  currentPI: number;
}

export function resolveTrackedLoanBalance(
  loan: BalanceLoan,
  now: Date = new Date(),
): { currentBalance: number; elapsedPayments: number } {
  const isScheduledCdLoan = loan.entryMethod === "closing_disclosure"
    && !!loan.firstPaymentDate
    && (loan.originalLoanAmount ?? 0) > 0
    && (loan.originalRate ?? 0) > 0
    && (loan.originalTermMonths ?? 0) > 0;

  if (isScheduledCdLoan) {
    const elapsedPayments = paymentsMadeFromFirstPaymentDate(
      loan.firstPaymentDate!,
      now,
    );
    return {
      elapsedPayments,
      currentBalance: remainingBalance(
        loan.originalLoanAmount!,
        loan.originalRate!,
        loan.originalTermMonths!,
        elapsedPayments,
      ),
    };
  }

  const elapsedPayments = monthsBetween(loan.balanceAsOf ?? loan.addedAt, now);
  return {
    elapsedPayments,
    currentBalance: elapsedPayments > 0 && loan.currentPI > 0
      ? amortizeBalance(
          loan.loanBalance,
          loan.currentRate,
          loan.currentPI,
          elapsedPayments,
        )
      : loan.loanBalance,
  };
}