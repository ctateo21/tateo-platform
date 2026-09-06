import { test } from "node:test";
import assert from "node:assert/strict";
import { buildFeeWorksheet } from "./fee-worksheet";
import {
  buildInitialFeesWorksheetFileName,
  createInitialFeesWorksheetPdf,
} from "./ifw-pdf";
import { resolvePurchaseLenderInfo } from "./lender-info";

const worksheetInputs = {
  purchasePrice: 330_000,
  baseLoanAmount: 320_100,
  loanAmount: 320_100,
  ratePct: 6.624,
  loanType: "conventional",
  monthlyPI: 2_049.42,
  monthlyTax: 490.5,
  monthlyHOIns: 247.18,
  monthlyFlood: 0,
  monthlyMI: 80.02,
  hoaMonthly: 0,
  monthlyCDD: 0,
  downPaymentAmt: 9_900,
  discountPointsCost: 0,
  discountPointsPct: 0,
  dscrOriginationAmount: 0,
  dpaExtraPointsCost: 0,
  sellerCredits: 9_900,
  dpaDownPaymentCredit: 0,
  dpaClosingCostCredit: 0,
} as const;

const worksheet = buildFeeWorksheet(worksheetInputs);

test("IFW PDF includes the resolved loan officer identity and NMLS", () => {
  const doc = createInitialFeesWorksheetPdf({
    worksheet,
    meta: {
      address: "123 Main St, Tampa, FL",
      purchasePrice: 330_000,
      loanAmount: 320_100,
      loanTypeLabel: "Conventional",
      ratePct: 6.624,
      aprPct: worksheet.aprPct,
    },
    lenderInfo: resolvePurchaseLenderInfo({ email: "omar@tateoco.com" }),
  });
  const output = doc.output();

  assert.match(output, /Omar Andujar/);
  assert.match(output, /1806169/);
  assert.match(
    output,
    new RegExp(`APR ${worksheet.aprPct.toFixed(3)}% - includes applicable fees`),
  );
  assert.doesNotMatch(output, /Rate \/ Estimated APR/);
  assert.equal(doc.getNumberOfPages(), 2);
  assert.match(output, /WHEN MONEY IS DUE/);
  assert.match(output, /Earnest money deposit/);
  assert.match(output, /Remaining estimated cash to close/);
});

test("IFW PDF filenames are recognizable and address-specific", () => {
  assert.equal(
    buildInitialFeesWorksheetFileName("123 Main St, Tampa, FL"),
    "initial-fees-worksheet-123-main-st-tampa-fl.pdf",
  );
});

test("IFW PDF itemizes discount points included in its APR", () => {
  const pointsWorksheet = buildFeeWorksheet({
    ...worksheetInputs,
    discountPointsCost: 3_201,
    discountPointsPct: 1,
  });
  const doc = createInitialFeesWorksheetPdf({
    worksheet: pointsWorksheet,
    meta: {
      address: "123 Main St, Tampa, FL",
      purchasePrice: 330_000,
      loanAmount: 320_100,
      loanTypeLabel: "Conventional",
      ratePct: 6.624,
      aprPct: pointsWorksheet.aprPct,
    },
    lenderInfo: resolvePurchaseLenderInfo({ email: "omar@tateoco.com" }),
  });
  const output = doc.output();

  assert.ok(output.includes("(1.000% of Loan Amount \\(Points\\))"));
  assert.match(output, /\$3,201.00/);
  assert.match(
    output,
    new RegExp(`APR ${pointsWorksheet.aprPct.toFixed(3)}% - includes applicable fees`),
  );
});
