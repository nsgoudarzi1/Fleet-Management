import { UpfitJobStatus } from "@prisma/client";
import { z } from "zod";
import { optionalString } from "@/lib/validations/common";

export const upfitJobCreateSchema = z.object({
  vehicleId: z.string().cuid().optional(),
  dealId: z.string().cuid().optional(),
  quoteId: z.string().cuid().optional(),
  vendorId: z.string().cuid().optional(),
  status: z.nativeEnum(UpfitJobStatus).default(UpfitJobStatus.PLANNED),
  eta: z.string().datetime().optional(),
  internalNotes: optionalString,
  customerNotes: optionalString,
  costEstimate: z.coerce.number().min(0).default(0),
  actualCost: z.coerce.number().min(0).default(0),
  billableToCustomer: z.coerce.boolean().default(true),
  includeActualCosts: z.coerce.boolean().default(false),
  milestones: z
    .array(
      z.object({
        name: z.string().trim().min(2).max(120),
        dueAt: z.string().datetime().optional(),
      }),
    )
    .max(20)
    .default([]),
});

export const upfitStatusUpdateSchema = z.object({
  jobId: z.string().cuid(),
  status: z.nativeEnum(UpfitJobStatus),
});

export const upfitMilestoneCompleteSchema = z.object({
  milestoneId: z.string().cuid(),
});

export const upfitMilestoneCreateSchema = z.object({
  jobId: z.string().cuid(),
  name: z.string().trim().min(2).max(120),
  dueAt: z.string().datetime().optional(),
});

export const upfitListSchema = z.object({
  status: z.nativeEnum(UpfitJobStatus).optional(),
  q: z.string().trim().min(1).max(120).optional(),
});

export const upfitRollupSchema = z
  .object({
    jobId: z.string().cuid().optional(),
    quoteId: z.string().cuid().optional(),
    dealId: z.string().cuid().optional(),
  })
  .refine((value) => !!(value.jobId || value.quoteId || value.dealId), {
    message: "Provide jobId, quoteId, or dealId.",
  });
