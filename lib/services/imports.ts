import Papa from "papaparse";
import { AccountType, AuditAction, PermissionScope, type ImportJobStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { putPrivateObject } from "@/lib/storage/object-storage";
import { recordAudit } from "@/lib/services/audit";
import { AppError, requirePerm } from "@/lib/services/guard";
import { importJobRunSchema, importRollbackSchema } from "@/lib/validations/imports";

type ImportStats = {
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
};

function asString(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function asNumber(value: unknown, fallback = 0) {
  const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asJson(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function parseCsv(content: string) {
  const parsed = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });
  if (parsed.errors.length > 0) {
    throw new AppError(`CSV parse error: ${parsed.errors[0]?.message ?? "unknown"}`, 400);
  }
  return parsed.data;
}

function mappedValue(row: Record<string, string>, mapping: Record<string, string>, field: string) {
  const source = mapping[field];
  return source ? row[source] : undefined;
}

async function hasSeenExternalId(orgId: string, entityType: string, externalId: string) {
  const existing = await prisma.importJobRow.findFirst({
    where: {
      orgId,
      entityType,
      externalId,
      action: { in: ["CREATED", "UPDATED"] },
    },
    select: { id: true },
  });
  return !!existing;
}

export async function listImportJobs() {
  const ctx = await requirePerm(PermissionScope.IMPORT_MANAGE);
  return prisma.importJob.findMany({
    where: { orgId: ctx.orgId },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      rows: { select: { id: true }, take: 5 },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function runImportJob(input: unknown) {
  const ctx = await requirePerm(PermissionScope.IMPORT_MANAGE);
  const parsed = importJobRunSchema.parse(input);
  const rows = parseCsv(parsed.csvContent);
  if (!rows.length) throw new AppError("CSV contains no data rows.", 400);

  const stored = await putPrivateObject({
    keyPrefix: `${ctx.orgId}/imports/${parsed.entityType.toLowerCase()}`,
    body: Buffer.from(parsed.csvContent, "utf8"),
    contentType: "text/csv",
    fileName: parsed.fileName,
  });

  const job = await prisma.importJob.create({
    data: {
      orgId: ctx.orgId,
      entityType: parsed.entityType,
      status: "RUNNING",
      originalFileKey: stored.key,
      mappingJson: parsed.mapping,
      startedAt: new Date(),
      createdById: ctx.userId,
    },
  });

  const stats: ImportStats = { created: 0, updated: 0, skipped: 0, errors: [] };
  const rowRecords: Prisma.ImportJobRowCreateManyInput[] = [];

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index] ?? {};
    const rowNum = index + 2;
    const externalId = parsed.externalIdColumn ? asString(row[parsed.externalIdColumn]) || null : null;
    try {
      if (externalId && (await hasSeenExternalId(ctx.orgId, parsed.entityType, externalId))) {
        stats.skipped += 1;
        rowRecords.push({
          orgId: ctx.orgId,
          importJobId: job.id,
          entityType: parsed.entityType,
          entityId: "",
          action: "SKIPPED",
          externalId,
          snapshot: asJson({ reason: "external_id_already_imported" }),
        });
        continue;
      }

      if (parsed.entityType === "VEHICLE") {
        const stockNumber = asString(mappedValue(row, parsed.mapping, "stockNumber"));
        const vin = asString(mappedValue(row, parsed.mapping, "vin"));
        if (!stockNumber && !vin) throw new Error("stockNumber or vin is required");

        const existing = await prisma.vehicle.findFirst({
          where: {
            orgId: ctx.orgId,
            OR: [
              ...(stockNumber ? [{ stockNumber }] : []),
              ...(vin ? [{ vin }] : []),
            ],
          },
        });

        const payload = {
          vin: vin || `IMPORTVIN-${Date.now()}-${index}`,
          stockNumber: stockNumber || `IMPORT-${Date.now()}-${index}`,
          year: Math.max(1900, asNumber(mappedValue(row, parsed.mapping, "year"), new Date().getUTCFullYear())),
          make: asString(mappedValue(row, parsed.mapping, "make")) || "Unknown",
          model: asString(mappedValue(row, parsed.mapping, "model")) || "Unknown",
          trim: asString(mappedValue(row, parsed.mapping, "trim")) || null,
          mileage: asNumber(mappedValue(row, parsed.mapping, "mileage"), 0),
          listPrice: asNumber(mappedValue(row, parsed.mapping, "listPrice"), 0),
          minPrice: asNumber(mappedValue(row, parsed.mapping, "minPrice"), 0),
          location: asString(mappedValue(row, parsed.mapping, "location")) || null,
        };

        const entity = existing
          ? await prisma.vehicle.update({ where: { id: existing.id }, data: payload })
          : await prisma.vehicle.create({ data: { ...payload, orgId: ctx.orgId } });
        stats[existing ? "updated" : "created"] += 1;
        rowRecords.push({
          orgId: ctx.orgId,
          importJobId: job.id,
          entityType: parsed.entityType,
          entityId: entity.id,
          action: existing ? "UPDATED" : "CREATED",
          externalId,
          snapshot: asJson(entity),
        });
        continue;
      }

      if (parsed.entityType === "CUSTOMER") {
        const email = asString(mappedValue(row, parsed.mapping, "email")).toLowerCase();
        const phone = asString(mappedValue(row, parsed.mapping, "phone"));
        const firstName = asString(mappedValue(row, parsed.mapping, "firstName"));
        const lastName = asString(mappedValue(row, parsed.mapping, "lastName"));
        if (!firstName || !lastName) throw new Error("firstName and lastName are required");

        const existing = await prisma.customer.findFirst({
          where: {
            orgId: ctx.orgId,
            OR: [
              ...(email ? [{ email }] : []),
              ...(phone ? [{ phone }] : []),
            ],
          },
        });

        const payload = {
          firstName,
          lastName,
          email: email || null,
          phone: phone || null,
          city: asString(mappedValue(row, parsed.mapping, "city")) || null,
          state: asString(mappedValue(row, parsed.mapping, "state")) || null,
          postalCode: asString(mappedValue(row, parsed.mapping, "postalCode")) || null,
        };

        const entity = existing
          ? await prisma.customer.update({ where: { id: existing.id }, data: payload })
          : await prisma.customer.create({ data: { ...payload, orgId: ctx.orgId } });
        stats[existing ? "updated" : "created"] += 1;
        rowRecords.push({
          orgId: ctx.orgId,
          importJobId: job.id,
          entityType: parsed.entityType,
          entityId: entity.id,
          action: existing ? "UPDATED" : "CREATED",
          externalId,
          snapshot: asJson(entity),
        });
        continue;
      }

      if (parsed.entityType === "PART") {
        const partNumber = asString(mappedValue(row, parsed.mapping, "partNumber"));
        if (!partNumber) throw new Error("partNumber is required");
        const existing = await prisma.part.findFirst({
          where: { orgId: ctx.orgId, partNumber },
        });
        const payload = {
          partNumber,
          description: asString(mappedValue(row, parsed.mapping, "description")) || "Imported part",
          binLocation: asString(mappedValue(row, parsed.mapping, "binLocation")) || null,
          onHandQty: asNumber(mappedValue(row, parsed.mapping, "onHandQty"), 0),
          reorderPoint: asNumber(mappedValue(row, parsed.mapping, "reorderPoint"), 0),
          unitCost: asNumber(mappedValue(row, parsed.mapping, "unitCost"), 0),
          unitPrice: asNumber(mappedValue(row, parsed.mapping, "unitPrice"), 0),
        };
        const entity = existing
          ? await prisma.part.update({ where: { id: existing.id }, data: payload })
          : await prisma.part.create({ data: { ...payload, orgId: ctx.orgId } });
        stats[existing ? "updated" : "created"] += 1;
        rowRecords.push({
          orgId: ctx.orgId,
          importJobId: job.id,
          entityType: parsed.entityType,
          entityId: entity.id,
          action: existing ? "UPDATED" : "CREATED",
          externalId,
          snapshot: asJson(entity),
        });
        continue;
      }

      const code = asString(mappedValue(row, parsed.mapping, "code"));
      const name = asString(mappedValue(row, parsed.mapping, "name"));
      if (!code || !name) throw new Error("code and name are required");
      const existing = await prisma.chartOfAccount.findFirst({
        where: { orgId: ctx.orgId, code },
      });
      const typeRaw = asString(mappedValue(row, parsed.mapping, "type")).toUpperCase();
      const type = (Object.values(AccountType).includes(typeRaw as AccountType)
        ? typeRaw
        : parsed.defaults?.accountType ?? AccountType.EXPENSE) as AccountType;
      const entity = existing
        ? await prisma.chartOfAccount.update({ where: { id: existing.id }, data: { code, name, type } })
        : await prisma.chartOfAccount.create({ data: { orgId: ctx.orgId, code, name, type } });
      stats[existing ? "updated" : "created"] += 1;
      rowRecords.push({
        orgId: ctx.orgId,
        importJobId: job.id,
        entityType: parsed.entityType,
        entityId: entity.id,
        action: existing ? "UPDATED" : "CREATED",
        externalId,
        snapshot: asJson(entity),
      });
    } catch (error) {
      stats.errors.push({
        row: rowNum,
        message: error instanceof Error ? error.message : "Unknown import error",
      });
    }
  }

  await prisma.$transaction(async (tx) => {
    if (rowRecords.length) {
      await tx.importJobRow.createMany({ data: rowRecords });
    }
    const status: ImportJobStatus = stats.errors.length > 0 ? "FAILED" : "COMPLETED";
    await tx.importJob.update({
      where: { id: job.id },
      data: {
        status,
        completedAt: new Date(),
        statsJson: stats,
        errorJson: stats.errors.length ? stats.errors : undefined,
      },
    });
    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "ImportJob",
      entityId: job.id,
      action: AuditAction.CREATE,
      after: {
        entityType: parsed.entityType,
        status,
        stats,
      },
    });
  });

  return prisma.importJob.findUnique({
    where: { id: job.id },
    include: { rows: true },
  });
}

export async function rollbackImportJob(input: unknown) {
  const ctx = await requirePerm(PermissionScope.IMPORT_MANAGE);
  const parsed = importRollbackSchema.parse(input);

  const job = await prisma.importJob.findFirst({
    where: { id: parsed.importJobId, orgId: ctx.orgId },
  });
  if (!job) throw new AppError("Import job not found.", 404);
  if (job.status === "ROLLED_BACK") throw new AppError("Import job already rolled back.", 409);

  const createdRows = await prisma.importJobRow.findMany({
    where: { orgId: ctx.orgId, importJobId: job.id, action: "CREATED" },
    orderBy: { createdAt: "desc" },
  });

  await prisma.$transaction(async (tx) => {
    for (const row of createdRows) {
      if (row.entityType === "VEHICLE") {
        await tx.vehicle.deleteMany({ where: { id: row.entityId, orgId: ctx.orgId } });
      } else if (row.entityType === "CUSTOMER") {
        await tx.customer.deleteMany({ where: { id: row.entityId, orgId: ctx.orgId } });
      } else if (row.entityType === "PART") {
        await tx.part.deleteMany({ where: { id: row.entityId, orgId: ctx.orgId } });
      } else if (row.entityType === "CHART_OF_ACCOUNT") {
        await tx.chartOfAccount.deleteMany({ where: { id: row.entityId, orgId: ctx.orgId } });
      }
    }

    const updated = await tx.importJob.update({
      where: { id: job.id },
      data: {
        status: "ROLLED_BACK",
        rolledBackAt: new Date(),
      },
    });

    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "ImportJob",
      entityId: job.id,
      action: AuditAction.UPDATE,
      before: job,
      after: updated,
    });
  });

  return { ok: true };
}
