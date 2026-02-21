import { AuditAction, Role, SpecVersion, type ReconTaskStatus, type VehicleStatus } from "@prisma/client";
import { renderDocumentArtifact } from "@/lib/documents/pdf-adapter";
import { prisma } from "@/lib/db/prisma";
import { recordAudit } from "@/lib/services/audit";
import { AppError, requireOrgContext } from "@/lib/services/guard";
import { getPrivateObjectDownloadUrl, putPrivateObject } from "@/lib/storage/object-storage";
import {
  vehicleAttachmentCreateSchema,
  vehicleAttachmentDeleteSchema,
  vehicleAttachmentsListSchema,
  reconLineItemSchema,
  reconTaskCreateSchema,
  reconTaskStatusSchema,
  vehicleCreateSchema,
  vehicleSpecSheetQuerySchema,
  vehicleSpecSnapshotSchema,
  vehicleSpecUpsertSchema,
  vehicleStatusBulkSchema,
  vehicleUpdateSchema,
} from "@/lib/validations/inventory";

type VehicleFilters = {
  query?: string;
  status?: VehicleStatus;
  page?: number;
  pageSize?: number;
};

export async function listVehicles(filters: VehicleFilters) {
  const ctx = await requireOrgContext(Role.VIEWER);
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? 25));
  const where = {
    orgId: ctx.orgId,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.query
      ? {
          OR: [
            { vin: { contains: filters.query, mode: "insensitive" as const } },
            { stockNumber: { contains: filters.query, mode: "insensitive" as const } },
            { make: { contains: filters.query, mode: "insensitive" as const } },
            { model: { contains: filters.query, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.vehicle.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        reconTasks: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    }),
    prisma.vehicle.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

export async function getVehicleDetail(vehicleId: string) {
  const ctx = await requireOrgContext(Role.VIEWER);
  const [vehicle, attachments] = await Promise.all([
    prisma.vehicle.findFirst({
      where: {
        id: vehicleId,
        orgId: ctx.orgId,
      },
      include: {
        specs: {
          orderBy: [{ createdAt: "desc" }],
          take: 10,
        },
        photos: {
          orderBy: { sortOrder: "asc" },
        },
        reconTasks: {
          include: {
            vendor: true,
            lineItems: true,
          },
          orderBy: [{ createdAt: "desc" }],
        },
        priceHistory: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        deals: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
        upfitJobs: {
          include: {
            vendor: true,
            milestones: {
              orderBy: { createdAt: "asc" },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    prisma.entityAttachment.findMany({
      where: {
        orgId: ctx.orgId,
        entityType: "VEHICLE",
        entityId: vehicleId,
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  if (!vehicle) {
    throw new AppError("Vehicle not found.", 404);
  }

  return {
    ...vehicle,
    attachments,
  };
}

function normalizeAttachmentBytes(dataBase64: string) {
  const payload = dataBase64.includes(",") ? dataBase64.split(",")[1] : dataBase64;
  if (!payload) throw new AppError("Attachment payload is empty.", 400);
  return Buffer.from(payload, "base64");
}

export async function getVehicleSpec(
  vehicleId: string,
  rawInput: { version?: SpecVersion; dealId?: string } = {},
) {
  const ctx = await requireOrgContext(Role.VIEWER);
  const input = vehicleSpecSheetQuerySchema.parse(rawInput);

  const vehicle = await prisma.vehicle.findFirst({
    where: {
      id: vehicleId,
      orgId: ctx.orgId,
    },
  });
  if (!vehicle) throw new AppError("Vehicle not found.", 404);

  const where = {
    orgId: ctx.orgId,
    vehicleId,
    version: input.version,
    ...(input.dealId ? { dealId: input.dealId } : {}),
  };
  const spec = await prisma.vehicleSpec.findFirst({
    where,
    orderBy: { createdAt: "desc" },
  });

  return {
    vehicle,
    spec,
  };
}

export async function updateVehicleSpec(vehicleId: string, input: unknown) {
  const ctx = await requireOrgContext(Role.MANAGER);
  const parsed = vehicleSpecUpsertSchema.parse(input);
  if (parsed.version !== SpecVersion.AS_LISTED) {
    throw new AppError("Only AS_LISTED specs can be edited directly.", 400);
  }

  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, orgId: ctx.orgId },
  });
  if (!vehicle) throw new AppError("Vehicle not found.", 404);

  const existing = await prisma.vehicleSpec.findFirst({
    where: {
      orgId: ctx.orgId,
      vehicleId,
      version: SpecVersion.AS_LISTED,
      dealId: null,
    },
    orderBy: { createdAt: "desc" },
  });

  return prisma.$transaction(async (tx) => {
    const payload = {
      source: parsed.source,
      version: SpecVersion.AS_LISTED,
      gvwr: parsed.gvwr ? Math.round(parsed.gvwr) : null,
      gawrFront: parsed.gawrFront ? Math.round(parsed.gawrFront) : null,
      gawrRear: parsed.gawrRear ? Math.round(parsed.gawrRear) : null,
      axleConfig: parsed.axleConfig,
      wheelbaseIn: parsed.wheelbaseIn,
      bodyType: parsed.bodyType,
      boxLengthIn: parsed.boxLengthIn,
      cabType: parsed.cabType,
      engine: parsed.engine,
      transmission: parsed.transmission,
      fuelType: parsed.fuelType,
      ptoCapable: parsed.ptoCapable ?? false,
      hitchRating: parsed.hitchRating,
      notes: parsed.notes,
      createdById: ctx.userId,
    };

    const spec = existing
      ? await tx.vehicleSpec.update({
          where: { id: existing.id },
          data: payload,
        })
      : await tx.vehicleSpec.create({
          data: {
            orgId: ctx.orgId,
            vehicleId,
            ...payload,
          },
        });

    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "VehicleSpec",
      entityId: spec.id,
      action: existing ? AuditAction.UPDATE : AuditAction.CREATE,
      before: existing ?? undefined,
      after: spec,
    });

    return spec;
  });
}

export async function snapshotAsSoldSpec(rawInput: unknown) {
  const ctx = await requireOrgContext(Role.MANAGER);
  const parsed = vehicleSpecSnapshotSchema.parse(rawInput);

  const deal = await prisma.deal.findFirst({
    where: { id: parsed.dealId, orgId: ctx.orgId },
    include: {
      vehicle: {
        include: {
          specs: {
            where: { version: SpecVersion.AS_LISTED, dealId: null },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
    },
  });
  if (!deal) throw new AppError("Deal not found.", 404);

  const existing = await prisma.vehicleSpec.findFirst({
    where: {
      orgId: ctx.orgId,
      dealId: deal.id,
      vehicleId: deal.vehicleId,
      version: SpecVersion.AS_SOLD,
    },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return existing;

  const source = deal.vehicle.specs[0];
  return prisma.$transaction(async (tx) => {
    const snapshot = await tx.vehicleSpec.create({
      data: {
        orgId: ctx.orgId,
        vehicleId: deal.vehicleId,
        dealId: deal.id,
        version: SpecVersion.AS_SOLD,
        source: source?.source ?? "MANUAL",
        gvwr: source?.gvwr ?? null,
        gawrFront: source?.gawrFront ?? null,
        gawrRear: source?.gawrRear ?? null,
        axleConfig: source?.axleConfig ?? null,
        wheelbaseIn: source?.wheelbaseIn ?? null,
        bodyType: source?.bodyType ?? null,
        boxLengthIn: source?.boxLengthIn ?? null,
        cabType: source?.cabType ?? null,
        engine: source?.engine ?? null,
        transmission: source?.transmission ?? null,
        fuelType: source?.fuelType ?? null,
        ptoCapable: source?.ptoCapable ?? false,
        hitchRating: source?.hitchRating ?? null,
        notes: source?.notes ?? `Snapshot captured from inventory for deal ${deal.dealNumber}.`,
        createdById: ctx.userId,
      },
    });

    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "VehicleSpec",
      entityId: snapshot.id,
      action: AuditAction.CREATE,
      after: snapshot,
    });
    return snapshot;
  });
}

export async function listAttachments(vehicleId: string, rawInput: unknown) {
  const ctx = await requireOrgContext(Role.VIEWER);
  const parsed = vehicleAttachmentsListSchema.parse(rawInput);
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, orgId: ctx.orgId },
    select: { id: true },
  });
  if (!vehicle) throw new AppError("Vehicle not found.", 404);

  return prisma.entityAttachment.findMany({
    where: {
      orgId: ctx.orgId,
      entityType: "VEHICLE",
      entityId: vehicleId,
      ...(parsed.q
        ? {
            OR: [
              { filename: { contains: parsed.q, mode: "insensitive" as const } },
              { tags: { has: parsed.q } },
            ],
          }
        : {}),
      ...(parsed.tag ? { tags: { has: parsed.tag } } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function addAttachment(vehicleId: string, input: unknown) {
  const ctx = await requireOrgContext(Role.MANAGER);
  const parsed = vehicleAttachmentCreateSchema.parse(input);
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, orgId: ctx.orgId },
    select: { id: true, stockNumber: true },
  });
  if (!vehicle) throw new AppError("Vehicle not found.", 404);

  const bytes = normalizeAttachmentBytes(parsed.dataBase64);
  if (!bytes.length) throw new AppError("Attachment payload is empty.", 400);
  if (bytes.length > 20 * 1024 * 1024) throw new AppError("Attachment exceeds 20MB.", 413);

  const upload = await putPrivateObject({
    keyPrefix: `${ctx.orgId}/vehicles/${vehicleId}/attachments`,
    body: bytes,
    contentType: parsed.contentType,
    fileName: parsed.filename,
  });
  const signedUrl = await getPrivateObjectDownloadUrl(upload.key, 60 * 60 * 24 * 7);

  return prisma.$transaction(async (tx) => {
    const attachment = await tx.entityAttachment.create({
      data: {
        orgId: ctx.orgId,
        entityType: "VEHICLE",
        entityId: vehicleId,
        filename: parsed.filename,
        contentType: parsed.contentType,
        size: parsed.size || bytes.length,
        storageKey: upload.key,
        url: signedUrl,
        tags: parsed.tags,
        uploadedById: ctx.userId,
      },
    });

    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "Attachment",
      entityId: attachment.id,
      action: AuditAction.CREATE,
      after: {
        ...attachment,
        stockNumber: vehicle.stockNumber,
      },
    });
    return attachment;
  });
}

export async function deleteAttachment(vehicleId: string, rawInput: unknown) {
  const ctx = await requireOrgContext(Role.MANAGER);
  const parsed = vehicleAttachmentDeleteSchema.parse(rawInput);
  const existing = await prisma.entityAttachment.findFirst({
    where: {
      id: parsed.attachmentId,
      orgId: ctx.orgId,
      entityType: "VEHICLE",
      entityId: vehicleId,
    },
  });
  if (!existing) throw new AppError("Attachment not found.", 404);

  await prisma.$transaction(async (tx) => {
    await tx.entityAttachment.delete({
      where: { id: parsed.attachmentId },
    });
    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "Attachment",
      entityId: parsed.attachmentId,
      action: AuditAction.DELETE,
      before: existing,
    });
  });
}

function valueOrDash(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function buildSpecSheetHtml(input: {
  version: SpecVersion;
  vehicle: {
    stockNumber: string;
    vin: string;
    year: number;
    make: string;
    model: string;
    trim: string | null;
    mileage: number;
  };
  spec: {
    gvwr: number | null;
    gawrFront: number | null;
    gawrRear: number | null;
    axleConfig: string | null;
    wheelbaseIn: unknown;
    bodyType: string | null;
    boxLengthIn: unknown;
    cabType: string | null;
    engine: string | null;
    transmission: string | null;
    fuelType: string | null;
    ptoCapable: boolean;
    hitchRating: string | null;
    notes: string | null;
    source: string;
    createdAt: Date;
  } | null;
}) {
  const versionLabel = input.version === SpecVersion.AS_SOLD ? "As Sold" : "As Listed";
  return `
<h1>Unit Spec Sheet (${versionLabel})</h1>
<div class="section">
  <div class="field-row"><span class="field-label">Stock #</span><span class="field-value">${input.vehicle.stockNumber}</span></div>
  <div class="field-row"><span class="field-label">VIN</span><span class="field-value">${input.vehicle.vin}</span></div>
  <div class="field-row"><span class="field-label">Unit</span><span class="field-value">${input.vehicle.year} ${input.vehicle.make} ${input.vehicle.model} ${input.vehicle.trim ?? ""}</span></div>
  <div class="field-row"><span class="field-label">Mileage</span><span class="field-value">${input.vehicle.mileage}</span></div>
</div>
<div class="section">
  <h3>Weight & Body</h3>
  <div class="field-row"><span class="field-label">GVWR</span><span class="field-value">${valueOrDash(input.spec?.gvwr)}</span></div>
  <div class="field-row"><span class="field-label">GAWR Front</span><span class="field-value">${valueOrDash(input.spec?.gawrFront)}</span></div>
  <div class="field-row"><span class="field-label">GAWR Rear</span><span class="field-value">${valueOrDash(input.spec?.gawrRear)}</span></div>
  <div class="field-row"><span class="field-label">Axle Config</span><span class="field-value">${valueOrDash(input.spec?.axleConfig)}</span></div>
  <div class="field-row"><span class="field-label">Wheelbase (in)</span><span class="field-value">${valueOrDash(input.spec?.wheelbaseIn as string | number | null | undefined)}</span></div>
  <div class="field-row"><span class="field-label">Body Type</span><span class="field-value">${valueOrDash(input.spec?.bodyType)}</span></div>
  <div class="field-row"><span class="field-label">Box Length (in)</span><span class="field-value">${valueOrDash(input.spec?.boxLengthIn as string | number | null | undefined)}</span></div>
  <div class="field-row"><span class="field-label">Cab Type</span><span class="field-value">${valueOrDash(input.spec?.cabType)}</span></div>
</div>
<div class="section">
  <h3>Powertrain & Capability</h3>
  <div class="field-row"><span class="field-label">Engine</span><span class="field-value">${valueOrDash(input.spec?.engine)}</span></div>
  <div class="field-row"><span class="field-label">Transmission</span><span class="field-value">${valueOrDash(input.spec?.transmission)}</span></div>
  <div class="field-row"><span class="field-label">Fuel Type</span><span class="field-value">${valueOrDash(input.spec?.fuelType)}</span></div>
  <div class="field-row"><span class="field-label">PTO Capable</span><span class="field-value">${input.spec?.ptoCapable ? "Yes" : "No"}</span></div>
  <div class="field-row"><span class="field-label">Hitch Rating</span><span class="field-value">${valueOrDash(input.spec?.hitchRating)}</span></div>
</div>
<div class="section">
  <h3>Notes</h3>
  <p>${valueOrDash(input.spec?.notes)}</p>
  <div class="field-row"><span class="field-label">Source</span><span class="field-value">${valueOrDash(input.spec?.source)}</span></div>
  <div class="field-row"><span class="field-label">Updated</span><span class="field-value">${input.spec?.createdAt.toISOString() ?? "-"}</span></div>
</div>
<div class="notice">Not legal advice. Verify published specifications against OEM and final sale documents.</div>
`.trim();
}

export async function generateVehicleSpecSheet(
  vehicleId: string,
  rawInput: { version?: SpecVersion; dealId?: string } = {},
) {
  const ctx = await requireOrgContext(Role.VIEWER);
  const input = vehicleSpecSheetQuerySchema.parse(rawInput);

  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, orgId: ctx.orgId },
    select: {
      id: true,
      stockNumber: true,
      vin: true,
      year: true,
      make: true,
      model: true,
      trim: true,
      mileage: true,
    },
  });
  if (!vehicle) throw new AppError("Vehicle not found.", 404);

  const spec = await prisma.vehicleSpec.findFirst({
    where: {
      orgId: ctx.orgId,
      vehicleId,
      version: input.version,
      ...(input.version === SpecVersion.AS_SOLD
        ? input.dealId
          ? { dealId: input.dealId }
          : {}
        : { dealId: null }),
    },
    orderBy: { createdAt: "desc" },
  });

  const html = buildSpecSheetHtml({
    version: input.version,
    vehicle,
    spec,
  });
  const artifact = await renderDocumentArtifact({
    title: `${vehicle.stockNumber}-${input.version}-spec-sheet`,
    htmlContent: html,
  });

  return {
    buffer: artifact.buffer,
    contentType: artifact.contentType,
    fileName: `${vehicle.stockNumber}-${input.version}-spec-sheet.${artifact.extension}`,
    mode: artifact.mode,
  };
}

export async function createVehicle(input: unknown) {
  const ctx = await requireOrgContext(Role.MANAGER);
  const parsed = vehicleCreateSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    const vehicle = await tx.vehicle.create({
      data: {
        orgId: ctx.orgId,
        vin: parsed.vin.toUpperCase(),
        stockNumber: parsed.stockNumber.toUpperCase(),
        year: parsed.year,
        make: parsed.make,
        model: parsed.model,
        trim: parsed.trim,
        mileage: parsed.mileage,
        purchaseSource: parsed.purchaseSource,
        listPrice: parsed.listPrice,
        minPrice: parsed.minPrice,
        floorplanSource: parsed.floorplanSource,
        location: parsed.location,
        status: parsed.status,
      },
    });
    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "Vehicle",
      entityId: vehicle.id,
      action: AuditAction.CREATE,
      after: vehicle,
    });
    return vehicle;
  });
}

export async function updateVehicle(vehicleId: string, input: unknown) {
  const ctx = await requireOrgContext(Role.MANAGER);
  const parsed = vehicleUpdateSchema.parse(input);
  const existing = await prisma.vehicle.findFirst({
    where: { id: vehicleId, orgId: ctx.orgId },
  });
  if (!existing) throw new AppError("Vehicle not found.", 404);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.vehicle.update({
      where: { id: vehicleId },
      data: {
        ...parsed,
        vin: parsed.vin?.toUpperCase(),
        stockNumber: parsed.stockNumber?.toUpperCase(),
      },
    });

    if (typeof parsed.listPrice === "number" && Number(existing.listPrice) !== parsed.listPrice) {
      await tx.vehiclePriceHistory.create({
        data: {
          orgId: ctx.orgId,
          vehicleId,
          previous: existing.listPrice,
          next: parsed.listPrice,
          createdById: ctx.userId,
          note: "Inline update",
        },
      });
    }

    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "Vehicle",
      entityId: vehicleId,
      action: AuditAction.UPDATE,
      before: existing,
      after: updated,
    });

    return updated;
  });
}

export async function bulkUpdateVehicleStatus(input: unknown) {
  const ctx = await requireOrgContext(Role.MANAGER);
  const parsed = vehicleStatusBulkSchema.parse(input);

  const vehicles = await prisma.vehicle.findMany({
    where: {
      orgId: ctx.orgId,
      id: { in: parsed.vehicleIds },
    },
  });

  return prisma.$transaction(async (tx) => {
    const results = await Promise.all(
      vehicles.map(async (vehicle) => {
        const updated = await tx.vehicle.update({
          where: { id: vehicle.id },
          data: { status: parsed.status },
        });
        await recordAudit(tx, {
          orgId: ctx.orgId,
          actorId: ctx.userId,
          entityType: "Vehicle",
          entityId: vehicle.id,
          action: AuditAction.UPDATE,
          before: vehicle,
          after: updated,
        });
        return updated;
      }),
    );
    return results.length;
  });
}

export async function createReconTask(input: unknown) {
  const ctx = await requireOrgContext(Role.SERVICE);
  const parsed = reconTaskCreateSchema.parse(input);
  const vehicle = await prisma.vehicle.findFirst({
    where: {
      id: parsed.vehicleId,
      orgId: ctx.orgId,
    },
  });
  if (!vehicle) throw new AppError("Vehicle not found.", 404);

  return prisma.reconTask.create({
    data: {
      orgId: ctx.orgId,
      vehicleId: parsed.vehicleId,
      vendorId: parsed.vendorId,
      title: parsed.title,
      notes: parsed.notes,
      dueDate: parsed.dueDate ? new Date(parsed.dueDate) : undefined,
    },
  });
}

export async function setReconTaskStatus(input: unknown) {
  const ctx = await requireOrgContext(Role.SERVICE);
  const parsed = reconTaskStatusSchema.parse(input);

  const task = await prisma.reconTask.findFirst({
    where: {
      id: parsed.reconTaskId,
      orgId: ctx.orgId,
    },
  });
  if (!task) throw new AppError("Recon task not found.", 404);

  return prisma.reconTask.update({
    where: { id: parsed.reconTaskId },
    data: {
      status: parsed.status as ReconTaskStatus,
      completedAt: parsed.status === "DONE" ? new Date() : null,
    },
  });
}

export async function addReconLineItem(input: unknown) {
  const ctx = await requireOrgContext(Role.SERVICE);
  const parsed = reconLineItemSchema.parse(input);
  const task = await prisma.reconTask.findFirst({
    where: { id: parsed.reconTaskId, orgId: ctx.orgId },
  });
  if (!task) throw new AppError("Recon task not found.", 404);

  const totalCost = parsed.quantity * parsed.unitCost;
  return prisma.$transaction(async (tx) => {
    const item = await tx.reconLineItem.create({
      data: {
        orgId: ctx.orgId,
        reconTaskId: parsed.reconTaskId,
        category: parsed.category,
        description: parsed.description,
        quantity: parsed.quantity,
        unitCost: parsed.unitCost,
        totalCost,
      },
    });

    const allItems = await tx.reconLineItem.findMany({
      where: { reconTaskId: parsed.reconTaskId, orgId: ctx.orgId },
    });
    const reconSpend = allItems.reduce((sum, lineItem) => sum + Number(lineItem.totalCost), 0);
    await tx.vehicle.update({
      where: { id: task.vehicleId },
      data: {
        costParts: reconSpend,
      },
    });
    return item;
  });
}

export async function deleteVehicle(vehicleId: string) {
  const ctx = await requireOrgContext(Role.ADMIN);
  const existing = await prisma.vehicle.findFirst({
    where: { id: vehicleId, orgId: ctx.orgId },
  });
  if (!existing) throw new AppError("Vehicle not found.", 404);

  await prisma.$transaction(async (tx) => {
    await tx.vehicle.delete({
      where: { id: vehicleId },
    });
    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "Vehicle",
      entityId: vehicleId,
      action: AuditAction.DELETE,
      before: existing,
    });
  });
}
