import { DealType, DocumentTemplateEngine, DocumentType } from "@prisma/client";
import { z } from "zod";
import { complianceRulesJsonSchema } from "@/lib/compliance/schemas";

const stateCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, "Jurisdiction must be a 2-letter state code.");

const requiredFieldsJsonSchema = z.object({
  requiredPaths: z.array(z.string().min(1)).default([]),
});

export const templateFiltersSchema = z.object({
  jurisdiction: stateCodeSchema.optional(),
  docType: z.nativeEnum(DocumentType).optional(),
  dealType: z.nativeEnum(DealType).optional(),
  activeOn: z.coerce.date().optional(),
});

export const templateCreateSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    docType: z.nativeEnum(DocumentType),
    jurisdiction: stateCodeSchema,
    dealType: z.nativeEnum(DealType),
    templateEngine: z.nativeEnum(DocumentTemplateEngine),
    sourceHtml: z.string().min(20).optional(),
    sourceDocxBase64: z.string().min(16).optional(),
    sourceDocxFileName: z.string().trim().min(4).max(180).optional(),
    requiredFieldsJson: requiredFieldsJsonSchema.default({ requiredPaths: [] }),
    effectiveFrom: z.coerce.date(),
    effectiveTo: z.coerce.date().optional(),
    defaultForOrg: z.boolean().default(false),
  })
  .superRefine((value, ctx) => {
    if (value.templateEngine === DocumentTemplateEngine.HTML && !value.sourceHtml) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "HTML source is required when engine is HTML.",
        path: ["sourceHtml"],
      });
    }
    if (value.templateEngine === DocumentTemplateEngine.DOCX && !value.sourceDocxBase64) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "DOCX base64 payload is required when engine is DOCX.",
        path: ["sourceDocxBase64"],
      });
    }
    if (value.effectiveTo && value.effectiveTo < value.effectiveFrom) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "effectiveTo must be after effectiveFrom.",
        path: ["effectiveTo"],
      });
    }
  });

export const templatePatchSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  effectiveFrom: z.coerce.date().optional(),
  effectiveTo: z.coerce.date().nullable().optional(),
  defaultForOrg: z.boolean().optional(),
  requiredFieldsJson: requiredFieldsJsonSchema.optional(),
});

export const templatePreviewSchema = z.object({
  dealId: z.string().cuid().optional(),
  sampleSnapshot: z.record(z.string(), z.unknown()).optional(),
});

const dealSnapshotSchema = z.object({
  dealId: z.string(),
  orgId: z.string(),
  jurisdiction: stateCodeSchema,
  buyerState: z.string().trim().toUpperCase().nullable().optional(),
  dealType: z.nativeEnum(DealType),
  hasTradeIn: z.boolean(),
  isFinanced: z.boolean(),
  hasLienholder: z.boolean(),
  salePrice: z.number(),
  financedAmount: z.number(),
  customer: z.object({
    firstName: z.string(),
    lastName: z.string(),
    email: z.string().email().nullable().optional(),
    phone: z.string().nullable().optional(),
  }),
  vehicle: z.object({
    year: z.number(),
    make: z.string(),
    model: z.string(),
    vin: z.string(),
    mileage: z.number(),
    stockNumber: z.string(),
  }),
  dealer: z.object({
    name: z.string(),
    taxRate: z.number(),
    docFee: z.number(),
    licenseFee: z.number(),
  }),
});

export const rulesetListSchema = z.object({
  jurisdiction: stateCodeSchema.optional(),
  activeOn: z.coerce.date().optional(),
});

export const rulesetCreateSchema = z.object({
  jurisdiction: stateCodeSchema,
  effectiveFrom: z.coerce.date(),
  effectiveTo: z.coerce.date().optional(),
  copyFromId: z.string().cuid().optional(),
  rulesJson: complianceRulesJsonSchema.optional(),
});

export const rulesetPatchSchema = z.object({
  effectiveFrom: z.coerce.date().optional(),
  effectiveTo: z.coerce.date().nullable().optional(),
  rulesJson: complianceRulesJsonSchema.optional(),
});

export const rulesetEvaluateSchema = z.object({
  jurisdiction: stateCodeSchema,
  dealSnapshot: dealSnapshotSchema,
});
