// Initial Fees Worksheet popup — modeled on a lender "Initial Fees
// Worksheet / Loan Estimate". Rendered from the shared fee-worksheet
// model so every figure stays in lockstep with the estimate page calc.
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { FileText } from "lucide-react";
import type { FeeWorksheet, FeeSection, FeeLine } from "@/lib/fee-worksheet";
import { money } from "@/lib/fee-worksheet";

function LineRow({ line, indent }: { line: FeeLine; indent?: boolean }) {
  return (
    <div className={`flex justify-between items-baseline gap-2 py-[3px] ${indent ? "pl-3" : ""}`}>
      <span className="text-xs text-muted-foreground leading-snug">
        {line.label}
        {line.note && <span className="ml-1 opacity-70">({line.note})</span>}
      </span>
      <span className="text-xs tabular-nums whitespace-nowrap">{money(line.amount)}</span>
    </div>
  );
}

function SectionBlock({ section }: { section: FeeSection }) {
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="flex justify-between items-baseline mb-1.5">
        <h4 className="text-xs font-bold uppercase tracking-wide text-primary">{section.title}</h4>
        <span className="text-xs font-bold tabular-nums">{money(section.subtotal)}</span>
      </div>
      {section.lines.map((l, i) => (
        <LineRow key={i} line={l} />
      ))}
      {section.groups?.map((g, gi) => (
        <div key={gi} className="mt-1.5">
          <p className="text-[11px] font-semibold text-foreground/80 mb-0.5">{g.heading}</p>
          {g.lines.map((l, i) => (
            <LineRow key={i} line={l} indent />
          ))}
        </div>
      ))}
    </div>
  );
}

export interface FeeWorksheetMeta {
  address?: string;
  purchasePrice: number;
  loanAmount: number;
  loanTypeLabel: string;
  ratePct: number;
  aprPct: number;
  occupancyLabel?: string;
}

export function FeeWorksheetDialog({
  open,
  onOpenChange,
  worksheet,
  meta,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  worksheet: FeeWorksheet | null;
  meta: FeeWorksheetMeta | null;
}) {
  if (!worksheet || !meta) return null;
  const fmt0 = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-fee-worksheet">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <FileText className="h-5 w-5" />
            Initial Fees Worksheet
          </DialogTitle>
          <DialogDescription className="text-[11px]">
            Your actual rate, payment and costs could be higher. Get an official Loan Estimate before choosing a loan.
          </DialogDescription>
        </DialogHeader>

        {/* Summary header — mirrors the top block of a lender worksheet */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 rounded-md border p-3 text-xs">
          <div>
            <p className="text-muted-foreground text-[10px] uppercase tracking-wide">Loan Purpose</p>
            <p className="font-semibold">Purchase</p>
          </div>
          <div>
            <p className="text-muted-foreground text-[10px] uppercase tracking-wide">Purchase Price</p>
            <p className="font-semibold tabular-nums">{fmt0(meta.purchasePrice)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-[10px] uppercase tracking-wide">Loan Amount</p>
            <p className="font-semibold tabular-nums">{fmt0(meta.loanAmount)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-[10px] uppercase tracking-wide">Product</p>
            <p className="font-semibold">30 Year {meta.loanTypeLabel} Fixed</p>
          </div>
          <div>
            <p className="text-muted-foreground text-[10px] uppercase tracking-wide">Rate / APR</p>
            <p className="font-semibold tabular-nums">
              {meta.ratePct.toFixed(3)}% / <em>{meta.aprPct.toFixed(3)}%</em>
            </p>
          </div>
          {meta.occupancyLabel && (
            <div>
              <p className="text-muted-foreground text-[10px] uppercase tracking-wide">Occupancy</p>
              <p className="font-semibold">{meta.occupancyLabel}</p>
            </div>
          )}
          {meta.address && (
            <div className="col-span-2 sm:col-span-3">
              <p className="text-muted-foreground text-[10px] uppercase tracking-wide">Property</p>
              <p className="font-semibold">{meta.address}</p>
            </div>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-3">
            <SectionBlock section={worksheet.lenderFees} />
            <SectionBlock section={worksheet.thirdPartyFees} />
          </div>
          <div className="space-y-3">
            <SectionBlock section={worksheet.govFees} />
            <SectionBlock section={worksheet.prepaids} />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          {/* Monthly housing expense */}
          <div className="rounded-md border p-3">
            <h4 className="text-xs font-bold uppercase tracking-wide text-primary mb-1.5">
              {worksheet.monthlyHousing.title}
            </h4>
            {worksheet.monthlyHousing.lines.map((l, i) => (
              <LineRow key={i} line={l} />
            ))}
            <Separator className="my-1.5" />
            <div className="flex justify-between items-baseline">
              <span className="text-xs font-bold">Total Approximated Monthly Payment</span>
              <span className="text-sm font-bold tabular-nums text-primary">{money(worksheet.totalMonthly)}</span>
            </div>
          </div>

          {/* Funds to close */}
          <div className="rounded-md border p-3">
            <h4 className="text-xs font-bold uppercase tracking-wide text-primary mb-1.5">Estimated Funds to Close</h4>
            {worksheet.fundsToClose.lines.map((l, i) => (
              <LineRow key={i} line={l} />
            ))}
            <div className="flex justify-between items-baseline pt-1">
              <span className="text-xs font-semibold">Funds Due from Borrower (A)</span>
              <span className="text-xs font-semibold tabular-nums">{money(worksheet.fundsToClose.fundsFromBorrower)}</span>
            </div>
            <Separator className="my-1.5" />
            {worksheet.fundsToClose.credits.map((l, i) => (
              <LineRow key={i} line={l} />
            ))}
            <div className="flex justify-between items-baseline pt-1">
              <span className="text-xs font-semibold">Total Credits Applied (B)</span>
              <span className="text-xs font-semibold tabular-nums">{money(worksheet.fundsToClose.totalCredits)}</span>
            </div>
            <Separator className="my-1.5" />
            <div className="flex justify-between items-baseline">
              <span className="text-xs font-bold">Estimated Cash from Borrower (A − B)</span>
              <span className="text-sm font-bold tabular-nums text-primary">{money(worksheet.fundsToClose.estimatedCash)}</span>
            </div>
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Note: this worksheet itemizes estimated fees line by line, so its totals may differ slightly from the
          simplified "Estimated Closing Costs (~3%)" figure shown on the estimate page.
        </p>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          This estimate is provided for illustrative and informational purposes only based on the loan scenario provided.
          This is not a loan approval or commitment to lend. Rates are subject to change. Annual Percentage Rate (APR) is an
          estimate calculated by factoring in applicable fees (origination, underwriting, and other prepaid finance charges)
          plus the interest rate itself. Until you lock your rate, APR and terms are subject to change or may not be
          available at commitment or closing.
        </p>
      </DialogContent>
    </Dialog>
  );
}
