import { test } from "node:test";
import assert from "node:assert/strict";
import { PURCHASE_LENDER_INFO, resolvePurchaseLenderInfo } from "./lender-info";

test("purchase lender info resolves Tateo loan officers by account email", () => {
  assert.equal(resolvePurchaseLenderInfo({ email: "OMAR@TATEOCO.COM" }).loanOfficerNmls, "1806169");
  assert.equal(resolvePurchaseLenderInfo({ email: "kyle@tateoco.com" }).loanOfficerNmls, "2140291");
  assert.deepEqual(
    {
      name: resolvePurchaseLenderInfo({ email: "alex@tateoco.com" }).loanOfficerName,
      nmls: resolvePurchaseLenderInfo({ email: "alex@tateoco.com" }).loanOfficerNmls,
    },
    { name: "Sandor “Alex” Szabo", nmls: "2857504" },
  );
});

test("purchase lender info falls back to normalized staff names", () => {
  assert.equal(resolvePurchaseLenderInfo({ name: "Omar Andujar" }).loanOfficerNmls, "1806169");
  assert.equal(resolvePurchaseLenderInfo({ name: "Sandor \"Alex\" Szabo" }).loanOfficerNmls, "2857504");
});

test("purchase lender info safely defaults to Christian", () => {
  assert.deepEqual(resolvePurchaseLenderInfo(null), PURCHASE_LENDER_INFO);
  assert.equal(
    resolvePurchaseLenderInfo({ email: "buyer@example.com", name: "Buyer Person" }).loanOfficerNmls,
    "1223755",
  );
});