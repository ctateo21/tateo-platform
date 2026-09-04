import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateZillowAddressMatch } from "./apify-zillow";
import { normalizeRealtorRow } from "./realtor-apify";

test("Zillow matches Circle and Cir while retaining strict identifiers", () => {
  const row = {
    address: {
      streetAddress: "13214 Royal George Cir",
      city: "Odessa",
      state: "FL",
      zipcode: "33556",
    },
  };

  const accepted = evaluateZillowAddressMatch(
    "13214 Royal George Circle, Odessa, FL 33556",
    row,
  );
  assert.equal(accepted.accept, true);
  assert.equal(accepted.reason, "full match");

  const wrongProperty = evaluateZillowAddressMatch(
    "13215 Royal George Circle, Odessa, FL 33556",
    row,
  );
  assert.equal(wrongProperty.accept, false);
  assert.equal(wrongProperty.reason, "street number mismatch");
});

test("Zillow preserves the actor's specific invalid-row reason", () => {
  const decision = evaluateZillowAddressMatch(
    "13214 Royal George Circle, Odessa, FL 33556",
    {
      isValid: false,
      invalidReason: "Property detail page was unavailable",
    },
  );

  assert.equal(decision.accept, false);
  assert.equal(
    decision.reason,
    "actor invalid: Property detail page was unavailable",
  );
});

test("Realtor normalizes memo23 flat address fields into a usable comp", () => {
  const comp = normalizeRealtorRow(
    {
      address_line: "13214 Royal George Cir",
      address_city: "Odessa",
      address_state_code: "FL",
      address_postal_code: "33556",
      list_price: 625000,
      sqft: 2500,
      beds: 4,
      baths: 3,
      status: "for_sale",
      href: "https://www.realtor.com/example",
    },
    "active",
  );

  assert.ok(comp);
  assert.equal(comp.address, "13214 Royal George Cir, Odessa, FL, 33556");
  assert.equal(comp.price, 625000);
  assert.equal(comp.pricePerSqft, 250);
  assert.equal(comp.status, "active");
});