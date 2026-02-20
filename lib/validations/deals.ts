import { DealStage, DealType, FundingStatus } from "@prisma/client";
import { z } from "zod";
import { optionalString, positiveMoneySchema } from "@/lib/validations/common";

export const dealCreateSchema = z.object({
  vehicleId: z.string().cuid(),
  customerId: z.string().cuid(),
  salespersonId: z.string().cuid().optional(),
  dealType: z.nativeEnum(DealType).default(DealType.FINANCE),
  jurisdiction: z.string().trim().length(2).optional(),
  salePrice: positiveMoneySchema,
  downPayment: z.coerce.number().min(0).default(0),
  apr: z.coerce.number().min(0).max(30).default(0),
  termMonths: z.coerce.number().int().min(12).max(96).default(60),
  taxes: z.coerce.number().min(0).default(0),
  fees: z.coerce.number().min(0).default(0),
  tradeAllowance: z.coerce.number().min(0).default(0),
  payoff: z.coerce.number().min(0).default(0),
  notes: optionalString,
});

export const dealUpdateSchema = dealCreateSchema.partial();

export const dealStageTransitionSchema = z.object({
  dealId: z.string().cuid(),
  stage: z.nativeEnum(DealStage),
});

export const dealChecklistSchema = z.object({
  dealId: z.string().cuid(),
  insurance: z.boolean(),
  odometer: z.boolean(),
  idVerification: z.boolean(),
  stips: z.boolean(),
});

export const tradeInSchema = z.object({
  dealId: z.string().cuid(),
  vin: z.string().trim().min(11).max(20).optional(),
  year: z.coerce.number().int().min(1980).max(2100).optional(),
  make: optionalString,
  model: optionalString,
  mileage: z.coerce.number().int().min(0).optional(),
  allowance: z.coerce.number().min(0).default(0),
  payoff: z.coerce.number().min(0).default(0),
  actualCashValue: z.coerce.number().min(0).default(0),
});

export const fundingEventSchema = z.object({
  dealId: z.string().cuid(),
  status: z.nativeEnum(FundingStatus),
  amount: z.coerce.number().min(0),
  note: optionalString,
});
