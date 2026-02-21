import { z } from "zod";
import { optionalString } from "@/lib/validations/common";

export const fleetAccountCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  billingTerms: optionalString,
  taxExempt: z.coerce.boolean().default(false),
  notes: optionalString,
  locations: z.array(z.string().trim().min(2).max(160)).max(25).default([]),
  customerIds: z.array(z.string().cuid()).max(500).default([]),
});

export const fleetAccountUpdateSchema = fleetAccountCreateSchema.partial();

export const fleetAccountListSchema = z.object({
  q: z.string().trim().min(1).max(120).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(25),
});
