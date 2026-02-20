import { createHash } from "node:crypto";
import { AuditAction, DocumentTemplateEngine, Role } from "@prisma/client";
import { evaluateCompliance, type DealSnapshot } from "@/lib/compliance/evaluate";
import { complianceRulesJsonSchema } from "@/lib/compliance/schemas";
import { buildTemplateContextFromDeal, CANONICAL_TEMPLATE_VARIABLES, loadDealContextBase } from "@/lib/documents/context";
import { renderDocumentArtifact } from "@/lib/documents/pdf-adapter";
import { renderTemplateHtml } from "@/lib/documents/pdf";
import { resolveActiveRuleSets } from "@/lib/documents/service";
import { prisma } from "@/lib/db/prisma";
import { recordAudit } from "@/lib/services/audit";
import { AppError, requireOrgRoles } from "@/lib/services/guard";
import { putPrivateObject } from "@/lib/storage/object-storage";
import {
  rulesetCreateSchema,
  rulesetEvaluateSchema,
  rulesetListSchema,
  rulesetPatchSchema,
  templateCreateSchema,
  templateFiltersSchema,
  templatePatchSchema,
  templatePreviewSchema,
} from "@/lib/validations/compliance";

function serializeRoleNotice() {
  return "Not legal advice. Validate templates and rules with licensed counsel.";
}

function toTemplatePreviewContext(sampleSnapshot: Record<string, unknown>) {
  const customer = (sampleSnapshot.customer as Record<string, unknown> | undefined) ?? {};
  const vehicle = (sampleSnapshot.vehicle as Record<string, unknown> | undefined) ?? {};
  const dealer = (sampleSnapshot.dealer as Record<string, unknown> | undefined) ?? {};
  return {
    generatedAt: new Date().toISOString(),
    notLegalAdvice: serializeRoleNotice(),
    dealer: {
      name: String(dealer.name ?? "Dealer"),
      taxRate: Number(dealer.taxRate ?? 0),
      docFee: Number(dealer.docFee ?? 0),
      licenseFee: Number(dealer.licenseFee ?? 0),
    },
    deal: {
      dealNumber: String(sampleSnapshot.dealNumber ?? sampleSnapshot.dealId ?? "SAMPLE-DEAL"),
      stage: String(sampleSnapshot.stage ?? "DRAFT"),
      dealType: String(sampleSnapshot.dealType ?? "CASH"),
      jurisdiction: String(sampleSnapshot.jurisdiction ?? "TX"),
      salePrice: Number(sampleSnapshot.salePrice ?? 0).toFixed(2),
      downPayment: Number(sampleSnapshot.downPayment ?? 0).toFixed(2),
      taxes: Number(sampleSnapshot.taxes ?? 0).toFixed(2),
      fees: Number(sampleSnapshot.fees ?? 0).toFixed(2),
      financedAmount: Number(sampleSnapshot.financedAmount ?? 0).toFixed(2),
      monthlyPayment: Number(sampleSnapshot.monthlyPayment ?? 0).toFixed(2),
      apr: Number(sampleSnapshot.apr ?? 0).toFixed(3),
      termMonths: Number(sampleSnapshot.termMonths ?? 60),
    },
    customer: {
      firstName: String(customer.firstName ?? "Sample"),
      lastName: String(customer.lastName ?? "Buyer"),
      fullName: `${String(customer.firstName ?? "Sample")} ${String(customer.lastName ?? "Buyer")}`,
      email: String(customer.email ?? ""),
      phone: String(customer.phone ?? ""),
      address1: String(customer.address1 ?? ""),
      city: String(customer.city ?? ""),
      state: String(customer.state ?? ""),
      postalCode: String(customer.postalCode ?? ""),
    },
    vehicle: {
      year: Number(vehicle.year ?? 2022),
      make: String(vehicle.make ?? "Sample"),
      model: String(vehicle.model ?? "Vehicle"),
      trim: String(vehicle.trim ?? ""),
      vin: String(vehicle.vin ?? "SAMPLEVIN000000000"),
      mileage: Number(vehicle.mileage ?? 1000),
      stockNumber: String(vehicle.stockNumber ?? "SAMPLE-1"),
    },
    tradeIn: {
      hasTrade: Boolean(sampleSnapshot.hasTradeIn ?? false),
      vin: "",
      year: "",
      make: "",
      model: "",
      mileage: "",
      allowance: "0.00",
      payoff: "0.00",
    },
    SIGN_BUYER_1: '<span class="signature-anchor" data-anchor="SIGN_BUYER_1">Buyer Signature</span>',
    SIGN_CO_BUYER_1: '<span class="signature-anchor" data-anchor="SIGN_CO_BUYER_1">Co-Buyer Signature</span>',
    SIGN_DEALER_1: '<span class="signature-anchor" data-anchor="SIGN_DEALER_1">Dealer Signature</span>',
    DATE_BUYER_1: new Date().toLocaleDateString("en-US"),
    DATE_DEALER_1: new Date().toLocaleDateString("en-US"),
  };
}

export async function listComplianceTemplates(input: unknown) {
  const ctx = await requireOrgRoles([Role.ADMIN, Role.ACCOUNTING]);
  const filters = templateFiltersSchema.parse(input);
  const where = {
    deletedAt: null,
    OR: [{ orgId: ctx.orgId }, { orgId: null }],
    ...(filters.jurisdiction ? { jurisdiction: filters.jurisdiction } : {}),
    ...(filters.docType ? { docType: filters.docType } : {}),
    ...(filters.dealType ? { dealType: filters.dealType } : {}),
  };
  const templates = await prisma.documentTemplate.findMany({
    where,
    orderBy: [{ jurisdiction: "asc" }, { docType: "asc" }, { dealType: "asc" }, { version: "desc" }],
  });
  const activeOn = filters.activeOn;
  const filtered = activeOn
    ? templates.filter((template) => template.effectiveFrom <= activeOn && (!template.effectiveTo || template.effectiveTo >= activeOn))
    : templates;
  return {
    notLegalAdvice: serializeRoleNotice(),
    items: filtered,
    canonicalVariables: CANONICAL_TEMPLATE_VARIABLES,
  };
}

export async function createComplianceTemplate(input: unknown) {
  const ctx = await requireOrgRoles([Role.ADMIN, Role.ACCOUNTING]);
  const parsed = templateCreateSchema.parse(input);
  const latest = await prisma.documentTemplate.findFirst({
    where: {
      orgId: ctx.orgId,
      jurisdiction: parsed.jurisdiction,
      docType: parsed.docType,
      dealType: parsed.dealType,
    },
    orderBy: { version: "desc" },
  });
  const version = (latest?.version ?? 0) + 1;

  let sourceDocxKey: string | null = null;
  let sourceHtml: string | null = null;
  let sourceHash: string | null = null;

  if (parsed.templateEngine === DocumentTemplateEngine.DOCX && parsed.sourceDocxBase64) {
    const docxBuffer = Buffer.from(parsed.sourceDocxBase64, "base64");
    sourceHash = createHash("sha256").update(docxBuffer).digest("hex");
    const upload = await putPrivateObject({
      keyPrefix: `${ctx.orgId}/templates/${parsed.jurisdiction}/${parsed.docType}`,
      body: docxBuffer,
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      fileName: parsed.sourceDocxFileName ?? `${parsed.docType.toLowerCase()}-v${version}.docx`,
    });
    sourceDocxKey = upload.key;
  }
  if (parsed.templateEngine === DocumentTemplateEngine.HTML && parsed.sourceHtml) {
    sourceHtml = parsed.sourceHtml;
    sourceHash = createHash("sha256").update(sourceHtml).digest("hex");
  }

  const template = await prisma.$transaction(async (tx) => {
    if (parsed.defaultForOrg) {
      await tx.documentTemplate.updateMany({
        where: {
          orgId: ctx.orgId,
          jurisdiction: parsed.jurisdiction,
          docType: parsed.docType,
          dealType: parsed.dealType,
          deletedAt: null,
        },
        data: { defaultForOrg: false, isDefault: false },
      });
    }
    const created = await tx.documentTemplate.create({
      data: {
        orgId: ctx.orgId,
        name: parsed.name,
        docType: parsed.docType,
        jurisdiction: parsed.jurisdiction,
        dealType: parsed.dealType,
        version,
        effectiveFrom: parsed.effectiveFrom,
        effectiveTo: parsed.effectiveTo,
        defaultForOrg: parsed.defaultForOrg,
        isDefault: parsed.defaultForOrg,
        templateEngine: parsed.templateEngine,
        sourceHtml,
        sourceDocxKey,
        sourceHash,
        requiredFieldsJson: parsed.requiredFieldsJson,
        metadataJson: {
          importedBy: ctx.userId,
          sourceType: parsed.templateEngine === "HTML" ? "html-editor" : "docx-upload",
        },
        notLegalAdviceNotice: serializeRoleNotice(),
      },
    });
    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "DocumentTemplate",
      entityId: created.id,
      action: AuditAction.CREATE,
      after: created,
    });
    return created;
  });
  return template;
}

export async function getComplianceTemplate(templateId: string) {
  const ctx = await requireOrgRoles([Role.ADMIN, Role.ACCOUNTING]);
  const template = await prisma.documentTemplate.findFirst({
    where: {
      id: templateId,
      deletedAt: null,
      OR: [{ orgId: ctx.orgId }, { orgId: null }],
    },
  });
  if (!template) throw new AppError("Template not found.", 404);
  return {
    template,
    canonicalVariables: CANONICAL_TEMPLATE_VARIABLES,
    notLegalAdvice: serializeRoleNotice(),
  };
}

export async function patchComplianceTemplate(templateId: string, input: unknown) {
  const ctx = await requireOrgRoles([Role.ADMIN, Role.ACCOUNTING]);
  const parsed = templatePatchSchema.parse(input);
  const existing = await prisma.documentTemplate.findFirst({
    where: { id: templateId, orgId: ctx.orgId, deletedAt: null },
  });
  if (!existing) throw new AppError("Template not found for this organization.", 404);

  const updated = await prisma.$transaction(async (tx) => {
    if (parsed.defaultForOrg) {
      await tx.documentTemplate.updateMany({
        where: {
          orgId: ctx.orgId,
          jurisdiction: existing.jurisdiction,
          docType: existing.docType,
          dealType: existing.dealType,
          deletedAt: null,
        },
        data: { defaultForOrg: false, isDefault: false },
      });
    }
    const next = await tx.documentTemplate.update({
      where: { id: templateId },
      data: {
        name: parsed.name,
        effectiveFrom: parsed.effectiveFrom,
        effectiveTo: parsed.effectiveTo === null ? null : parsed.effectiveTo,
        defaultForOrg: parsed.defaultForOrg,
        isDefault: parsed.defaultForOrg,
        requiredFieldsJson: parsed.requiredFieldsJson,
      },
    });
    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "DocumentTemplate",
      entityId: existing.id,
      action: AuditAction.UPDATE,
      before: existing,
      after: next,
    });
    return next;
  });
  return updated;
}

export async function softDeleteComplianceTemplate(templateId: string) {
  const ctx = await requireOrgRoles([Role.ADMIN, Role.ACCOUNTING]);
  const existing = await prisma.documentTemplate.findFirst({
    where: { id: templateId, orgId: ctx.orgId, deletedAt: null },
  });
  if (!existing) throw new AppError("Template not found for this organization.", 404);
  const deleted = await prisma.documentTemplate.update({
    where: { id: templateId },
    data: {
      deletedAt: new Date(),
      defaultForOrg: false,
      isDefault: false,
    },
  });
  await prisma.$transaction(async (tx) => {
    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "DocumentTemplate",
      entityId: existing.id,
      action: AuditAction.DELETE,
      before: existing,
      after: deleted,
    });
  });
  return { id: templateId, deletedAt: deleted.deletedAt };
}

export async function generateTemplatePreview(templateId: string, input: unknown) {
  const ctx = await requireOrgRoles([Role.ADMIN, Role.ACCOUNTING]);
  const parsed = templatePreviewSchema.parse(input);
  const template = await prisma.documentTemplate.findFirst({
    where: {
      id: templateId,
      deletedAt: null,
      OR: [{ orgId: ctx.orgId }, { orgId: null }],
    },
  });
  if (!template) throw new AppError("Template not found.", 404);
  if (template.templateEngine !== DocumentTemplateEngine.HTML || !template.sourceHtml) {
    throw new AppError("Preview is available only for HTML templates in this MVP.", 400);
  }
  let context: Record<string, unknown>;
  if (parsed.dealId) {
    const deal = await loadDealContextBase(ctx.orgId, parsed.dealId);
    context = buildTemplateContextFromDeal(deal);
  } else {
    context = toTemplatePreviewContext(parsed.sampleSnapshot ?? {});
  }
  const renderedHtml = renderTemplateHtml(template.sourceHtml, context);
  const artifact = await renderDocumentArtifact({
    title: `${template.name}-preview`,
    htmlContent: renderedHtml,
  });
  return {
    fileName: `${template.name.replaceAll(" ", "-").toLowerCase()}-preview.${artifact.extension}`,
    contentType: artifact.contentType,
    buffer: artifact.buffer,
  };
}

export async function listComplianceRuleSets(input: unknown) {
  const ctx = await requireOrgRoles([Role.ADMIN, Role.ACCOUNTING]);
  const filters = rulesetListSchema.parse(input);
  const where = {
    OR: [{ orgId: ctx.orgId }, { orgId: null }],
    ...(filters.jurisdiction ? { jurisdiction: filters.jurisdiction } : {}),
  };
  const rulesets = await prisma.complianceRuleSet.findMany({
    where,
    orderBy: [{ jurisdiction: "asc" }, { version: "desc" }],
  });
  const activeOn = filters.activeOn;
  const filtered = activeOn
    ? rulesets.filter((item) => item.effectiveFrom <= activeOn && (!item.effectiveTo || item.effectiveTo >= activeOn))
    : rulesets;
  return {
    notLegalAdvice: serializeRoleNotice(),
    items: filtered,
  };
}

export async function createComplianceRuleSetVersion(input: unknown) {
  const ctx = await requireOrgRoles([Role.ADMIN, Role.ACCOUNTING]);
  const parsed = rulesetCreateSchema.parse(input);
  if (parsed.effectiveTo && parsed.effectiveTo < parsed.effectiveFrom) {
    throw new AppError("effectiveTo must be after effectiveFrom.", 400);
  }

  const baseFromCopyId = parsed.copyFromId
    ? await prisma.complianceRuleSet.findFirst({
        where: {
          id: parsed.copyFromId,
          OR: [{ orgId: ctx.orgId }, { orgId: null }],
        },
      })
    : null;

  const latestInScope = await prisma.complianceRuleSet.findFirst({
    where: {
      jurisdiction: parsed.jurisdiction,
      OR: [{ orgId: ctx.orgId }, { orgId: null }],
    },
    orderBy: [{ orgId: "desc" }, { version: "desc" }],
  });

  const orgLatest = await prisma.complianceRuleSet.findFirst({
    where: { orgId: ctx.orgId, jurisdiction: parsed.jurisdiction },
    orderBy: { version: "desc" },
  });
  const version = (orgLatest?.version ?? 0) + 1;
  const rulesJson = parsed.rulesJson ?? baseFromCopyId?.rulesJson ?? latestInScope?.rulesJson ?? { scenarios: [], validations: [], computedFields: {} };
  const normalizedRulesJson = complianceRulesJsonSchema.parse(rulesJson);

  const created = await prisma.complianceRuleSet.create({
    data: {
      orgId: ctx.orgId,
      jurisdiction: parsed.jurisdiction,
      version,
      effectiveFrom: parsed.effectiveFrom,
      effectiveTo: parsed.effectiveTo,
      rulesJson: normalizedRulesJson,
      metadataJson: {
        copiedFromRuleSetId: baseFromCopyId?.id ?? null,
      },
      notLegalAdviceNotice: serializeRoleNotice(),
    },
  });
  await prisma.$transaction(async (tx) => {
    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "ComplianceRuleSet",
      entityId: created.id,
      action: AuditAction.CREATE,
      after: created,
    });
  });
  return created;
}

export async function getComplianceRuleSet(ruleSetId: string) {
  const ctx = await requireOrgRoles([Role.ADMIN, Role.ACCOUNTING]);
  const ruleset = await prisma.complianceRuleSet.findFirst({
    where: {
      id: ruleSetId,
      OR: [{ orgId: ctx.orgId }, { orgId: null }],
    },
  });
  if (!ruleset) throw new AppError("Rule set not found.", 404);
  return ruleset;
}

export async function patchComplianceRuleSet(ruleSetId: string, input: unknown) {
  const ctx = await requireOrgRoles([Role.ADMIN, Role.ACCOUNTING]);
  const parsed = rulesetPatchSchema.parse(input);
  const existing = await prisma.complianceRuleSet.findFirst({
    where: { id: ruleSetId, orgId: ctx.orgId },
  });
  if (!existing) throw new AppError("Rule set not found for this organization.", 404);
  const updated = await prisma.complianceRuleSet.update({
    where: { id: ruleSetId },
    data: {
      effectiveFrom: parsed.effectiveFrom,
      effectiveTo: parsed.effectiveTo === null ? null : parsed.effectiveTo,
      rulesJson: parsed.rulesJson,
    },
  });
  await prisma.$transaction(async (tx) => {
    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "ComplianceRuleSet",
      entityId: existing.id,
      action: AuditAction.UPDATE,
      before: existing,
      after: updated,
    });
  });
  return updated;
}

export async function evaluateComplianceHarness(input: unknown) {
  const ctx = await requireOrgRoles([Role.ADMIN, Role.ACCOUNTING]);
  const parsed = rulesetEvaluateSchema.parse(input);
  const snapshot = parsed.dealSnapshot as DealSnapshot;
  const ruleSets = await resolveActiveRuleSets(ctx.orgId, parsed.jurisdiction, new Date());
  const result = evaluateCompliance(snapshot, ruleSets.map((item) => item.rulesJson));
  return {
    requiredDocs: result.requiredChecklist,
    validationErrors: result.validationErrors,
    computedFields: result.computedFields,
    notices: result.notices,
  };
}
