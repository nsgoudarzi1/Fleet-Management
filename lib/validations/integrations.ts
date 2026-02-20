import { ApiKeyScope } from "@prisma/client";
import { z } from "zod";
import { optionalString } from "@/lib/validations/common";

export const apiKeyCreateSchema = z.object({
  name: z.string().min(2).max(120),
  scopes: z.array(z.nativeEnum(ApiKeyScope)).min(1),
  expiresAt: z.string().datetime().optional(),
});

export const webhookEndpointCreateSchema = z.object({
  name: z.string().min(2).max(120),
  targetUrl: z.string().url(),
  eventTypes: z.array(z.string().min(3)).min(1).max(100),
});

export const webhookEndpointUpdateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  targetUrl: z.string().url().optional(),
  eventTypes: z.array(z.string().min(3)).min(1).max(100).optional(),
  isActive: z.boolean().optional(),
  rotateSecret: z.boolean().optional(),
});

export const webhookRedeliverSchema = z.object({
  deliveryId: z.string().cuid(),
});

export const publicApiAuthHeaderSchema = z.object({
  authorization: z.string().min(1),
});

export const requestIdSchema = z.object({
  requestId: optionalString,
});
