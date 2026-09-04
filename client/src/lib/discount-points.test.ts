import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calculateDiscountPointsCost,
  getDiscountPointsRateReduction,
  snapDiscountPoints,
  type DiscountPointsLoanType,
} from "./discount-points";

test("discount points snap to supported half-point steps and clamp safely", () => {
  assert.equal(snapDiscountPoints(Number.NaN), 0);
  assert.equal(snapDiscountPoints(-1), 0);
  assert.equal(snapDiscountPoints(0.74), 0.5);
  assert.equal(snapDiscountPoints(0.76), 1);
  assert.equal(snapDiscountPoints(99), 3);
});

test("discount-point cost uses the base loan and preserves cents", () => {
  assert.equal(calculateDiscountPointsCost(320_123.45, 1), 3_201.23);
  assert.equal(calculateDiscountPointsCost(320_123.45, 1.5), 4_801.85);
  assert.equal(calculateDiscountPointsCost(-100, 1), 0);
});

test("every purchase loan type uses its configured rate-reduction group", () => {
  const conventionalReductions = [
    [0, 0],
    [0.5, 0.240],
    [1, 0.340],
    [1.5, 0.420],
    [2, 0.500],
    [2.5, 0.710],
    [3, 0.810],
  ] as const;
  const governmentReductions = [
    [0, 0],
    [0.5, 0.094],
    [1, 0.184],
    [1.5, 0.264],
    [2, 0.364],
    [2.5, 0.478],
    [3, 0.562],
  ] as const;
  const conventionalTypes: DiscountPointsLoanType[] = [
    "conventional",
    "jumbo",
    "dscr",
  ];
  const governmentTypes: DiscountPointsLoanType[] = ["fha", "va", "usda"];

  for (const loanType of conventionalTypes) {
    for (const [points, reduction] of conventionalReductions) {
      assert.equal(getDiscountPointsRateReduction(points, loanType), reduction, `${loanType} at ${points} points`);
    }
  }
  for (const loanType of governmentTypes) {
    for (const [points, reduction] of governmentReductions) {
      assert.equal(getDiscountPointsRateReduction(points, loanType), reduction, `${loanType} at ${points} points`);
    }
  }
  for (const [points] of conventionalReductions) {
    assert.equal(getDiscountPointsRateReduction(points, "bank_statement"), 0);
  }
});