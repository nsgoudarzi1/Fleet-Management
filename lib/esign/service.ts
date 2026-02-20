import { createHash, randomUUID } from "node:crypto";
import { AuditAction, Prisma, Role, type DocumentEnvelopeStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getESignProvider } from "@/lib/esign/provider";
import { recordAudit } from "@/lib/services/audit";
import { AppError, requireOrgContext, requireOrgRoles } from "@/lib/services/guard";
import { emitWebhookEvent } from "@/lib/services/integrations";
import { getPrivateObjectBuffer, getPrivateObjectDownloadUrl, putPrivateObject } from "@/lib/storage/object-storage";
import { sendForEsignSchema, voidEnvelopeSchema } from "@/lib/validations/esign";

function mapEnvelopeToDocumentStatus(status: DocumentEnvelopeStatus) {
  switch (status) {
    case "COMPLETED":
      return "COMPLETED" as const;
    case "PARTIALLY_SIGNED":
      return "PARTIALLY_SIGNED" as const;
    case "VOIDED":
    case "DECLINED":
      return "VOIDED" as const;
    case "ERROR":
      return "FAILED" as const;
    default:
      return "SENT_FOR_SIGNATURE" as const;
  }
}

async function finalizeEnvelopeCompletion(input: {
  envelopeId: string;
  orgId: string;
  dealId: string;
  signedPdfBuffer?: Buffer;
  actorId?: string | null;
}) {
  const documents = await prisma.dealDocument.findMany({
    where: { orgId: input.orgId, dealId: input.dealId, envelopeId: input.envelopeId },
    orderBy: { createdAt: "asc" },
  });
  if (documents.length === 0) return null;

  let signedBuffer = input.signedPdfBuffer;
  if (!signedBuffer) {
    const firstDocument = documents.find((item) => item.fileKey);
    if (firstDocument?.fileKey) {
      signedBuffer = await getPrivateObjectBuffer(firstDocument.fileKey);
    }
  }
  if (!signedBuffer) return null;

  const signedHash = createHash("sha256").update(signedBuffer).digest("hex");
  const signedUpload = await putPrivateObject({
    keyPrefix: `${input.orgId}/deals/${input.dealId}/signed`,
    body: signedBuffer,
    contentType: "application/pdf",
    fileName: `signed-envelope-${input.envelopeId}.pdf`,
  });

  await prisma.$transaction(async (tx) => {
    const envelopeBefore = await tx.documentEnvelope.findUniqueOrThrow({ where: { id: input.envelopeId } });
    const envelopeAfter = await tx.documentEnvelope.update({
      where: { id: input.envelopeId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        metadataJson: {
          ...(envelopeBefore.metadataJson as Record<string, unknown> | null),
          signedCombinedFileKey: signedUpload.key,
          signedCombinedFileHash: signedHash,
        },
      },
    });
    await recordAudit(tx, {
      orgId: input.orgId,
      actorId: input.actorId ?? null,
      entityType: "DocumentEnvelope",
      entityId: input.envelopeId,
      action: AuditAction.UPDATE,
      before: envelopeBefore,
      after: envelopeAfter,
    });

    await tx.dealDocument.updateMany({
      where: { orgId: input.orgId, dealId: input.dealId, envelopeId: input.envelopeId },
      data: {
        status: "COMPLETED",
        metadataJson: {
          signedCombinedFileKey: signedUpload.key,
          completedAt: new Date().toISOString(),
        },
      },
    });
  });

  return signedUpload.key;
}

export async function sendDealDocumentsForESign(dealId: string, input: unknown) {
  const ctx = await requireOrgRoles([Role.ADMIN, Role.ACCOUNTING]);
  const parsed = sendForEsignSchema.parse(input);
  const requestId = parsed.requestId ?? `req-${randomUUID()}`;

  const existingByRequest = await prisma.documentEnvelope.findFirst({
    where: { orgId: ctx.orgId, requestId },
  });
  if (existingByRequest) {
    if (existingByRequest.dealId !== dealId) {
      throw new AppError("requestId already used for another deal.", 409);
    }
    return existingByRequest;
  }

  const deal = await prisma.deal.findFirst({
    where: { id: dealId, orgId: ctx.orgId },
    include: { documents: true },
  });
  if (!deal) throw new AppError("Deal not found.", 404);

  const documents = deal.documents.filter((document) => parsed.documentIds.includes(document.id));
  if (!documents.length) throw new AppError("No eligible generated documents selected.", 400);
  if (documents.some((document) => !document.fileKey || document.status !== "GENERATED")) {
    throw new AppError("All selected documents must be generated before e-sign.", 400);
  }
  if (
    documents.some((document) => {
      const metadata = (document.metadataJson as Record<string, unknown> | null) ?? {};
      const contentType = metadata.outputContentType;
      return typeof contentType === "string" && contentType !== "application/pdf";
    })
  ) {
    throw new AppError(
      "Selected documents are not PDFs. Set PDF_MODE=playwright or PDF_MODE=external to use e-sign.",
      400,
    );
  }

  const provider = getESignProvider();
  const providerDocs = await Promise.all(
    documents.map(async (document) => ({
      id: document.id,
      name: `${document.docType}.pdf`,
      fileKey: document.fileKey!,
      sha256: document.fileHash ?? "",
      buffer: await getPrivateObjectBuffer(document.fileKey!),
    })),
  );
  const providerResult = await provider.createEnvelope({
    orgId: ctx.orgId,
    dealId,
    documents: providerDocs,
    recipients: parsed.recipients,
    requestId,
  });

  const createdEnvelope = await prisma.$transaction(async (tx) => {
    const envelope = await tx.documentEnvelope.create({
      data: {
        orgId: ctx.orgId,
        dealId,
        provider: provider.name,
        providerEnvelopeId: providerResult.providerEnvelopeId,
        requestId,
        status: providerResult.status,
        recipientsJson: parsed.recipients,
        sentAt: new Date(),
        metadataJson: {
          notLegalAdvice: "Not legal advice. Validate signer assignments and legal content with counsel.",
        },
      },
    });
    await tx.dealDocument.updateMany({
      where: { orgId: ctx.orgId, id: { in: parsed.documentIds } },
      data: {
        envelopeId: envelope.id,
        status: mapEnvelopeToDocumentStatus(providerResult.status),
      },
    });
    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "DocumentEnvelope",
      entityId: envelope.id,
      action: AuditAction.CREATE,
      after: envelope,
    });
    return envelope;
  });

  if (providerResult.status === "COMPLETED") {
    const envelopeDetails = await provider.getEnvelope({
      envelopeId: createdEnvelope.id,
      providerEnvelopeId: createdEnvelope.providerEnvelopeId ?? "",
    });
    await finalizeEnvelopeCompletion({
      envelopeId: createdEnvelope.id,
      orgId: ctx.orgId,
      dealId,
      signedPdfBuffer: envelopeDetails.signedPdfBuffer,
      actorId: ctx.userId,
    });
    const completed = await prisma.documentEnvelope.findUniqueOrThrow({ where: { id: createdEnvelope.id } });
    await emitWebhookEvent({
      orgId: ctx.orgId,
      eventType: "envelope.statusChanged",
      entityType: "DocumentEnvelope",
      entityId: createdEnvelope.id,
      payload: {
        previousStatus: "DRAFT",
        nextStatus: completed.status,
        dealId,
      },
    });
    return completed;
  }

  await emitWebhookEvent({
    orgId: ctx.orgId,
    eventType: "envelope.statusChanged",
    entityType: "DocumentEnvelope",
    entityId: createdEnvelope.id,
    payload: {
      previousStatus: "DRAFT",
      nextStatus: createdEnvelope.status,
      dealId,
    },
  });

  return createdEnvelope;
}

export async function voidDealEnvelope(dealId: string, envelopeId: string, input: unknown) {
  const ctx = await requireOrgRoles([Role.ADMIN, Role.ACCOUNTING]);
  const parsed = voidEnvelopeSchema.parse(input);
  const envelope = await prisma.documentEnvelope.findFirst({
    where: { id: envelopeId, orgId: ctx.orgId, dealId },
  });
  if (!envelope) throw new AppError("Envelope not found.", 404);
  if (envelope.status === "COMPLETED" || envelope.status === "VOIDED") {
    throw new AppError("Envelope cannot be voided in its current status.", 400);
  }

  const provider = getESignProvider(envelope.provider as "stub" | "dropboxsign");
  if (envelope.providerEnvelopeId) {
    await provider.voidEnvelope({
      envelopeId: envelope.id,
      providerEnvelopeId: envelope.providerEnvelopeId,
      reason: parsed.reason,
    });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updated = await tx.documentEnvelope.update({
      where: { id: envelope.id },
      data: {
        status: "VOIDED",
        metadataJson: {
          ...(envelope.metadataJson as Record<string, unknown> | null),
          voidReason: parsed.reason,
          voidedAt: new Date().toISOString(),
        },
      },
    });
    await tx.dealDocument.updateMany({
      where: { orgId: ctx.orgId, envelopeId: envelope.id },
      data: { status: "VOIDED", voidedAt: new Date() },
    });
    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "DocumentEnvelope",
      entityId: envelope.id,
      action: AuditAction.UPDATE,
      before: envelope,
      after: updated,
    });
    return updated;
  });
  await emitWebhookEvent({
    orgId: ctx.orgId,
    eventType: "envelope.statusChanged",
    entityType: "DocumentEnvelope",
    entityId: envelope.id,
    payload: {
      previousStatus: envelope.status,
      nextStatus: "VOIDED",
      dealId,
    },
  });
  return updated;
}

export async function completeStubEnvelope(dealId: string, envelopeId: string) {
  const ctx = await requireOrgRoles([Role.ADMIN, Role.ACCOUNTING]);
  const envelope = await prisma.documentEnvelope.findFirst({
    where: { id: envelopeId, orgId: ctx.orgId, dealId, provider: "stub" },
  });
  if (!envelope) throw new AppError("Stub envelope not found.", 404);
  if (envelope.status === "COMPLETED") return envelope;

  await finalizeEnvelopeCompletion({
    envelopeId: envelope.id,
    orgId: ctx.orgId,
    dealId,
    actorId: ctx.userId,
  });
  await emitWebhookEvent({
    orgId: ctx.orgId,
    eventType: "envelope.statusChanged",
    entityType: "DocumentEnvelope",
    entityId: envelope.id,
    payload: {
      previousStatus: envelope.status,
      nextStatus: "COMPLETED",
      dealId,
    },
  });
  return prisma.documentEnvelope.findUniqueOrThrow({ where: { id: envelope.id } });
}

export async function processESignWebhook(providerName: string, request: Request) {
  const provider = getESignProvider(providerName as "stub" | "dropboxsign");
  const verification = await provider.verifyWebhook(request);
  if (!verification.ok || !verification.event) {
    throw new AppError("Invalid webhook signature or payload.", 401);
  }
  const event = verification.event;

  const envelope = await prisma.documentEnvelope.findFirst({
    where: {
      provider: provider.name,
      providerEnvelopeId: event.providerEnvelopeId,
    },
  });
  if (!envelope) {
    return { accepted: true, status: "envelope_not_found" };
  }

  try {
    await prisma.documentEvent.create({
      data: {
        orgId: envelope.orgId,
        envelopeId: envelope.id,
        provider: provider.name,
        type: event.eventType,
        providerEventId: event.providerEventId,
        idempotencyKey: event.idempotencyKey ?? `${provider.name}:${event.providerEventId ?? event.eventType}`,
        payloadJson: event.payload as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { accepted: true, status: "duplicate_event" };
    }
    throw error;
  }

  const details = await provider.getEnvelope({
    envelopeId: envelope.id,
    providerEnvelopeId: envelope.providerEnvelopeId ?? "",
  });
  await prisma.$transaction(async (tx) => {
    const nextEnvelope = await tx.documentEnvelope.update({
      where: { id: envelope.id },
      data: {
        status: details.status,
        completedAt: details.status === "COMPLETED" ? new Date() : envelope.completedAt,
      },
    });
    await tx.dealDocument.updateMany({
      where: { orgId: envelope.orgId, envelopeId: envelope.id },
      data: {
        status: mapEnvelopeToDocumentStatus(details.status),
      },
    });
    await recordAudit(tx, {
      orgId: envelope.orgId,
      actorId: null,
      entityType: "DocumentEnvelope",
      entityId: envelope.id,
      action: AuditAction.UPDATE,
      before: envelope,
      after: nextEnvelope,
    });
  });

  await emitWebhookEvent({
    orgId: envelope.orgId,
    eventType: "envelope.statusChanged",
    entityType: "DocumentEnvelope",
    entityId: envelope.id,
    payload: {
      previousStatus: envelope.status,
      nextStatus: details.status,
      dealId: envelope.dealId,
    },
  });

  if (details.status === "COMPLETED") {
    await finalizeEnvelopeCompletion({
      envelopeId: envelope.id,
      orgId: envelope.orgId,
      dealId: envelope.dealId,
      signedPdfBuffer: details.signedPdfBuffer,
      actorId: null,
    });
  }

  return { accepted: true, status: details.status };
}

export async function resolveSignedEnvelopeDownload(dealId: string, envelopeId: string) {
  const ctx = await requireOrgContext(Role.VIEWER);
  const envelope = await prisma.documentEnvelope.findFirst({
    where: {
      id: envelopeId,
      dealId,
      orgId: ctx.orgId,
    },
  });
  if (!envelope) throw new AppError("Envelope not found.", 404);

  const metadata = (envelope.metadataJson as Record<string, unknown> | null) ?? {};
  const signedFileKey = typeof metadata.signedCombinedFileKey === "string" ? metadata.signedCombinedFileKey : null;
  if (!signedFileKey) throw new AppError("Signed document is not available yet.", 404);

  await prisma.$transaction(async (tx) => {
    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "DocumentEnvelope",
      entityId: envelope.id,
      action: AuditAction.UPDATE,
      before: envelope,
      after: {
        ...envelope,
        metadataJson: {
          ...metadata,
          lastSignedDownloadAt: new Date().toISOString(),
        },
      },
    });
  });

  const downloadUrl = await getPrivateObjectDownloadUrl(signedFileKey);
  if (downloadUrl) {
    return {
      type: "redirect" as const,
      downloadUrl,
      fileName: `signed-envelope-${envelope.id}.pdf`,
    };
  }
  const buffer = await getPrivateObjectBuffer(signedFileKey);
  return {
    type: "buffer" as const,
    buffer,
    fileName: `signed-envelope-${envelope.id}.pdf`,
  };
}
