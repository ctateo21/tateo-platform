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
  confidence: "high" | "medium" | "low";
  recommendation: string;
  potentialSavings: number;
  rawExtractedData: Record<string, string | number>;
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
  return JSON.parse(raw) as MortgageAnalysis;
}
