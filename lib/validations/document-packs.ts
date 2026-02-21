import { DealType, DocumentType } from "@prisma/client";
import { z } from "zod";
import { optionalString } from "@/lib/validations/common";

export const documentPackTemplateCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  state: z.string().trim().length(2).transform((value) => value.toUpperCase()),
  saleType: z.nativeEnum(DealType).optional(),
  rulesJson: z.record(z.string(), z.unknown()).optional(),
  items: z
    .array(
      z.object({
        documentType: z.nativeEnum(DocumentType),
        required: z.coerce.boolean().default(true),
        blocking: z.coerce.boolean().default(true),
        sortOrder: z.coerce.number().int().nonnegative().default(0),
        documentTemplateId: z.string().cuid().optional(),
      }),
    )
    .min(1)
    .max(60),
});

export const documentPackGenerateSchema = z.object({
  dealId: z.string().cuid(),
  packTemplateId: z.string().cuid(),
  regenerate: z.coerce.boolean().optional(),
  regenerateReason: optionalString,
});

export const documentPackListSchema = z.object({
  state: z.string().trim().length(2).transform((value) => value.toUpperCase()).optional(),
  saleType: z.nativeEnum(DealType).optional(),
});
