export interface QuoteRushCacheCandidate {
  agencyDefaultSnapshot?: unknown;
  assumptions?: unknown;
}

/**
 * Transitional safety guard for databases that still contain rows created by
 * the withdrawn private-scope model. It deliberately does not inspect
 * cache_scope: paid-cache identity is address + policy type only.
 */
export function isReusableSharedQuoteCandidate(
  row: QuoteRushCacheCandidate,
): boolean {
  const snapshot =
    row.agencyDefaultSnapshot &&
    typeof row.agencyDefaultSnapshot === "object"
      ? row.agencyDefaultSnapshot as Record<string, unknown>
      : {};
  const effectiveDate =
    snapshot.policyEffectiveDate &&
    typeof snapshot.policyEffectiveDate === "object"
      ? snapshot.policyEffectiveDate as Record<string, unknown>
      : {};
  if (effectiveDate.source === "current-policy-expiration") return false;

  return !(
    Array.isArray(row.assumptions) &&
    row.assumptions.some(
      assumption =>
        typeof assumption === "string" &&
        assumption.includes("private to your account"),
    )
  );
}

export function selectReusableSharedQuoteCandidate<
  T extends QuoteRushCacheCandidate,
>(rows: T[]): T | undefined {
  return rows.find(isReusableSharedQuoteCandidate);
}