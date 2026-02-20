import { z } from "zod";

const emailSchema = z.string().trim().email();

export const esignRecipientSchema = z.object({
  role: z.enum(["buyer", "co_buyer", "seller", "dealer"]),
  name: z.string().trim().min(2).max(120),
  email: emailSchema,
  order: z.number().int().min(1).max(10).default(1),
});

export const sendForEsignSchema = z.object({
  documentIds: z.array(z.string().cuid()).min(1),
  recipients: z.array(esignRecipientSchema).min(1),
  requestId: z.string().trim().min(6).max(120).optional(),
});

export const voidEnvelopeSchema = z.object({
  reason: z.string().trim().min(5).max(500),
});

export const completeStubEnvelopeSchema = z.object({
  requestId: z.string().trim().min(6).max(120).optional(),
});
