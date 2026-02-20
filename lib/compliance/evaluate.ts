import { DealType, DocumentType } from "@prisma/client";
import { complianceRulesJsonSchema, type ComplianceRulesJson, type ComplianceValidationRule, type ComplianceWhenClause } from "@/lib/compliance/schemas";

export type DealSnapshot = {
  dealId: string;
  orgId: string;
  jurisdiction: string;
  buyerState?: string | null;
  dealType: DealType;
  hasTradeIn: boolean;
  isFinanced: boolean;
  hasLienholder: boolean;
  salePrice: number;
  financedAmount: number;
  customer: {
    firstName: string;
    lastName: string;
    email?: string | null;
    phone?: string | null;
  };
  vehicle: {
    year: number;
    make: string;
    model: string;
    vin: string;
    mileage: number;
    stockNumber: string;
  };
  dealer: {
    name: string;
    taxRate: number;
    docFee: number;
    licenseFee: number;
  };
};

export type RequiredDocChecklistItem = {
  docType: DocumentType;
  required: boolean;
  reason: string;
};

export type ComplianceValidationError = {
  code: string;
  message: string;
  severity: "error" | "warning";
  field?: string;
};

export type ComplianceEvaluation = {
  requiredChecklist: RequiredDocChecklistItem[];
  validationErrors: ComplianceValidationError[];
  computedFields: Record<string, string | number | boolean | null>;
  notices: string[];
};

function whenMatches(snapshot: DealSnapshot, when: ComplianceWhenClause) {
  if (when.dealType && !when.dealType.includes(snapshot.dealType)) return false;
  if (typeof when.hasTradeIn === "boolean" && when.hasTradeIn !== snapshot.hasTradeIn) return false;
  if (typeof when.isOutOfStateBuyer === "boolean") {
    const isOutOfStateBuyer = Boolean(snapshot.buyerState && snapshot.buyerState !== snapshot.jurisdiction);
    if (when.isOutOfStateBuyer !== isOutOfStateBuyer) return false;
  }
  if (typeof when.isFinanced === "boolean" && when.isFinanced !== snapshot.isFinanced) return false;
  if (typeof when.hasLienholder === "boolean" && when.hasLienholder !== snapshot.hasLienholder) return false;
  return true;
}

function baseRequiredDocs(dealType: DealType) {
  if (dealType === DealType.CASH) {
    return [DocumentType.BUYERS_ORDER, DocumentType.ODOMETER_DISCLOSURE, DocumentType.PRIVACY_NOTICE];
  }
  if (dealType === DealType.LEASE) {
    return [DocumentType.BUYERS_ORDER, DocumentType.ODOMETER_DISCLOSURE, DocumentType.PRIVACY_NOTICE];
  }
  return [
    DocumentType.BUYERS_ORDER,
    DocumentType.ODOMETER_DISCLOSURE,
    DocumentType.RETAIL_INSTALLMENT_CONTRACT,
    DocumentType.PRIVACY_NOTICE,
  ];
}

function ruleToValidationError(rule: ComplianceValidationRule): ComplianceValidationError {
  return {
    code: rule.code,
    message: rule.message,
    severity: rule.severity,
    field: rule.field,
  };
}

export function evaluateCompliance(
  snapshot: DealSnapshot,
  inputRuleSets: Array<ComplianceRulesJson | unknown>,
): ComplianceEvaluation {
  const notices = ["Not legal advice. Validate output with licensed compliance counsel."];
  const requiredReasons = new Map<DocumentType, string[]>();
  const validationErrors: ComplianceValidationError[] = [];
  const computedFields: Record<string, string | number | boolean | null> = {};

  for (const docType of baseRequiredDocs(snapshot.dealType)) {
    requiredReasons.set(docType, ["Base checklist"]);
  }

  for (const rawRuleSet of inputRuleSets) {
    const parsed = complianceRulesJsonSchema.safeParse(rawRuleSet);
    if (!parsed.success) continue;
    const ruleSet = parsed.data;

    if (ruleSet.metadata?.notLegalAdvice) {
      notices.push("Rule set includes non-authoritative examples; legal review required.");
    }

    for (const scenario of ruleSet.scenarios) {
      if (!whenMatches(snapshot, scenario.when)) continue;
      for (const docType of scenario.requiredDocuments) {
        const reasons = requiredReasons.get(docType) ?? [];
        reasons.push(scenario.notes ?? "Scenario match");
        requiredReasons.set(docType, reasons);
      }
    }

    for (const validation of ruleSet.validations) {
      if (!whenMatches(snapshot, validation.when)) continue;
      validationErrors.push(ruleToValidationError(validation));
    }

    Object.assign(computedFields, ruleSet.computedFields);
  }

  const requiredChecklist: RequiredDocChecklistItem[] = Array.from(requiredReasons.entries())
    .map(([docType, reasons]) => ({
      docType,
      required: true,
      reason: reasons.join("; "),
    }))
    .sort((a, b) => a.docType.localeCompare(b.docType));

  return {
    requiredChecklist,
    validationErrors,
    computedFields,
    notices: Array.from(new Set(notices)),
  };
}
