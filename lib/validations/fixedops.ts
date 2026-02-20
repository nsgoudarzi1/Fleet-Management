import { PartTransactionType, RepairOrderLineDecision, RepairOrderLineType, RepairOrderStatus, ServiceAppointmentStatus } from "@prisma/client";
import { z } from "zod";
import { optionalString } from "@/lib/validations/common";

export const serviceAppointmentCreateSchema = z.object({
  customerId: z.string().cuid().optional(),
  vehicleId: z.string().cuid().optional(),
  technicianId: z.string().cuid().optional(),
  title: z.string().min(3).max(160),
  concern: optionalString,
  scheduledAt: z.string().datetime(),
  status: z.nativeEnum(ServiceAppointmentStatus).optional(),
  notes: optionalString,
});

export const convertAppointmentToRoSchema = z.object({
  appointmentId: z.string().cuid(),
  advisorId: z.string().cuid().optional(),
  customerId: z.string().cuid().optional(),
  vehicleId: z.string().cuid().optional(),
  customerNotes: optionalString,
  internalNotes: optionalString,
});

export const repairOrderCreateSchema = z.object({
  customerId: z.string().cuid(),
  vehicleId: z.string().cuid(),
  advisorId: z.string().cuid().optional(),
  serviceAppointmentId: z.string().cuid().optional(),
  customerNotes: optionalString,
  internalNotes: optionalString,
});

export const repairOrderLineCreateSchema = z.object({
  type: z.nativeEnum(RepairOrderLineType),
  description: z.string().min(2).max(400),
  operationCode: optionalString,
  partId: z.string().cuid().optional(),
  technicianId: z.string().cuid().optional(),
  quantity: z.coerce.number().min(0.01).max(9999).default(1),
  flatRateHours: z.coerce.number().min(0).max(999).default(0),
  actualHours: z.coerce.number().min(0).max(999).default(0),
  unitCost: z.coerce.number().min(0).max(999999).default(0),
  unitPrice: z.coerce.number().min(0).max(999999).default(0),
  taxable: z.coerce.boolean().default(true),
  decision: z.nativeEnum(RepairOrderLineDecision).default(RepairOrderLineDecision.RECOMMENDED),
  notes: optionalString,
});

export const repairOrderLineDecisionSchema = z.object({
  lineId: z.string().cuid(),
  decision: z.nativeEnum(RepairOrderLineDecision),
});

export const repairOrderStatusTransitionSchema = z.object({
  repairOrderId: z.string().cuid(),
  status: z.nativeEnum(RepairOrderStatus),
  reason: optionalString,
  paymentMethod: z.enum(["CASH", "ACH", "CREDIT_CARD", "CHECK", "OTHER"]).optional(),
  paymentReference: optionalString,
});

export const partCreateSchema = z.object({
  vendorId: z.string().cuid().optional(),
  partNumber: z.string().min(2).max(120),
  description: z.string().min(2).max(240),
  binLocation: optionalString,
  reorderPoint: z.coerce.number().min(0).default(0),
  unitCost: z.coerce.number().min(0).default(0),
  unitPrice: z.coerce.number().min(0).default(0),
  taxable: z.coerce.boolean().default(true),
  allowNegative: z.coerce.boolean().default(false),
});

export const partReceiveSchema = z.object({
  partId: z.string().cuid(),
  quantity: z.coerce.number().positive(),
  unitCost: z.coerce.number().min(0),
  reference: optionalString,
  reason: optionalString,
  type: z.literal(PartTransactionType.RECEIVE).default(PartTransactionType.RECEIVE),
});

export const partAdjustSchema = z.object({
  partId: z.string().cuid(),
  quantityDelta: z.coerce.number(),
  reason: z.string().min(3),
  reference: optionalString,
  type: z.literal(PartTransactionType.ADJUST).default(PartTransactionType.ADJUST),
});

export const partAllocateSchema = z.object({
  partId: z.string().cuid(),
  repairOrderId: z.string().cuid(),
  lineId: z.string().cuid().optional(),
  quantity: z.coerce.number().positive(),
  reference: optionalString,
  reason: optionalString,
  allowOverride: z.coerce.boolean().default(false),
  type: z.literal(PartTransactionType.ALLOCATE).default(PartTransactionType.ALLOCATE),
});

export const receivePartsBulkSchema = z.object({
  items: z.array(partReceiveSchema).min(1).max(100),
});

export const cycleCountAdjustSchema = z.object({
  items: z.array(partAdjustSchema).min(1).max(100),
});
