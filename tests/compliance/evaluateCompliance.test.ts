import { DealType, DocumentType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { evaluateCompliance, type DealSnapshot } from "../../lib/compliance/evaluate";

const snapshot: DealSnapshot = {
  dealId: "deal_1",
  orgId: "org_1",
  jurisdiction: "TX",
  buyerState: "TX",
  dealType: DealType.FINANCE,
  hasTradeIn: true,
  isFinanced: true,
  hasLienholder: true,
  salePrice: 28995,
  financedAmount: 25000,
  customer: {
    firstName: "Jordan",
    lastName: "Miles",
    email: "jordan@example.com",
    phone: "555-0101",
  },
  vehicle: {
    year: 2020,
    make: "BMW",
    model: "330i",
    vin: "WBA8E9G56GNU00002",
    mileage: 39000,
    stockNumber: "STK-1002",
  },
  dealer: {
    name: "Summit Auto Group",
    taxRate: 0.075,
    docFee: 499,
    licenseFee: 199,
  },
};

describe("evaluateCompliance", () => {
  it("returns required documents from matching scenarios", () => {
    const output = evaluateCompliance(snapshot, [
      {
        metadata: { notLegalAdvice: true },
        scenarios: [
          {
            when: { dealType: [DealType.FINANCE] },
            requiredDocuments: [DocumentType.RETAIL_INSTALLMENT_CONTRACT, DocumentType.BUYERS_ORDER],
          },
          {
            when: { hasTradeIn: true },
            requiredDocuments: [DocumentType.TITLE_REG_APPLICATION],
          },
        ],
        validations: [],
      },
    ]);

    const docTypes = output.requiredChecklist.map((item) => item.docType);
    expect(docTypes).toContain(DocumentType.RETAIL_INSTALLMENT_CONTRACT);
    expect(docTypes).toContain(DocumentType.TITLE_REG_APPLICATION);
    expect(output.notices.some((notice) => notice.toLowerCase().includes("not legal advice"))).toBe(true);
  });

  it("adds validation errors when conditions match", () => {
    const output = evaluateCompliance(snapshot, [
      {
        scenarios: [],
        validations: [
          {
            code: "FINANCE_LIEN_REQUIRED",
            message: "Lienholder is required for finance deals.",
            severity: "error",
            when: { isFinanced: true, hasLienholder: false },
          },
          {
            code: "OUT_OF_STATE_DISCLOSURE",
            message: "Out-of-state disclosure should be included.",
            severity: "warning",
            when: { isOutOfStateBuyer: true },
          },
        ],
      },
    ]);

    expect(output.validationErrors).toEqual([]);

    const outOfState = evaluateCompliance(
      {
        ...snapshot,
        buyerState: "FL",
      },
      [
        {
          scenarios: [],
          validations: [
            {
              code: "OUT_OF_STATE_DISCLOSURE",
              message: "Out-of-state disclosure should be included.",
              severity: "warning",
              when: { isOutOfStateBuyer: true },
            },
          ],
        },
      ],
    );

    expect(outOfState.validationErrors[0]?.code).toBe("OUT_OF_STATE_DISCLOSURE");
    expect(outOfState.validationErrors[0]?.severity).toBe("warning");
  });
});
