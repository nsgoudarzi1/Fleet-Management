import { describe, expect, it } from "vitest";
import { calculateUpfitRollupAmount } from "@/lib/services/upfit-math";

describe("calculateUpfitRollupAmount", () => {
  it("uses configured estimate vs actual rules for billable rollups", () => {
    const output = calculateUpfitRollupAmount([
      {
        billableToCustomer: true,
        includeActualCosts: false,
        costEstimate: 1200,
        actualCost: 800,
      },
      {
        billableToCustomer: true,
        includeActualCosts: true,
        costEstimate: 900,
        actualCost: 1000,
      },
      {
        billableToCustomer: false,
        includeActualCosts: true,
        costEstimate: 200,
        actualCost: 300,
      },
    ]);

    expect(output.billableAmount).toBe(2200);
    expect(output.actualCost).toBe(2100);
  });
});
