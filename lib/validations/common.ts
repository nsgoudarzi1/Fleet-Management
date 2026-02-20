import { z } from "zod";

export const cuidSchema = z.string().cuid();

export const positiveMoneySchema = z.coerce.number().min(0).max(1_000_000_000);
export const integerSchema = z.coerce.number().int();

export const optionalString = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? undefined : value))
  .optional();
