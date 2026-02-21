import { ReconTaskStatus, SpecSource, SpecVersion, VehicleStatus } from "@prisma/client";
import { z } from "zod";
import { optionalString, positiveMoneySchema } from "@/lib/validations/common";

export const vehicleCreateSchema = z.object({
  vin: z.string().trim().min(11).max(20),
  stockNumber: z.string().trim().min(2).max(32),
  year: z.coerce.number().int().min(1980).max(2100),
  make: z.string().trim().min(1).max(64),
  model: z.string().trim().min(1).max(64),
  trim: optionalString,
  mileage: z.coerce.number().int().min(0).max(500000),
  purchaseSource: optionalString,
  listPrice: positiveMoneySchema,
  minPrice: z.coerce.number().min(0).optional(),
  floorplanSource: optionalString,
  location: optionalString,
  status: z.nativeEnum(VehicleStatus).default(VehicleStatus.ACQUIRED),
});

export const vehicleUpdateSchema = vehicleCreateSchema.partial();

export const vehicleStatusBulkSchema = z.object({
  vehicleIds: z.array(z.string().cuid()).min(1),
  status: z.nativeEnum(VehicleStatus),
});

export const reconTaskCreateSchema = z.object({
  vehicleId: z.string().cuid(),
  vendorId: z.string().cuid().optional(),
  title: z.string().trim().min(2).max(120),
  dueDate: z.string().datetime().optional(),
  notes: optionalString,
});

export const reconTaskStatusSchema = z.object({
  reconTaskId: z.string().cuid(),
  status: z.nativeEnum(ReconTaskStatus),
});

export const reconLineItemSchema = z.object({
  reconTaskId: z.string().cuid(),
  category: z.string().trim().min(1).max(50),
  description: z.string().trim().min(1).max(120),
  quantity: z.coerce.number().min(0),
  unitCost: positiveMoneySchema,
});

const optionalNumber = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value === undefined || value === null) return undefined;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return undefined;
      return Number(trimmed);
    }
    return value;
  })
  .refine((value) => value === undefined || Number.isFinite(value), "Must be a valid number.");

export const vehicleSpecUpsertSchema = z.object({
  source: z.nativeEnum(SpecSource).default(SpecSource.MANUAL),
  version: z.nativeEnum(SpecVersion).default(SpecVersion.AS_LISTED),
  gvwr: optionalNumber,
  gawrFront: optionalNumber,
  gawrRear: optionalNumber,
  axleConfig: optionalString,
  wheelbaseIn: optionalNumber,
  bodyType: optionalString,
  boxLengthIn: optionalNumber,
  cabType: optionalString,
  engine: optionalString,
  transmission: optionalString,
  fuelType: optionalString,
  ptoCapable: z.coerce.boolean().optional(),
  hitchRating: optionalString,
  notes: optionalString,
});

export const vehicleSpecSnapshotSchema = z.object({
  dealId: z.string().cuid(),
});

export const vehicleAttachmentsListSchema = z.object({
  q: z.string().trim().min(1).max(120).optional(),
  tag: z.string().trim().min(1).max(40).optional(),
});

export const vehicleAttachmentCreateSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  contentType: z.string().trim().min(1).max(120),
  size: z.coerce.number().int().min(1).max(20 * 1024 * 1024),
  dataBase64: z.string().trim().min(4),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
});

export const vehicleAttachmentDeleteSchema = z.object({
  attachmentId: z.string().cuid(),
});

export const vehicleSpecSheetQuerySchema = z.object({
  version: z.nativeEnum(SpecVersion).default(SpecVersion.AS_LISTED),
  dealId: z.string().cuid().optional(),
});
