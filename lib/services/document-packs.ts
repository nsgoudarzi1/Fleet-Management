import { AuditAction, DealDocumentChecklistStatus, Role, type Prisma } from "@prisma/client";
import { buildTemplateContextFromDeal, loadDealContextBase } from "@/lib/documents/context";
import { generateAllRequiredDealDocuments, selectBestTemplate, validateTemplateRequiredFields } from "@/lib/documents/service";
import { prisma } from "@/lib/db/prisma";
import { recordAudit } from "@/lib/services/audit";
import { resolveChecklistStatus } from "@/lib/services/document-pack-utils";
import { AppError, requireOrgContext } from "@/lib/services/guard";
import {
  documentPackGenerateSchema,
  documentPackListSchema,
  documentPackTemplateCreateSchema,
} from "@/lib/validations/document-packs";

export async function listDocumentPackTemplates(rawInput: unknown) {
  const ctx = await requireOrgContext(Role.VIEWER);
  const input = documentPackListSchema.parse(rawInput ?? {});
  return prisma.documentPackTemplate.findMany({
    where: {
      orgId: ctx.orgId,
      ...(input.state ? { state: input.state } : {}),
      ...(input.saleType ? { saleType: input.saleType } : {}),
    },
    include: {
      items: {
        include: {
          documentTemplate: true,
        },
        orderBy: [{ sortOrder: "asc" }, { documentType: "asc" }],
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createDocumentPackTemplate(rawInput: unknown) {
  const ctx = await requireOrgContext(Role.ACCOUNTING);
  const input = documentPackTemplateCreateSchema.parse(rawInput);

  return prisma.$transaction(async (tx) => {
    const created = await tx.documentPackTemplate.create({
      data: {
        orgId: ctx.orgId,
        name: input.name,
        state: input.state,
        saleType: input.saleType,
        rulesJson: input.rulesJson as Prisma.InputJsonValue | undefined,
        items: {
          create: input.items.map((item) => ({
            orgId: ctx.orgId,
            documentType: item.documentType,
            required: item.required,
            blocking: item.blocking,
            sortOrder: item.sortOrder,
            documentTemplateId: item.documentTemplateId,
          })),
        },
      },
      include: {
        items: true,
      },
    });
    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "DocumentPackTemplate",
      entityId: created.id,
      action: AuditAction.CREATE,
      after: created,
    });
    return created;
  });
}

export async function getDealDocumentChecklist(dealId: string) {
  const ctx = await requireOrgContext(Role.VIEWER);
  const deal = await prisma.deal.findFirst({
    where: { id: dealId, orgId: ctx.orgId },
    select: { id: true },
  });
  if (!deal) throw new AppError("Deal not found.", 404);

  return prisma.dealDocumentChecklistItem.findMany({
    where: { orgId: ctx.orgId, dealId },
    include: {
      generatedDocument: true,
      packTemplate: true,
    },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
  });
}

export async function generateDocumentPack(rawInput: unknown) {
  const ctx = await requireOrgContext(Role.ACCOUNTING);
  const input = documentPackGenerateSchema.parse(rawInput);

  const [deal, packTemplate] = await Promise.all([
    loadDealContextBase(ctx.orgId, input.dealId),
    prisma.documentPackTemplate.findFirst({
      where: { id: input.packTemplateId, orgId: ctx.orgId },
      include: {
        items: {
          include: {
            documentTemplate: true,
          },
          orderBy: [{ sortOrder: "asc" }, { documentType: "asc" }],
        },
      },
    }),
  ]);

  if (!packTemplate) throw new AppError("Document pack template not found.", 404);
  if (packTemplate.saleType && packTemplate.saleType !== deal.dealType) {
    throw new AppError("Pack sale type does not match this deal.", 400);
  }
  const dealState = (deal.jurisdiction ?? deal.customer.state ?? "TX").toUpperCase();
  if (packTemplate.state !== dealState) {
    throw new AppError(`Pack state ${packTemplate.state} does not match deal state ${dealState}.`, 400);
  }

  const templateContext = buildTemplateContextFromDeal(deal);
  const now = new Date();
  const checklistStates = await Promise.all(
    packTemplate.items.map(async (item) => {
      const selectedTemplate = await selectBestTemplate({
        orgId: ctx.orgId,
        docType: item.documentType,
        jurisdiction: dealState,
        dealType: deal.dealType,
        asOf: now,
      });
      if (!selectedTemplate) {
        return {
          item,
          status: DealDocumentChecklistStatus.BLOCKED,
          missingFields: [] as string[],
          note: "No active template available for this document type.",
        };
      }
      const missingFields = validateTemplateRequiredFields(selectedTemplate, templateContext);
      if (missingFields.length) {
        return {
          item,
          status: DealDocumentChecklistStatus.MISSING_DATA,
          missingFields,
          note: "Missing required fields for generation.",
        };
      }
      return {
        item,
        status: DealDocumentChecklistStatus.PENDING,
        missingFields: [] as string[],
        note: null,
      };
    }),
  );

  const generated = await generateAllRequiredDealDocuments({
    dealId: input.dealId,
    regenerate: input.regenerate,
    regenerateReason: input.regenerateReason,
  });

  const docs = await prisma.dealDocument.findMany({
    where: {
      orgId: ctx.orgId,
      dealId: input.dealId,
    },
    orderBy: { createdAt: "desc" },
  });
  const latestByDocType = new Map<string, (typeof docs)[number]>();
  for (const doc of docs) {
    if (!latestByDocType.has(doc.docType)) latestByDocType.set(doc.docType, doc);
  }

  await prisma.$transaction(async (tx) => {
    for (const state of checklistStates) {
      const existing = await tx.dealDocumentChecklistItem.findFirst({
        where: {
          orgId: ctx.orgId,
          dealId: input.dealId,
          packTemplateId: packTemplate.id,
          documentType: state.item.documentType,
        },
      });
      const generatedDoc = latestByDocType.get(state.item.documentType);
      const nextStatus = resolveChecklistStatus({
        hasTemplate: state.status !== DealDocumentChecklistStatus.BLOCKED,
        missingFields: state.missingFields,
        generated: generatedDoc?.status === "GENERATED",
      });
      const payload = {
        required: state.item.required,
        blocking: state.item.blocking,
        status: nextStatus,
        generatedDocumentId: generatedDoc?.id,
        missingFieldsJson: state.missingFields.length
          ? {
              fields: state.missingFields,
            }
          : undefined,
        notes: state.note,
      };
      if (existing) {
        await tx.dealDocumentChecklistItem.update({
          where: { id: existing.id },
          data: payload,
        });
      } else {
        await tx.dealDocumentChecklistItem.create({
          data: {
            orgId: ctx.orgId,
            dealId: input.dealId,
            packTemplateId: packTemplate.id,
            documentType: state.item.documentType,
            ...payload,
          },
        });
      }
    }

    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "DocumentPack",
      entityId: packTemplate.id,
      action: AuditAction.UPDATE,
      after: {
        dealId: input.dealId,
        checklistCount: checklistStates.length,
        generatedCount: generated.generated.filter((item) => item.status === "GENERATED").length,
      },
    });
  });

  const checklist = await prisma.dealDocumentChecklistItem.findMany({
    where: {
      orgId: ctx.orgId,
      dealId: input.dealId,
      packTemplateId: packTemplate.id,
    },
    include: {
      generatedDocument: true,
    },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
  });

  return {
    packTemplate,
    checklist,
    generated,
  };
}
