import { DealDocumentChecklistStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { resolveChecklistStatus } from "@/lib/services/document-pack-utils";

describe("resolveChecklistStatus", () => {
  it("prioritizes generated over other states", () => {
    expect(
      resolveChecklistStatus({
        hasTemplate: false,
        missingFields: ["customer.email"],
        generated: true,
      }),
    ).toBe(DealDocumentChecklistStatus.GENERATED);
  });

  it("returns blocked when template is missing", () => {
    expect(
      resolveChecklistStatus({
        hasTemplate: false,
        missingFields: [],
        generated: false,
      }),
    ).toBe(DealDocumentChecklistStatus.BLOCKED);
  });

  it("returns missing-data when required fields are absent", () => {
    expect(
      resolveChecklistStatus({
        hasTemplate: true,
        missingFields: ["deal.dealNumber"],
        generated: false,
      }),
    ).toBe(DealDocumentChecklistStatus.MISSING_DATA);
  });
});
