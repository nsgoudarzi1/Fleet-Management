import { ReconTaskStatus, VehicleStatus } from "@prisma/client";
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
