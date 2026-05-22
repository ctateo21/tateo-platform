import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface MortgageAnalysis {
  loanBalance: number;
  interestRate: number;
  monthlyPayment: number;
  principalAndInterest: number;
  escrowAmount: number;
  propertyAddress: string;
  lender: string;
  estimatedRemainingYears: number;
  estimatedHomeValue: number;
  /** Servicer loan/account number as printed on the statement.
   *  Stored as text to preserve leading zeros and any dashes.
   *  `null` when the statement does not show one (or it could not be
   *  reliably distinguished from a phone number, zip, escrow account,
   *  confirmation number, etc.). */
  loanNumber: string | null;
  confidence: "high" | "medium" | "low";
  recommendation: string;
  potentialSavings: number;
  rawExtractedData: Record<string, string | number>;
}

// Trim, collapse internal whitespace, preserve leading zeros and any
// dashes. Returns null for empty / placeholder values so callers can
// safely fall back to an existing saved loan number.
function normalizeLoanNumber(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).replace(/\s+/g, " ").trim();
  if (!s) return null;
  if (/^(n\/?a|none|null|unknown|not\s*found|--+)$/i.test(s)) return null;
  return s;
}

export async function analyzeMortgageStatement(documentText: string): Promise<MortgageAnalysis> {
  const systemPrompt = `You are a mortgage document analyzer. Extract key information from mortgage statements and provide refinancing recommendations.

You must respond with a valid JSON object containing the following fields:
- loanBalance: number (the unpaid principal balance - extract exactly from document)
- interestRate: number (the current interest rate as a decimal, e.g., 4.875 for 4.875%)
- monthlyPayment: number (total monthly payment including escrow)
- principalAndInterest: number (just the P&I portion without escrow)
- escrowAmount: number (taxes and insurance portion)
- propertyAddress: string (full property address as shown in document)
- lender: string (the mortgage servicer/lender name)
- estimatedRemainingYears: number (estimate based on loan balance, rate, and P&I payment)
- estimatedHomeValue: number (estimate the current market value of the property)
- loanNumber: string | null (the servicer's loan/account identifier as printed
  on the statement — look for labels such as "Loan Number", "Loan No.",
  "Loan #", "Account Number", "Account No.", "Mortgage Account Number",
  "Servicer Loan Number", or a "Reference Number" that is clearly the
  mortgage loan ID. Return it as a STRING exactly as printed so leading
  zeros and dashes are preserved. Do NOT use phone numbers, payment
  amounts, zip codes, property tax IDs, escrow account numbers, or
  confirmation numbers. Return null if no loan number is clearly present.)
- confidence: "high" | "medium" | "low"
- recommendation: string (compare extracted rate to current market rates of 6.5-7% for 30-year fixed)
- potentialSavings: number (monthly savings if refinancing is recommended, else 0)
- rawExtractedData: object with any other relevant fields

Respond with a JSON object only, no additional text.`;

  const response = await anthropic.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: "user", content: `Analyze this mortgage statement:\n\n${documentText}` }],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("No response from AI");
  const raw = content.text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const parsed = JSON.parse(raw) as MortgageAnalysis;
  // Normalize defensively — the model occasionally returns numbers or
  // empty strings even when the spec says string|null.
  parsed.loanNumber = normalizeLoanNumber((parsed as any).loanNumber);
  return parsed;
}
