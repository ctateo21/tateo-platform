/**
 * Unit tests for county-parcel-lookup helpers.
 * Focuses on the Manatee pickBestManateeBillYear logic.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  pickBestManateeBillYear,
  selectStrictParcelCandidate,
} from "./county-parcel-lookup";

test("selectStrictParcelCandidate rejects truncated-street decoys", () => {
  const requested = "3102 W Bay To Bay Blvd, Tampa, FL 33629";
  const features = [
    {
      attributes: {
        SITE_ADDRESS: "3102 W BAY ST",
        SITE_CITYZIP: "TAMPA 33629",
      },
    },
    {
      attributes: {
        SITE_ADDRESS: "3102 W BAY TO BAY BLVD",
        SITE_CITYZIP: "TAMPA 33629",
      },
    },
  ];
  assert.equal(
    selectStrictParcelCandidate(
      requested,
      features,
      "SITE_ADDRESS",
      "SITE_CITYZIP",
    ),
    features[1],
  );
});

test("selectStrictParcelCandidate rejects a city-only match", () => {
  const features = [{
    attributes: {
      SITE_ADDRESS: "123 MAIN ST",
      SITE_CITYZIP: "CLEARWATER 33755",
    },
  }];
  assert.equal(
    selectStrictParcelCandidate(
      "789 OAK ST, Clearwater, FL 33755",
      features,
      "SITE_ADDRESS",
      "SITE_CITYZIP",
    ),
    null,
  );
});

test("selectStrictParcelCandidate requires an exact city", () => {
  const features = [{
    attributes: {
      SITUS_ADDRESS: "8111 HIGH OAKS TRL",
      SITUS_POSTAL_CITY: "BRADENTON",
    },
  }];
  assert.equal(
    selectStrictParcelCandidate(
      "8111 High Oaks Trl, Myakka City, FL 34251",
      features,
      "SITUS_ADDRESS",
      "SITUS_POSTAL_CITY",
    ),
    null,
  );
});

test("selectStrictParcelCandidate rejects a different unit", () => {
  const features = [{
    attributes: {
      SITE_ADDRESS: "100 BEACH DR UNIT 202",
      SITE_CITYZIP: "ST PETERSBURG 33701",
    },
  }];
  assert.equal(
    selectStrictParcelCandidate(
      "100 Beach Dr Unit 201, St Petersburg, FL 33701",
      features,
      "SITE_ADDRESS",
      "SITE_CITYZIP",
    ),
    null,
  );
});

test("pickBestManateeBillYear: returns null/null when all tax amounts are zero", () => {
  const attrs = {
    TAX_YEAR1: 2026, TAXES_YEAR1: 0,
    TAX_YEAR2: 2025, TAXES_YEAR2: 0,
    TAX_YEAR3: 2024, TAXES_YEAR3: 0,
    TAX_YEAR4: 2023, TAXES_YEAR4: 0,
  };
  const { bestYear, bestTotal } = pickBestManateeBillYear(attrs);
  assert.equal(bestYear, null);
  assert.equal(bestTotal, null);
});

test("pickBestManateeBillYear: skips current-year zero placeholder, picks prior year", () => {
  // TAX_YEAR1=2026 with 0 placeholder; TAX_YEAR2=2025 with real bill
  const attrs = {
    TAX_YEAR1: 2026, TAXES_YEAR1: 0,
    TAX_YEAR2: 2025, TAXES_YEAR2: 4469.66,
    TAX_YEAR3: 2024, TAXES_YEAR3: 4201.10,
    TAX_YEAR4: 2023, TAXES_YEAR4: 3980.00,
  };
  const { bestYear, bestTotal } = pickBestManateeBillYear(attrs);
  assert.equal(bestYear, 2025);
  assert.equal(bestTotal, 4469.66);
});

test("pickBestManateeBillYear: picks the largest year when multiple positive", () => {
  const attrs = {
    TAX_YEAR1: 2025, TAXES_YEAR1: 4469.66,
    TAX_YEAR2: 2024, TAXES_YEAR2: 4201.10,
    TAX_YEAR3: 2023, TAXES_YEAR3: 3980.00,
    TAX_YEAR4: 2022, TAXES_YEAR4: 3700.00,
  };
  const { bestYear, bestTotal } = pickBestManateeBillYear(attrs);
  assert.equal(bestYear, 2025);
  assert.equal(bestTotal, 4469.66);
});

test("pickBestManateeBillYear: slots can be in any order — still picks the highest year", () => {
  // Slots are not guaranteed to be in descending year order
  const attrs = {
    TAX_YEAR1: 2023, TAXES_YEAR1: 3980.00,
    TAX_YEAR2: 2025, TAXES_YEAR2: 4469.66,
    TAX_YEAR3: 2024, TAXES_YEAR3: 4201.10,
    TAX_YEAR4: 2022, TAXES_YEAR4: 0,
  };
  const { bestYear, bestTotal } = pickBestManateeBillYear(attrs);
  assert.equal(bestYear, 2025);
  assert.equal(bestTotal, 4469.66);
});

test("pickBestManateeBillYear: handles missing slots gracefully", () => {
  // Only TAX_YEAR2 is present with a positive amount
  const attrs: Record<string, unknown> = {
    TAX_YEAR2: 2025, TAXES_YEAR2: 3500.00,
  };
  const { bestYear, bestTotal } = pickBestManateeBillYear(attrs);
  assert.equal(bestYear, 2025);
  assert.equal(bestTotal, 3500.00);
});

test("pickBestManateeBillYear: handles string-valued fields from some ArcGIS responses", () => {
  const attrs = {
    TAX_YEAR1: "2026", TAXES_YEAR1: "0",
    TAX_YEAR2: "2025", TAXES_YEAR2: "4469.66",
  };
  const { bestYear, bestTotal } = pickBestManateeBillYear(attrs);
  assert.equal(bestYear, 2025);
  assert.equal(bestTotal, 4469.66);
});

test("pickBestManateeBillYear: returns null/null when attributes are empty", () => {
  const { bestYear, bestTotal } = pickBestManateeBillYear({});
  assert.equal(bestYear, null);
  assert.equal(bestTotal, null);
});

test("pickBestManateeBillYear: negative amounts treated as not positive, skipped", () => {
  // Negative would be a data anomaly; should not be selected
  const attrs = {
    TAX_YEAR1: 2026, TAXES_YEAR1: -100,
    TAX_YEAR2: 2025, TAXES_YEAR2: 4469.66,
  };
  const { bestYear, bestTotal } = pickBestManateeBillYear(attrs);
  assert.equal(bestYear, 2025);
  assert.equal(bestTotal, 4469.66);
});
