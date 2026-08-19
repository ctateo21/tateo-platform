export interface QuoteRushClaimRow {
  leadId: number | null;
  status: string;
}

export type QuoteRushClaimResult =
  | { claimed: true }
  | { claimed: false; row: QuoteRushClaimRow | undefined };

/**
 * Attempts the database-backed unique-address claim. Only the request that
 * receives a returned row may continue to the paid QuoteRUSH submission.
 */
export async function claimQuoteRushAddress(
  insertPending: () => Promise<unknown[]>,
  findCurrent: () => Promise<QuoteRushClaimRow | undefined>,
): Promise<QuoteRushClaimResult> {
  const inserted = await insertPending();
  if (inserted.length > 0) return { claimed: true };
  return { claimed: false, row: await findCurrent() };
}