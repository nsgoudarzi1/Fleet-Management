import { createHash } from "node:crypto";
import { AuditAction, Role, type DealType, type DocumentTemplate, type DocumentType } from "@prisma/client";
import { evaluateCompliance } from "@/lib/compliance/evaluate";
import { getAppConfig } from "@/lib/config";
import { buildDealSnapshotFromContext, buildTemplateContextFromDeal, loadDealContextBase, type DealContext } from "@/lib/documents/context";
import { renderDocumentArtifact } from "@/lib/documents/pdf-adapter";
import { renderTemplateHtml } from "@/lib/documents/pdf";
import { prisma } from "@/lib/db/prisma";
import { recordAudit } from "@/lib/services/audit";
import { AppError, requireOrgContext } from "@/lib/services/guard";
import { emitWebhookEvent } from "@/lib/services/integrations";
import { getPrivateObjectBuffer, getPrivateObjectDownloadUrl, putPrivateObject } from "@/lib/storage/object-storage";

type TemplateSelectionInput = {
  orgId: string;
  docType: DocumentType;
  jurisdiction: string;
  dealType: DealType;
  asOf: Date;
};

function inEffectiveWindow(effectiveFrom: Date, effectiveTo: Date | null, asOf: Date) {
  return effectiveFrom.getTime() <= asOf.getTime() && (!effectiveTo || effectiveTo.getTime() >= asOf.getTime());
}

export async function selectBestTemplate(input: TemplateSelectionInput) {
  const candidates = await prisma.documentTemplate.findMany({
    where: {
      docType: input.docType,
      jurisdiction: input.jurisdiction,
      dealType: input.dealType,
      deletedAt: null,
      OR: [{ orgId: input.orgId }, { orgId: null }],
    },
    orderBy: [
      { defaultForOrg: "desc" },
      { isDefault: "desc" },
      { version: "desc" },
      { effectiveFrom: "desc" },
    ],
  });

  const active = candidates.filter((template) => inEffectiveWindow(template.effectiveFrom, template.effectiveTo, input.asOf));
  const orgSpecific = active.filter((template) => template.orgId === input.orgId);
  const global = active.filter((template) => template.orgId === null);
  const pool = orgSpecific.length ? orgSpecific : global;
  return pool[0] ?? null;
}

export async function resolveActiveRuleSets(orgId: string, jurisdiction: string, asOf: Date) {
  const ruleSets = await prisma.complianceRuleSet.findMany({
    where: {
      jurisdiction,
      OR: [{ orgId }, { orgId: null }],
    },
    orderBy: [{ effectiveFrom: "desc" }, { version: "desc" }],
  });

  const filtered = ruleSets.filter((ruleSet) => inEffectiveWindow(ruleSet.effectiveFrom, ruleSet.effectiveTo, asOf));
  const orgSpecific = filtered.filter((item) => item.orgId === orgId);
  const global = filtered.filter((item) => item.orgId === null);
  return [...global, ...orgSpecific];
}

function getByPath(obj: unknown, path: string) {
  return path.split(".").reduce((acc, key) => {
    if (acc === null || acc === undefined || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj as unknown);
}

export function validateTemplateRequiredFields(template: DocumentTemplate, context: Record<string, unknown>) {
  const schema = template.requiredFieldsJson as { requiredPaths?: string[]; required?: string[] } | null;
  const requiredPaths = schema?.requiredPaths ?? schema?.required ?? [];
  return requiredPaths.filter((path) => {
    const value = getByPath(context, path);
    return value === undefined || value === null || value === "";
  });
}

async function generateSingleDocument(input: {
  orgId: string;
  userId: string;
  deal: DealContext;
  docType: DocumentType;
  reason: string;
  regenerateReason?: string;
  allowRegenerate: boolean;
}) {
  const now = new Date();
  const jurisdiction = (input.deal.jurisdiction ?? input.deal.customer.state ?? "TX").toUpperCase();
  const template = await selectBestTemplate({
    orgId: input.orgId,
    docType: input.docType,
    jurisdiction,
    dealType: input.deal.dealType,
    asOf: now,
  });

  if (!template) {
    return {
      docType: input.docType,
      status: "MISSING_TEMPLATE" as const,
      message: `No active template for ${input.docType} (${jurisdiction}).`,
    };
  }
  if (template.templateEngine !== "HTML" || !template.sourceHtml) {
    return {
      docType: input.docType,
      status: "UNSUPPORTED_TEMPLATE" as const,
      message: "Only HTML templates are enabled in this MVP path.",
    };
  }

  const existing = input.deal.documents.find(
    (document) => document.docType === input.docType && document.status !== "VOIDED",
  );
  if (existing?.fileKey && !input.allowRegenerate) {
    return {
      docType: input.docType,
      status: "SKIPPED_EXISTING" as const,
      message: "Document already exists. Use regenerate flow with a reason.",
      documentId: existing.id,
    };
  }
  if (existing?.fileKey && input.allowRegenerate && !input.regenerateReason) {
    return {
      docType: input.docType,
      status: "REGENERATE_REASON_REQUIRED" as const,
      message: "Regenerate reason is required for existing documents.",
      documentId: existing.id,
    };
  }

  const context = buildTemplateContextFromDeal(input.deal);
  const missingFields = validateTemplateRequiredFields(template, context);
  if (missingFields.length) {
    return {
      docType: input.docType,
      status: "MISSING_FIELDS" as const,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    };
  }

  const renderedHtml = renderTemplateHtml(template.sourceHtml, context);
  const artifact = await renderDocumentArtifact({
    title: `${input.deal.dealNumber}-${input.docType}`,
    htmlContent: renderedHtml,
  });

  const fileHash = createHash("sha256").update(artifact.buffer).digest("hex");
  const upload = await putPrivateObject({
    keyPrefix: `${input.orgId}/deals/${input.deal.id}/documents`,
    body: artifact.buffer,
    contentType: artifact.contentType,
    fileName: `${input.deal.dealNumber}-${input.docType}.${artifact.extension}`,
  });

  const persisted = await prisma.$transaction(async (tx) => {
    const payload = {
      orgId: input.orgId,
      dealId: input.deal.id,
      templateId: template.id,
      docType: input.docType,
      status: "GENERATED" as const,
      generatedAt: now,
      fileKey: upload.key,
      fileHash,
      regenerateReason: existing ? input.regenerateReason : undefined,
      createdById: input.userId,
      envelopeId: null,
      metadataJson: {
        reason: input.reason,
        templateVersion: template.version,
        jurisdiction,
        outputContentType: artifact.contentType,
        outputExtension: artifact.extension,
        outputMode: artifact.mode,
        notLegalAdvice:
          "Not legal advice. Validate generated documents and clauses with licensed counsel.",
      },
    };

    const document = existing
      ? await tx.dealDocument.update({
          where: { id: existing.id },
          data: payload,
        })
      : await tx.dealDocument.create({
          data: payload,
        });

    await recordAudit(tx, {
      orgId: input.orgId,
      actorId: input.userId,
      entityType: "DealDocument",
      entityId: document.id,
      action: existing ? AuditAction.UPDATE : AuditAction.CREATE,
      before: existing ?? undefined,
      after: document,
    });
    return document;
  });

  await emitWebhookEvent({
    orgId: input.orgId,
    eventType: "document.generated",
    entityType: "DealDocument",
    entityId: persisted.id,
    payload: {
      dealId: input.deal.id,
      docType: input.docType,
      status: persisted.status,
    },
  });

  return {
    docType: input.docType,
    status: "GENERATED" as const,
    documentId: persisted.id,
    fileKey: persisted.fileKey,
  };
}

export async function getDealDocumentsWorkspace(dealId: string) {
  const ctx = await requireOrgContext(Role.VIEWER);
  const deal = await loadDealContextBase(ctx.orgId, dealId);
  const snapshot = buildDealSnapshotFromContext(deal);
  const ruleSets = await resolveActiveRuleSets(ctx.orgId, snapshot.jurisdiction, new Date());
  const evaluation = evaluateCompliance(snapshot, ruleSets.map((item) => item.rulesJson));

  const templateLookups = await Promise.all(
    evaluation.requiredChecklist.map((item) =>
      selectBestTemplate({
        orgId: ctx.orgId,
        docType: item.docType,
        jurisdiction: snapshot.jurisdiction,
        dealType: snapshot.dealType,
        asOf: new Date(),
      }),
    ),
  );

  const templateByDocType = new Map<DocumentType, DocumentTemplate | null>();
  evaluation.requiredChecklist.forEach((item, index) => {
    templateByDocType.set(item.docType, templateLookups[index]);
  });

  const latestByDocType = new Map<DocumentType, DealContext["documents"][number]>();
  for (const document of deal.documents) {
    if (!latestByDocType.has(document.docType)) {
      latestByDocType.set(document.docType, document);
    }
  }

  return {
    snapshot,
    checklist: evaluation.requiredChecklist.map((item) => {
      const template = templateByDocType.get(item.docType);
      const existing = latestByDocType.get(item.docType);
      return {
        ...item,
        templateAvailable: Boolean(template),
        templateName: template?.name ?? null,
        templateVersion: template?.version ?? null,
        latestDocumentId: existing?.id ?? null,
        latestStatus: existing?.status ?? null,
      };
    }),
    validationErrors: evaluation.validationErrors,
    computedFields: evaluation.computedFields,
    notices: evaluation.notices,
    documents: deal.documents,
    envelopes: deal.documentEnvelopes,
  };
}

export async function generateAllRequiredDealDocuments(input: {
  dealId: string;
  regenerate?: boolean;
  regenerateReason?: string;
}) {
  const appConfig = getAppConfig();
  const ctx = await requireOrgContext(Role.ACCOUNTING);
  const deal = await loadDealContextBase(ctx.orgId, input.dealId);
  const snapshot = buildDealSnapshotFromContext(deal);
  const ruleSets = await resolveActiveRuleSets(ctx.orgId, snapshot.jurisdiction, new Date());
  const evaluation = evaluateCompliance(snapshot, ruleSets.map((item) => item.rulesJson));
  const checklistItems = evaluation.requiredChecklist.slice(0, appConfig.GENERATION_MAX_DOCS_PER_REQUEST);

  const generated = [];
  for (const checklistItem of checklistItems) {
    const result = await generateSingleDocument({
      orgId: ctx.orgId,
      userId: ctx.userId,
      deal,
      docType: checklistItem.docType,
      reason: checklistItem.reason,
      regenerateReason: input.regenerateReason,
      allowRegenerate: Boolean(input.regenerate),
    });
    generated.push(result);
  }

  return {
    generated,
    validationErrors: evaluation.validationErrors,
    notices: [
      ...evaluation.notices,
      ...(evaluation.requiredChecklist.length > checklistItems.length
        ? [
            `Generation capped at ${appConfig.GENERATION_MAX_DOCS_PER_REQUEST} documents per request for serverless safety. Re-run to continue.`,
          ]
        : []),
    ],
  };
}

export async function resolveDealDocumentDownload(documentId: string, dealId: string) {
  const ctx = await requireOrgContext(Role.VIEWER);
  const document = await prisma.dealDocument.findFirst({
    where: {
      id: documentId,
      dealId,
      orgId: ctx.orgId,
    },
  });
  if (!document || !document.fileKey) {
    throw new AppError("Document file not found.", 404);
  }

  await prisma.$transaction(async (tx) => {
    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "DealDocument",
      entityId: document.id,
      action: AuditAction.UPDATE,
      before: document,
      after: {
        ...document,
        metadataJson: {
          ...(document.metadataJson as Record<string, unknown> | null),
          lastDownloadedAt: new Date().toISOString(),
        },
      },
    });
  });

  const downloadUrl = await getPrivateObjectDownloadUrl(document.fileKey);
  const metadata = (document.metadataJson as Record<string, unknown> | null) ?? {};
  const extension = typeof metadata.outputExtension === "string" ? metadata.outputExtension : "pdf";
  const contentType =
    typeof metadata.outputContentType === "string" ? metadata.outputContentType : "application/pdf";
  if (downloadUrl) {
    return {
      type: "redirect" as const,
      downloadUrl,
      fileName: `${document.docType}.${extension}`,
      contentType,
    };
  }

  const buffer = await getPrivateObjectBuffer(document.fileKey);
  return {
    type: "buffer" as const,
    buffer,
    fileName: `${document.docType}.${extension}`,
    contentType,
  };
}
