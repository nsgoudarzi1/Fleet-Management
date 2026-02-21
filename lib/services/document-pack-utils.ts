import { DealDocumentChecklistStatus } from "@prisma/client";

export function resolveChecklistStatus(input: {
  hasTemplate: boolean;
  missingFields: string[];
  generated: boolean;
}) {
  if (input.generated) return DealDocumentChecklistStatus.GENERATED;
  if (!input.hasTemplate) return DealDocumentChecklistStatus.BLOCKED;
  if (input.missingFields.length) return DealDocumentChecklistStatus.MISSING_DATA;
  return DealDocumentChecklistStatus.PENDING;
}
