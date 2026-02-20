import { FundingCaseStatus } from "@prisma/client";
import { z } from "zod";
import { optionalString } from "@/lib/validations/common";

export const fundingCaseCreateSchema = z.object({
  dealId: z.string().cuid(),
  lenderName: z.string().min(2),
  lenderContactName: optionalString,
  lenderContactEmail: z.string().email().optional(),
  lenderContactPhone: optionalString,
  amountFinanced: z.coerce.number().min(0),
  reserveAmount: z.coerce.number().min(0).default(0),
  feeTotal: z.coerce.number().min(0).default(0),
  nextAction: optionalString,
  nextActionAt: z.string().datetime().optional(),
  notes: optionalString,
});

export const fundingCaseUpdateSchema = z.object({
  fundingCaseId: z.string().cuid(),
  lenderName: z.string().min(2).optional(),
  lenderContactName: optionalString,
  lenderContactEmail: z.string().email().optional(),
  lenderContactPhone: optionalString,
  amountFinanced: z.coerce.number().min(0).optional(),
  reserveAmount: z.coerce.number().min(0).optional(),
  feeTotal: z.coerce.number().min(0).optional(),
  nextAction: optionalString,
  nextActionAt: z.string().datetime().optional(),
  notes: optionalString,
});

export const fundingCaseStatusSchema = z.object({
  fundingCaseId: z.string().cuid(),
  status: z.nativeEnum(FundingCaseStatus),
  note: optionalString,
});

export const fundingStipUpsertSchema = z.object({
  fundingCaseId: z.string().cuid(),
  stipId: z.string().cuid().optional(),
  docType: z.string().min(2),
  required: z.boolean().default(true),
  received: z.boolean().optional(),
  verified: z.boolean().optional(),
  notes: optionalString,
  attachmentJson: z.record(z.string(), z.unknown()).optional(),
});

export const fundingQueueFilterSchema = z.object({
  status: z.nativeEnum(FundingCaseStatus).optional(),
  query: optionalString,
});
