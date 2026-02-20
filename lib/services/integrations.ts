import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { AuditAction, PermissionScope, Prisma, Role, WebhookDeliveryStatus, type ApiKeyScope } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import { recordAudit } from "@/lib/services/audit";
import { AppError, requireOrgContext, requirePerm } from "@/lib/services/guard";
import {
  apiKeyCreateSchema,
  webhookEndpointCreateSchema,
  webhookEndpointUpdateSchema,
  webhookRedeliverSchema,
} from "@/lib/validations/integrations";

const RETRY_SCHEDULE_SECONDS = [60, 300, 900, 3600, 21600];

function digestKey(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

function hmacForPayload(secret: string, timestamp: string, payload: string) {
  return createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
}

function retryAt(attemptCount: number) {
  const next = RETRY_SCHEDULE_SECONDS[Math.min(attemptCount, RETRY_SCHEDULE_SECONDS.length - 1)] ?? 21600;
  return new Date(Date.now() + next * 1000);
}

export async function listApiKeys() {
  const ctx = await requirePerm(PermissionScope.INTEGRATIONS_MANAGE);
  const items = await prisma.apiKey.findMany({
    where: { orgId: ctx.orgId },
    orderBy: { createdAt: "desc" },
  });
  return items.map((item) => ({
    ...item,
    keyHash: undefined,
  }));
}

export async function createApiKey(input: unknown) {
  const ctx = await requirePerm(PermissionScope.INTEGRATIONS_MANAGE);
  const parsed = apiKeyCreateSchema.parse(input);
  const raw = `ff_${randomBytes(24).toString("hex")}`;
  const prefix = raw.slice(0, 12);

  const created = await prisma.$transaction(async (tx) => {
    const apiKey = await tx.apiKey.create({
      data: {
        orgId: ctx.orgId,
        name: parsed.name,
        keyPrefix: prefix,
        keyHash: digestKey(raw),
        scopes: parsed.scopes,
        expiresAt: parsed.expiresAt ? new Date(parsed.expiresAt) : undefined,
        createdById: ctx.userId,
      },
    });
    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "ApiKey",
      entityId: apiKey.id,
      action: AuditAction.CREATE,
      after: {
        id: apiKey.id,
        name: apiKey.name,
        keyPrefix: apiKey.keyPrefix,
        scopes: apiKey.scopes,
      },
    });
    return apiKey;
  });

  return {
    ...created,
    keyHash: undefined,
    rawKey: raw,
  };
}

export async function revokeApiKey(apiKeyId: string) {
  const ctx = await requirePerm(PermissionScope.INTEGRATIONS_MANAGE);
  const existing = await prisma.apiKey.findFirst({
    where: { id: apiKeyId, orgId: ctx.orgId },
  });
  if (!existing) throw new AppError("API key not found.", 404);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.apiKey.update({
      where: { id: apiKeyId },
      data: { isActive: false },
    });
    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "ApiKey",
      entityId: apiKeyId,
      action: AuditAction.UPDATE,
      before: existing,
      after: updated,
    });
    return updated;
  });
}

export async function listWebhookEndpoints() {
  const ctx = await requirePerm(PermissionScope.INTEGRATIONS_MANAGE);
  const [rawEndpoints, recentDeliveries] = await Promise.all([
    prisma.webhookEndpoint.findMany({
      where: { orgId: ctx.orgId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.webhookDelivery.findMany({
      where: { orgId: ctx.orgId },
      include: {
        webhookEvent: true,
        endpoint: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);
  const endpoints = rawEndpoints.map((endpoint) => ({
    id: endpoint.id,
    orgId: endpoint.orgId,
    name: endpoint.name,
    targetUrl: endpoint.targetUrl,
    eventTypes: endpoint.eventTypes,
    isActive: endpoint.isActive,
    createdById: endpoint.createdById,
    createdAt: endpoint.createdAt,
    updatedAt: endpoint.updatedAt,
  }));
  return { endpoints, recentDeliveries };
}

export async function createWebhookEndpoint(input: unknown) {
  const ctx = await requirePerm(PermissionScope.INTEGRATIONS_MANAGE);
  const parsed = webhookEndpointCreateSchema.parse(input);
  const secret = `whsec_${randomBytes(24).toString("hex")}`;

  const endpoint = await prisma.$transaction(async (tx) => {
    const created = await tx.webhookEndpoint.create({
      data: {
        orgId: ctx.orgId,
        name: parsed.name,
        targetUrl: parsed.targetUrl,
        eventTypes: parsed.eventTypes,
        secret,
        createdById: ctx.userId,
      },
    });
    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "WebhookEndpoint",
      entityId: created.id,
      action: AuditAction.CREATE,
      after: created,
    });
    return created;
  });

  return {
    ...endpoint,
    secret,
  };
}

export async function updateWebhookEndpoint(endpointId: string, input: unknown) {
  const ctx = await requirePerm(PermissionScope.INTEGRATIONS_MANAGE);
  const parsed = webhookEndpointUpdateSchema.parse(input);

  const existing = await prisma.webhookEndpoint.findFirst({
    where: { id: endpointId, orgId: ctx.orgId },
  });
  if (!existing) throw new AppError("Webhook endpoint not found.", 404);

  const nextSecret = parsed.rotateSecret ? `whsec_${randomBytes(24).toString("hex")}` : existing.secret;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.webhookEndpoint.update({
      where: { id: endpointId },
      data: {
        name: parsed.name,
        targetUrl: parsed.targetUrl,
        eventTypes: parsed.eventTypes,
        isActive: parsed.isActive,
        secret: nextSecret,
      },
    });
    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "WebhookEndpoint",
      entityId: endpointId,
      action: AuditAction.UPDATE,
      before: existing,
      after: updated,
    });
    return {
      ...updated,
      secret: undefined,
      rotatedSecret: parsed.rotateSecret ? nextSecret : undefined,
    };
  });
}

export async function emitWebhookEvent(input: {
  orgId: string;
  eventType: string;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
}) {
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: {
      orgId: input.orgId,
      isActive: true,
      OR: [{ eventTypes: { has: input.eventType } }, { eventTypes: { has: "*" } }],
    },
  });

  if (!endpoints.length) return null;

  return prisma.$transaction(async (tx) => {
    const event = await tx.webhookEvent.create({
      data: {
        orgId: input.orgId,
        eventType: input.eventType,
        entityType: input.entityType,
        entityId: input.entityId,
        payloadJson: input.payload as Prisma.InputJsonValue,
      },
    });

    await tx.webhookDelivery.createMany({
      data: endpoints.map((endpoint) => ({
        orgId: input.orgId,
        webhookEventId: event.id,
        endpointId: endpoint.id,
        status: WebhookDeliveryStatus.PENDING,
        nextAttemptAt: new Date(),
      })),
    });

    return event;
  });
}

export async function deliverPendingWebhooks(limit = 20, orgId?: string) {
  const now = new Date();
  const deliveries = await prisma.webhookDelivery.findMany({
    where: {
      ...(orgId ? { orgId } : {}),
      status: { in: [WebhookDeliveryStatus.PENDING, WebhookDeliveryStatus.FAILED] },
      nextAttemptAt: { lte: now },
    },
    include: {
      endpoint: true,
      webhookEvent: true,
    },
    orderBy: { nextAttemptAt: "asc" },
    take: Math.max(1, Math.min(100, limit)),
  });

  const results: Array<{ id: string; status: string; attempts: number }> = [];

  for (const delivery of deliveries) {
    const payload = JSON.stringify(delivery.webhookEvent.payloadJson);
    const timestamp = `${Math.floor(Date.now() / 1000)}`;
    const signature = hmacForPayload(delivery.endpoint.secret, timestamp, payload);

    try {
      const response = await fetch(delivery.endpoint.targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-FleetFlow-Event": delivery.webhookEvent.eventType,
          "X-FleetFlow-Delivery": delivery.id,
          "X-FleetFlow-Timestamp": timestamp,
          "X-FleetFlow-Signature": signature,
        },
        body: payload,
      });

      if (response.ok) {
        await prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            status: WebhookDeliveryStatus.DELIVERED,
            deliveredAt: new Date(),
            lastAttemptAt: new Date(),
            attemptCount: { increment: 1 },
            responseStatus: response.status,
            responseBody: await response.text(),
            errorMessage: null,
          },
        });
        results.push({ id: delivery.id, status: "DELIVERED", attempts: delivery.attemptCount + 1 });
        continue;
      }

      const nextAttempts = delivery.attemptCount + 1;
      const dead = nextAttempts >= RETRY_SCHEDULE_SECONDS.length;
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: dead ? WebhookDeliveryStatus.DEAD : WebhookDeliveryStatus.FAILED,
          attemptCount: { increment: 1 },
          lastAttemptAt: new Date(),
          nextAttemptAt: dead ? delivery.nextAttemptAt : retryAt(delivery.attemptCount),
          responseStatus: response.status,
          responseBody: await response.text(),
          errorMessage: `HTTP ${response.status}`,
        },
      });
      results.push({ id: delivery.id, status: dead ? "DEAD" : "FAILED", attempts: nextAttempts });
    } catch (error) {
      const nextAttempts = delivery.attemptCount + 1;
      const dead = nextAttempts >= RETRY_SCHEDULE_SECONDS.length;
      const message = error instanceof Error ? error.message : "Unknown webhook delivery error";
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: dead ? WebhookDeliveryStatus.DEAD : WebhookDeliveryStatus.FAILED,
          attemptCount: { increment: 1 },
          lastAttemptAt: new Date(),
          nextAttemptAt: dead ? delivery.nextAttemptAt : retryAt(delivery.attemptCount),
          responseStatus: null,
          responseBody: null,
          errorMessage: message,
        },
      });
      logger.error("Webhook delivery failed", {
        deliveryId: delivery.id,
        endpointId: delivery.endpointId,
        message,
      });
      results.push({ id: delivery.id, status: dead ? "DEAD" : "FAILED", attempts: nextAttempts });
    }
  }

  return results;
}

export async function runWebhookWorkerForOrg(limit = 20) {
  const ctx = await requirePerm(PermissionScope.INTEGRATIONS_MANAGE);
  return deliverPendingWebhooks(limit, ctx.orgId);
}

export async function redeliverWebhook(input: unknown) {
  const ctx = await requirePerm(PermissionScope.INTEGRATIONS_MANAGE);
  const parsed = webhookRedeliverSchema.parse(input);
  const delivery = await prisma.webhookDelivery.findFirst({
    where: { id: parsed.deliveryId, orgId: ctx.orgId },
  });
  if (!delivery) throw new AppError("Delivery not found.", 404);

  await prisma.webhookDelivery.update({
    where: { id: parsed.deliveryId },
    data: {
      status: WebhookDeliveryStatus.PENDING,
      nextAttemptAt: new Date(),
      errorMessage: null,
    },
  });

  return deliverPendingWebhooks(1, ctx.orgId);
}

export async function redeliverWebhookEvent(input: { webhookEventId: string }) {
  const ctx = await requirePerm(PermissionScope.INTEGRATIONS_MANAGE);
  const event = await prisma.webhookEvent.findFirst({
    where: { id: input.webhookEventId, orgId: ctx.orgId },
  });
  if (!event) throw new AppError("Webhook event not found.", 404);

  await prisma.webhookDelivery.updateMany({
    where: {
      orgId: ctx.orgId,
      webhookEventId: input.webhookEventId,
    },
    data: {
      status: WebhookDeliveryStatus.PENDING,
      nextAttemptAt: new Date(),
      errorMessage: null,
    },
  });

  return deliverPendingWebhooks(10, ctx.orgId);
}

function readApiKeyFromRequest(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  const header = request.headers.get("x-api-key");
  return header?.trim() ?? "";
}

export async function requireApiKeyScope(request: Request, scope: ApiKeyScope) {
  const raw = readApiKeyFromRequest(request);
  if (!raw) throw new AppError("Missing API key.", 401);

  const hashed = digestKey(raw);
  const apiKey = await prisma.apiKey.findFirst({
    where: {
      keyHash: hashed,
      isActive: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
  });

  if (!apiKey) throw new AppError("Invalid API key.", 401);

  const safeA = Buffer.from(apiKey.keyHash, "hex");
  const safeB = Buffer.from(hashed, "hex");
  if (safeA.length !== safeB.length || !timingSafeEqual(safeA, safeB)) {
    throw new AppError("Invalid API key.", 401);
  }

  if (!apiKey.scopes.includes(scope)) {
    throw new AppError("API key scope does not allow this operation.", 403);
  }

  await prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  });

  return {
    orgId: apiKey.orgId,
    apiKeyId: apiKey.id,
    scopes: apiKey.scopes,
  };
}

export async function verifyInboundIntegrationSignature(request: Request, secret: string) {
  const timestamp = request.headers.get("x-fleetflow-timestamp") ?? "";
  const signature = request.headers.get("x-fleetflow-signature") ?? "";
  const payload = await request.text();
  if (!timestamp || !signature) return { ok: false as const, payload };

  const expected = hmacForPayload(secret, timestamp, payload);
  const expectedBuf = Buffer.from(expected, "hex");
  const actualBuf = Buffer.from(signature, "hex");

  if (expectedBuf.length !== actualBuf.length) return { ok: false as const, payload };
  return { ok: timingSafeEqual(expectedBuf, actualBuf), payload };
}

export async function listIntegrationsSettings() {
  await requireOrgContext(Role.VIEWER);
  const [apiKeys, webhooks] = await Promise.all([listApiKeys(), listWebhookEndpoints()]);
  return {
    apiKeys,
    webhooks,
  };
}
