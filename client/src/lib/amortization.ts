// ─── Amortization helpers ───────────────────────────────────────────
// Standard fixed-rate amortization math shared by the Refinance tab's
// manual-entry verification and the Closing Disclosure flow (which has
// to derive today's balance from origination details).

/** Monthly principal & interest for a fixed-rate loan. */
export function monthlyPI(principal: number, annualRatePct: number, termMonths: number): number {
  if (!(principal > 0) || !(termMonths > 0)) return 0;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return principal / termMonths;
  const f = Math.pow(1 + r, termMonths);
  return (principal * r * f) / (f - 1);
}

/** Remaining balance after `monthsElapsed` scheduled payments. */
export function remainingBalance(
  principal: number,
  annualRatePct: number,
  termMonths: number,
  monthsElapsed: number,
): number {
  if (!(principal > 0) || !(termMonths > 0)) return 0;
  const n = Math.min(Math.max(0, Math.floor(monthsElapsed)), termMonths);
  const r = annualRatePct / 100 / 12;
  if (r === 0) return principal * (1 - n / termMonths);
  const f = Math.pow(1 + r, termMonths);
  const fn = Math.pow(1 + r, n);
  // B_n = P * (f - fn) / (f - 1)
  return Math.max(0, (principal * (f - fn)) / (f - 1));
}

/** Whole months elapsed from an ISO date (or Date) to now.
 *  First payment is typically due ~1 month after closing, so we count
 *  full months since the closing/purchase date minus one (payments made
 *  = months since closing − 1, floored at 0). */
export function paymentsMadeSince(closingDate: string | Date, now: Date = new Date()): number {
  const d = typeof closingDate === "string" ? new Date(closingDate) : closingDate;
  if (isNaN(d.getTime())) return 0;
  let months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  if (now.getDate() < d.getDate()) months -= 1;
  return Math.max(0, months - 1);
}

/** Estimated remaining years given payments already made. */
export function remainingYears(termMonths: number, monthsElapsed: number): number {
  return Math.max(0, (termMonths - monthsElapsed) / 12);
}
