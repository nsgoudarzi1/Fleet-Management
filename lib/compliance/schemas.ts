import { DealType, DocumentType } from "@prisma/client";
import { z } from "zod";

const whenClauseSchema = z
  .object({
    state: z.array(z.string().trim().length(2).transform((value) => value.toUpperCase())).optional(),
    saleType: z.array(z.nativeEnum(DealType)).optional(),
    dealType: z.array(z.nativeEnum(DealType)).optional(),
    hasTradeIn: z.boolean().optional(),
    isOutOfStateBuyer: z.boolean().optional(),
    isFinanced: z.boolean().optional(),
    hasLienholder: z.boolean().optional(),
    minGvwr: z.coerce.number().int().positive().optional(),
    maxGvwr: z.coerce.number().int().positive().optional(),
  })
  .partial();

const scenarioRuleSchema = z.object({
  when: whenClauseSchema.default({}),
  requiredDocuments: z.array(z.nativeEnum(DocumentType)).default([]),
  optionalDocuments: z.array(z.nativeEnum(DocumentType)).default([]),
  notes: z.string().optional(),
});

const validationRuleSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  severity: z.enum(["error", "warning"]).default("error"),
  field: z.string().optional(),
  when: whenClauseSchema.default({}),
});

const computedFieldSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const complianceRulesJsonSchema = z.object({
  metadata: z
    .object({
      title: z.string().optional(),
      notes: z.string().optional(),
      notLegalAdvice: z.boolean().optional(),
    })
    .optional(),
  scenarios: z.array(scenarioRuleSchema).default([]),
  validations: z.array(validationRuleSchema).default([]),
  computedFields: z.record(z.string(), computedFieldSchema).default({}),
});

export type ComplianceRulesJson = z.infer<typeof complianceRulesJsonSchema>;
export type ComplianceWhenClause = z.infer<typeof whenClauseSchema>;
export type ComplianceValidationRule = z.infer<typeof validationRuleSchema>;
