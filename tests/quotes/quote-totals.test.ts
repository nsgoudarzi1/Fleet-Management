import { describe, expect, it } from "vitest";
import { calculateQuoteTotals } from "@/lib/services/quote-math";

describe("calculateQuoteTotals", () => {
  it("computes subtotal, tax, total, cost, and gross correctly", () => {
    const output = calculateQuoteTotals(
      [
        { quantity: 2, unitPrice: 100, taxable: true, unitCost: 65 },
        { quantity: 1, unitPrice: 50, taxable: false, unitCost: 20 },
      ],
      0.1,
    );

    expect(output.subtotal).toBe(250);
    expect(output.taxableTotal).toBe(200);
    expect(output.taxTotal).toBe(20);
    expect(output.total).toBe(270);
    expect(output.costTotal).toBe(150);
    expect(output.grossTotal).toBe(100);
  });
});
