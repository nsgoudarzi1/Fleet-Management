import { ApprovalStatus, QuoteStatus } from "@prisma/client";
import { z } from "zod";
import { optionalString } from "@/lib/validations/common";

export const quoteCreateSchema = z.object({
  customerId: z.string().cuid().optional(),
  fleetAccountId: z.string().cuid().optional(),
  dealId: z.string().cuid().optional(),
  expiresAt: z.string().datetime().optional(),
  notes: optionalString,
});

export const quoteListSchema = z.object({
  q: z.string().trim().min(1).max(120).optional(),
  status: z.nativeEnum(QuoteStatus).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(25),
});

export const quoteLineCreateSchema = z.object({
  vehicleId: z.string().cuid().optional(),
  description: z.string().trim().min(2).max(200),
  quantity: z.coerce.number().positive().max(1000).default(1),
  unitPrice: z.coerce.number().min(0).max(1_000_000_000),
  taxable: z.coerce.boolean().default(true),
  unitCost: z.coerce.number().min(0).max(1_000_000_000).default(0),
});

export const quoteLineDeleteSchema = z.object({
  lineId: z.string().cuid(),
});

export const quoteStatusUpdateSchema = z.object({
  status: z.nativeEnum(QuoteStatus),
});

export const quoteShareSchema = z.object({
  expiresAt: z.string().datetime().optional(),
});

export const approvalCreateSchema = z.object({
  entityType: z.string().trim().min(2).max(80),
  entityId: z.string().cuid(),
  quoteId: z.string().cuid().optional(),
  reason: z.string().trim().min(4).max(500),
  delta: z.coerce.number(),
});

export const approvalReviewSchema = z.object({
  approvalId: z.string().cuid(),
  status: z.nativeEnum(ApprovalStatus),
  responseNote: optionalString,
});
