import { AccountType, JournalSourceType, PaymentMethod } from "@prisma/client";
import { z } from "zod";
import { optionalString } from "@/lib/validations/common";

export const paymentCreateSchema = z.object({
  dealId: z.string().cuid().optional(),
  customerId: z.string().cuid().optional(),
  amount: z.coerce.number().min(0.01),
  method: z.nativeEnum(PaymentMethod),
  reference: optionalString,
  postedAt: z.string().datetime().optional(),
  notes: optionalString,
});

export const chartOfAccountCreateSchema = z.object({
  code: z.string().min(2).max(24),
  name: z.string().min(2).max(120),
  type: z.nativeEnum(AccountType),
  description: optionalString,
  isPostingAllowed: z.boolean().optional(),
});

export const chartOfAccountUpdateSchema = chartOfAccountCreateSchema.partial();

export const postingAccountMapSchema = z.object({
  sourceType: z.nativeEnum(JournalSourceType),
  key: z.string().min(2).max(64),
  accountId: z.string().cuid(),
});

export const accountingPeriodCloseSchema = z.object({
  periodId: z.string().cuid(),
});
