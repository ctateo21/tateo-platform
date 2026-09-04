import { test } from "node:test";
import assert from "node:assert/strict";
import { buildFeeWorksheet } from "./fee-worksheet";
import {
  buildInitialFeesWorksheetFileName,
  createInitialFeesWorksheetPdf,
} from "./ifw-pdf";
import { resolvePurchaseLenderInfo } from "./lender-info";

const worksheet = buildFeeWorksheet({
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
});

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
  assert.ok(doc.getNumberOfPages() >= 2);
});

test("IFW PDF filenames are recognizable and address-specific", () => {
  assert.equal(
    buildInitialFeesWorksheetFileName("123 Main St, Tampa, FL"),
    "initial-fees-worksheet-123-main-st-tampa-fl.pdf",
  );
});