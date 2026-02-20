import { AppointmentStatus, LeadStage } from "@prisma/client";
import { z } from "zod";
import { optionalString } from "@/lib/validations/common";

export const customerCreateSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().email().optional().or(z.literal("")),
  phone: optionalString,
  householdId: optionalString,
  address1: optionalString,
  city: optionalString,
  state: optionalString,
  postalCode: optionalString,
  notes: optionalString,
});

export const customerUpdateSchema = customerCreateSchema.partial();

export const leadCreateSchema = z.object({
  customerId: z.string().cuid().optional(),
  vehicleId: z.string().cuid().optional(),
  source: z.string().trim().min(1).max(80),
  stage: z.nativeEnum(LeadStage).default(LeadStage.NEW),
  nextAction: optionalString,
  nextActionAt: z.string().datetime().optional(),
  slaDueAt: z.string().datetime().optional(),
  assignedToId: z.string().cuid().optional(),
  statusNote: optionalString,
});

export const leadUpdateSchema = leadCreateSchema.partial().extend({
  stage: z.nativeEnum(LeadStage).optional(),
});

export const appointmentCreateSchema = z.object({
  customerId: z.string().cuid().optional(),
  leadId: z.string().cuid().optional(),
  title: z.string().trim().min(2).max(120),
  scheduledAt: z.string().datetime(),
  status: z.nativeEnum(AppointmentStatus).default(AppointmentStatus.SCHEDULED),
  notes: optionalString,
});

export const leadConvertSchema = z.object({
  leadId: z.string().cuid(),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  email: z.string().email().optional().or(z.literal("")),
  phone: optionalString,
});

export const activityCreateSchema = z.object({
  entityType: z.string().trim().min(1).max(40),
  entityId: z.string().cuid(),
  customerId: z.string().cuid().optional(),
  leadId: z.string().cuid().optional(),
  dealId: z.string().cuid().optional(),
  message: z.string().trim().min(1).max(500),
  type: z.enum(["NOTE", "CALL", "TEXT", "EMAIL", "STATUS_CHANGE", "TASK"]).default("NOTE"),
});

export const crmTaskCreateSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: optionalString,
  dueAt: z.string().datetime().optional(),
  assignedToId: z.string().cuid().optional(),
  leadId: z.string().cuid().optional(),
  customerId: z.string().cuid().optional(),
});

export const crmTaskUpdateSchema = z.object({
  taskId: z.string().cuid(),
  title: z.string().trim().min(2).max(120).optional(),
  description: optionalString,
  dueAt: z.string().datetime().optional(),
  assignedToId: z.string().cuid().optional().nullable(),
  status: z.enum(["OPEN", "COMPLETED", "CANCELED"]).optional(),
});

export const messageTemplateCreateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  channel: z.enum(["email", "sms", "call-note"]),
  body: z.string().trim().min(2).max(2000),
});

export const messageTemplateUpdateSchema = messageTemplateCreateSchema.partial().extend({
  templateId: z.string().cuid(),
  isActive: z.boolean().optional(),
});
