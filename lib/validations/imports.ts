import { AccountType } from "@prisma/client";
import { z } from "zod";

export const importEntityTypeSchema = z.enum(["VEHICLE", "CUSTOMER", "PART", "CHART_OF_ACCOUNT"]);

export const importJobRunSchema = z.object({
  entityType: importEntityTypeSchema,
  fileName: z.string().trim().min(1).max(200),
  csvContent: z.string().min(1),
  mapping: z.record(z.string(), z.string()),
  externalIdColumn: z.string().trim().max(80).optional(),
  defaults: z
    .object({
      accountType: z.nativeEnum(AccountType).optional(),
    })
    .optional(),
});

export const importRollbackSchema = z.object({
  importJobId: z.string().cuid(),
});

