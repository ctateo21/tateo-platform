import { FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { money, type FeeSection } from "@/lib/fee-worksheet";
import { PURCHASE_LENDER_INFO } from "@/lib/lender-info";
import type { RefinanceFeeWorksheet } from "@/lib/refinance-fee-worksheet";

function Section({ section }: { section: FeeSection }) {
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <h4 className="text-xs font-bold uppercase tracking-wide text-primary">{section.title}</h4>
        <span className="text-xs font-bold tabular-nums">{money(section.subtotal)}</span>
      </div>
      {section.lines.map((line, index) => (
        <div key={index} className="flex items-baseline justify-between gap-3 py-[3px]">
          <span className="text-xs leading-snug text-muted-foreground">
            {line.label}
            {line.note && <span className="ml-1 opacity-70">({line.note})</span>}
          </span>
          <span className="whitespace-nowrap text-xs tabular-nums">{money(line.amount)}</span>
        </div>
      ))}
    </div>
  );
}

export interface RefinanceFeeWorksheetMeta {
  address: string;
  purpose: "Rate & Term Refinance" | "Cash-Out Refinance";
  currentPayoff: number;
  baseNewLoanAmount: number;
  finalNewLoanAmount: number;
  ratePct: number;
  monthlyPI: number;
  financeFees: boolean;
}

export function RefinanceFeeWorksheetDialog({
  open,
  onOpenChange,
  worksheet,
  meta,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  worksheet: RefinanceFeeWorksheet;
  meta: RefinanceFeeWorksheetMeta;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto" data-testid="dialog-refinance-fee-worksheet">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <FileText className="h-5 w-5" />
            Initial Refinance Fees Worksheet
          </DialogTitle>
          <DialogDescription className="text-[11px]">
            Refinance costs differ from purchase costs. This estimate includes an estimated principal payoff, lender/title charges,
            recording, prepaid interest, and optional escrow funding; it excludes down payment and purchase-only costs.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 rounded-md border border-primary/20 bg-primary/5 p-3 text-xs sm:grid-cols-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Lender</p>
            <p className="font-bold">{PURCHASE_LENDER_INFO.companyName}</p>
            <p className="text-muted-foreground">NMLS #{PURCHASE_LENDER_INFO.companyNmls}</p>
            <p className="mt-1 text-muted-foreground">{PURCHASE_LENDER_INFO.addressLine1}</p>
            <p className="text-muted-foreground">{PURCHASE_LENDER_INFO.addressLine2}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Loan Officer</p>
            <p className="font-bold">{PURCHASE_LENDER_INFO.loanOfficerName}</p>
            <p className="text-muted-foreground">{PURCHASE_LENDER_INFO.loanOfficerTitle}</p>
            <p className="text-muted-foreground">Individual MLO NMLS #{PURCHASE_LENDER_INFO.loanOfficerNmls}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-md border p-3 text-xs sm:grid-cols-3">
          <div><p className="text-[10px] uppercase text-muted-foreground">Purpose</p><p className="font-semibold">{meta.purpose}</p></div>
          <div><p className="text-[10px] uppercase text-muted-foreground">Est. Principal Payoff*</p><p className="font-semibold">{money(meta.currentPayoff)}</p></div>
          <div><p className="text-[10px] uppercase text-muted-foreground">Base New Loan</p><p className="font-semibold">{money(meta.baseNewLoanAmount)}</p></div>
          <div><p className="text-[10px] uppercase text-muted-foreground">Final New Loan</p><p className="font-semibold">{money(meta.finalNewLoanAmount)}</p></div>
          <div><p className="text-[10px] uppercase text-muted-foreground">Rate / Term</p><p className="font-semibold">{meta.ratePct.toFixed(3)}% / 30 years</p></div>
          <div><p className="text-[10px] uppercase text-muted-foreground">New Monthly P&I</p><p className="font-semibold">{money(meta.monthlyPI)}</p></div>
          <div className="col-span-2 sm:col-span-3"><p className="text-[10px] uppercase text-muted-foreground">Property</p><p className="font-semibold">{meta.address}</p></div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-3">
            <Section section={worksheet.lenderFees} />
            <Section section={worksheet.thirdPartyFees} />
          </div>
          <div className="space-y-3">
            <Section section={worksheet.governmentFees} />
            <Section section={worksheet.prepaids} />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border p-3 text-xs">
            <div className="mb-2 bg-muted px-2 py-1.5 font-bold">Estimated Proposed Monthly Housing Expense</div>
            <div className="flex justify-between py-1"><span>First Mortgage P&amp;I</span><strong>{money(worksheet.monthlyHousingExpense.principalAndInterest)}</strong></div>
            <div className="flex justify-between py-1"><span>Homeowner&apos;s Insurance</span><strong>{money(worksheet.monthlyHousingExpense.homeownersInsurance)}</strong></div>
            <div className="flex justify-between py-1"><span>Supplemental Property Insurance</span><strong>{money(worksheet.monthlyHousingExpense.supplementalInsurance)}</strong></div>
            <div className="flex justify-between py-1"><span>Property Taxes</span><strong>{money(worksheet.monthlyHousingExpense.propertyTaxes)}</strong></div>
            <div className="flex justify-between py-1">
              <span>Mortgage Insurance</span>
              <strong>
                {worksheet.monthlyHousingExpense.mortgageInsurance === null
                  ? "To be confirmed"
                  : money(worksheet.monthlyHousingExpense.mortgageInsurance)}
              </strong>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between border border-primary px-2 py-1.5 text-sm">
              <strong>
                {worksheet.monthlyHousingExpense.totalPiti === null
                  ? "Known Monthly Payment Before Program Charges"
                  : "Total Approximate Monthly Payment"}
              </strong>
              <strong className="text-primary">
                {money(
                  worksheet.monthlyHousingExpense.totalPiti
                    ?? worksheet.monthlyHousingExpense.knownPaymentSubtotal,
                )}
              </strong>
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">
              P&amp;I is calculated on the proposed funded loan amount of {money(meta.finalNewLoanAmount)}.
              Taxes and insurance use available current-loan/property estimates and will be confirmed before closing.
              {worksheet.monthlyHousingExpense.requiresProgramConfirmation
                ? " Program-specific mortgage insurance and financed funding/upfront charges are not included until the loan officer confirms the program details."
                : ""}
            </p>
          </div>

          <div className="rounded-md border p-3 text-xs">
            <div className="mb-2 bg-muted px-2 py-1.5 font-bold">Estimated Refinance Funds to Close</div>
            <div className="flex justify-between py-1"><span>Base new-loan proceeds</span><strong>{money(meta.baseNewLoanAmount)}</strong></div>
            <div className="flex justify-between py-1"><span>Less estimated principal payoff*</span><strong>−{money(meta.currentPayoff)}</strong></div>
            {worksheet.grossCashOut > 0 && <div className="flex justify-between py-1"><span>Gross cash-out before charges</span><strong>{money(worksheet.grossCashOut)}</strong></div>}
            <Separator className="my-1.5" />
            <div className="flex justify-between py-1"><span>Total estimated closing costs</span><strong>{money(worksheet.totalClosingCosts)}</strong></div>
            <div className="flex justify-between py-1"><span>Total prepaids and initial escrow</span><strong>{money(worksheet.totalPrepaidsAndEscrows)}</strong></div>
            <div className="flex justify-between py-1"><span>Closing costs &amp; escrows financed</span><strong>{meta.financeFees ? "Yes" : "No"}</strong></div>
            <div className="flex justify-between py-1"><span>Funded LTV</span><strong>{worksheet.fundedLtvPct === null ? "—" : `${worksheet.fundedLtvPct.toFixed(2)}%`}</strong></div>
            {worksheet.cashNeededFor80Ltv > 0 && (
              <div className="flex justify-between py-1 text-amber-800">
                <span>Cash needed to remain at/below 80% LTV</span>
                <strong>{money(worksheet.cashNeededFor80Ltv)}</strong>
              </div>
            )}
            {meta.financeFees && (
              <>
                <div className="flex justify-between py-1"><span>Closing costs added to base loan</span><strong>+{money(worksheet.financedClosingCosts)}</strong></div>
                {worksheet.financedPrepaidsAndEscrows > 0 && (
                  <div className="flex justify-between py-1"><span>Initial escrow added to base loan</span><strong>+{money(worksheet.financedPrepaidsAndEscrows)}</strong></div>
                )}
                <div className="flex justify-between border-t py-1 font-semibold"><span>Proposed funded loan amount</span><strong>{money(meta.finalNewLoanAmount)}</strong></div>
              </>
            )}
            <Separator className="my-1.5" />
            <div className="flex justify-between border border-primary px-2 py-1.5 text-sm">
              <strong>{worksheet.estimatedCashToBorrower > 0 ? "Estimated net cash to borrower" : "Estimated cash due at closing"}</strong>
              <strong className="text-primary">
                {money(worksheet.estimatedCashToBorrower > 0 ? worksheet.estimatedCashToBorrower : worksheet.estimatedCashDueAtClosing)}
              </strong>
            </div>
            <div className="mt-2 rounded border border-amber-300 bg-amber-50 p-2 text-amber-950">
              {worksheet.possibleEscrowRefundBasis === "unavailable" ? (
                <strong>You MAY be due a refund from your current escrow account; an amount could not be estimated from the available loan information.</strong>
              ) : (
                <>
                  <strong>You MAY be due an estimated escrow refund of {money(worksheet.possibleEscrowRefund)} from your current servicer.</strong>
                  <span className="ml-1">
                    {worksheet.possibleEscrowRefundBasis === "statement_balance"
                      ? "This uses the escrow-account balance extracted from your mortgage statement."
                      : "This estimate uses two months of the current monthly escrow payment."}
                  </span>
                </>
              )}
              <span className="ml-1 font-medium">Your loan officer will confirm the actual escrow balance and any refund with your current servicer.</span>
            </div>
          </div>
        </div>

        <p className="text-[10px] leading-relaxed text-muted-foreground">
          Estimates only—not a Loan Estimate, approval, rate lock, or commitment to lend. Actual payoff interest,
          title premiums, government charges, prepaid interest, escrow requirements, and credits vary by property,
          closing date, loan program, and settlement provider. Any possible refund from the borrower’s existing escrow
          account is handled separately by the current servicer, is not guaranteed, and is not included in the cash-to-close
          or cash-to-borrower calculation. *The principal payoff shown is the
          estimated current balance and excludes per-diem interest, late charges, or other amounts in an official payoff quote.
        </p>
      </DialogContent>
    </Dialog>
  );
}