import { ActivityType, AuditAction, PermissionScope, LeadStage, Role } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { recordAudit } from "@/lib/services/audit";
import { AppError, requireOrgContext, requirePerm } from "@/lib/services/guard";
import {
  activityCreateSchema,
  appointmentCreateSchema,
  crmTaskCreateSchema,
  crmTaskUpdateSchema,
  customerCreateSchema,
  customerUpdateSchema,
  leadConvertSchema,
  leadCreateSchema,
  leadUpdateSchema,
  messageTemplateCreateSchema,
  messageTemplateUpdateSchema,
} from "@/lib/validations/crm";

type CustomerFilters = {
  query?: string;
  page?: number;
  pageSize?: number;
};

type LeadFilters = {
  stage?: LeadStage;
  query?: string;
  page?: number;
  pageSize?: number;
};

export async function listCustomers(filters: CustomerFilters) {
  const ctx = await requireOrgContext(Role.VIEWER);
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? 25));

  const where = {
    orgId: ctx.orgId,
    ...(filters.query
      ? {
          OR: [
            { firstName: { contains: filters.query, mode: "insensitive" as const } },
            { lastName: { contains: filters.query, mode: "insensitive" as const } },
            { email: { contains: filters.query, mode: "insensitive" as const } },
            { phone: { contains: filters.query, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.customer.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: {
        leads: {
          select: { id: true, stage: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 3,
        },
        deals: {
          select: { id: true, stage: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 3,
        },
      },
    }),
    prisma.customer.count({ where }),
  ]);

  return { items, total, page, pageSize };
}

export async function getCustomerDetail(customerId: string) {
  const ctx = await requireOrgContext(Role.VIEWER);
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, orgId: ctx.orgId },
    include: {
      leads: {
        orderBy: { createdAt: "desc" },
      },
      deals: {
        orderBy: { createdAt: "desc" },
      },
      appointments: {
        orderBy: { scheduledAt: "desc" },
      },
      activities: {
        orderBy: { createdAt: "desc" },
        include: { user: true },
      },
      payments: {
        orderBy: { postedAt: "desc" },
        take: 10,
      },
    },
  });
  if (!customer) throw new AppError("Customer not found.", 404);
  return customer;
}

export async function createCustomer(input: unknown) {
  const ctx = await requireOrgContext(Role.SALES);
  const parsed = customerCreateSchema.parse(input);
  const normalizedEmail = parsed.email?.trim() ? parsed.email.trim().toLowerCase() : undefined;

  return prisma.$transaction(async (tx) => {
    const customer = await tx.customer.create({
      data: {
        orgId: ctx.orgId,
        firstName: parsed.firstName,
        lastName: parsed.lastName,
        email: normalizedEmail,
        phone: parsed.phone,
        householdId: parsed.householdId,
        address1: parsed.address1,
        city: parsed.city,
        state: parsed.state,
        postalCode: parsed.postalCode,
        notes: parsed.notes,
      },
    });

    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "Customer",
      entityId: customer.id,
      action: AuditAction.CREATE,
      after: customer,
    });

    return customer;
  });
}

export async function updateCustomer(customerId: string, input: unknown) {
  const ctx = await requireOrgContext(Role.SALES);
  const parsed = customerUpdateSchema.parse(input);
  const existing = await prisma.customer.findFirst({
    where: { id: customerId, orgId: ctx.orgId },
  });
  if (!existing) throw new AppError("Customer not found.", 404);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.customer.update({
      where: { id: customerId },
      data: {
        ...parsed,
        email: parsed.email?.trim() ? parsed.email.trim().toLowerCase() : undefined,
      },
    });
    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "Customer",
      entityId: customerId,
      action: AuditAction.UPDATE,
      before: existing,
      after: updated,
    });
    return updated;
  });
}

export async function deleteCustomer(customerId: string) {
  const ctx = await requireOrgContext(Role.ADMIN);
  const existing = await prisma.customer.findFirst({
    where: { id: customerId, orgId: ctx.orgId },
  });
  if (!existing) throw new AppError("Customer not found.", 404);

  await prisma.$transaction(async (tx) => {
    await tx.customer.delete({
      where: { id: customerId },
    });
    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "Customer",
      entityId: customerId,
      action: AuditAction.DELETE,
      before: existing,
    });
  });
}

export async function listLeads(filters: LeadFilters) {
  const ctx = await requireOrgContext(Role.VIEWER);
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? 25));
  const where = {
    orgId: ctx.orgId,
    ...(filters.stage ? { stage: filters.stage } : {}),
    ...(filters.query
      ? {
          OR: [
            { source: { contains: filters.query, mode: "insensitive" as const } },
            { statusNote: { contains: filters.query, mode: "insensitive" as const } },
            {
              customer: {
                OR: [
                  { firstName: { contains: filters.query, mode: "insensitive" as const } },
                  { lastName: { contains: filters.query, mode: "insensitive" as const } },
                ],
              },
            },
          ],
        }
      : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.lead.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: [{ createdAt: "desc" }],
      include: {
        customer: true,
        vehicle: true,
        assignedTo: true,
      },
    }),
    prisma.lead.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

export async function getLeadDetail(leadId: string) {
  const ctx = await requireOrgContext(Role.VIEWER);
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, orgId: ctx.orgId },
    include: {
      customer: true,
      vehicle: true,
      assignedTo: true,
      appointments: {
        orderBy: { scheduledAt: "desc" },
      },
      crmTasks: {
        orderBy: [{ status: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
      },
      activities: {
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!lead) throw new AppError("Lead not found.", 404);
  return lead;
}

export async function createLead(input: unknown) {
  const ctx = await requireOrgContext(Role.SALES);
  const parsed = leadCreateSchema.parse(input);
  const org = await prisma.organization.findUnique({
    where: { id: ctx.orgId },
    select: { leadSlaMinutes: true },
  });
  const slaDueAt =
    parsed.slaDueAt
      ? new Date(parsed.slaDueAt)
      : new Date(Date.now() + (org?.leadSlaMinutes ?? 15) * 60 * 1000);

  return prisma.lead.create({
    data: {
      orgId: ctx.orgId,
      customerId: parsed.customerId,
      vehicleId: parsed.vehicleId,
      source: parsed.source,
      stage: parsed.stage,
      nextAction: parsed.nextAction,
      nextActionAt: parsed.nextActionAt ? new Date(parsed.nextActionAt) : undefined,
      slaDueAt,
      assignedToId: parsed.assignedToId,
      statusNote: parsed.statusNote,
    },
    include: {
      customer: true,
      vehicle: true,
      assignedTo: true,
    },
  });
}

export async function updateLead(leadId: string, input: unknown) {
  const ctx = await requireOrgContext(Role.SALES);
  const parsed = leadUpdateSchema.parse(input);
  const existing = await prisma.lead.findFirst({
    where: { id: leadId, orgId: ctx.orgId },
  });
  if (!existing) throw new AppError("Lead not found.", 404);

  return prisma.lead.update({
    where: { id: leadId },
    data: {
      ...parsed,
      nextActionAt: parsed.nextActionAt ? new Date(parsed.nextActionAt) : undefined,
      slaDueAt: parsed.slaDueAt ? new Date(parsed.slaDueAt) : undefined,
      ...(parsed.stage === LeadStage.WON
        ? {
            convertedAt: existing.convertedAt ?? new Date(),
            convertedById: existing.convertedById ?? ctx.userId,
          }
        : {}),
    },
  });
}

export async function convertLeadToCustomer(input: unknown) {
  const ctx = await requireOrgContext(Role.SALES);
  const parsed = leadConvertSchema.parse(input);
  const lead = await prisma.lead.findFirst({
    where: {
      id: parsed.leadId,
      orgId: ctx.orgId,
    },
  });
  if (!lead) throw new AppError("Lead not found.", 404);

  return prisma.$transaction(async (tx) => {
    const existingCustomer = lead.customerId
      ? await tx.customer.findUnique({
          where: { id: lead.customerId },
        })
      : null;

    const customer = existingCustomer
      ? await tx.customer.update({
          where: { id: lead.customerId! },
          data: {
            firstName: parsed.firstName,
            lastName: parsed.lastName,
            email: parsed.email?.trim() ? parsed.email.trim().toLowerCase() : undefined,
            phone: parsed.phone,
          },
        })
      : await tx.customer.create({
          data: {
            orgId: ctx.orgId,
            firstName: parsed.firstName,
            lastName: parsed.lastName,
            email: parsed.email?.trim() ? parsed.email.trim().toLowerCase() : undefined,
            phone: parsed.phone,
          },
        });

    const updatedLead = await tx.lead.update({
      where: { id: parsed.leadId },
      data: {
        customerId: customer.id,
        stage: LeadStage.WON,
        convertedAt: new Date(),
        convertedById: ctx.userId,
      },
    });

    await tx.activityLog.create({
      data: {
        orgId: ctx.orgId,
        userId: ctx.userId,
        customerId: customer.id,
        leadId: updatedLead.id,
        entityType: "Lead",
        entityId: updatedLead.id,
        type: ActivityType.STATUS_CHANGE,
        message: "Lead converted to customer",
      },
    });

    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "Customer",
      entityId: customer.id,
      action: existingCustomer ? AuditAction.UPDATE : AuditAction.CREATE,
      before: existingCustomer,
      after: customer,
    });

    return { customer, lead: updatedLead };
  });
}

export async function createAppointment(input: unknown) {
  const ctx = await requireOrgContext(Role.SALES);
  const parsed = appointmentCreateSchema.parse(input);
  return prisma.appointment.create({
    data: {
      orgId: ctx.orgId,
      customerId: parsed.customerId,
      leadId: parsed.leadId,
      title: parsed.title,
      scheduledAt: new Date(parsed.scheduledAt),
      status: parsed.status,
      notes: parsed.notes,
      createdById: ctx.userId,
    },
  });
}

export async function createActivity(input: unknown) {
  const ctx = await requirePerm(PermissionScope.CRM_WRITE);
  const parsed = activityCreateSchema.parse(input);
  const created = await prisma.$transaction(async (tx) => {
    const activity = await tx.activityLog.create({
      data: {
        orgId: ctx.orgId,
        userId: ctx.userId,
        customerId: parsed.customerId,
        leadId: parsed.leadId,
        dealId: parsed.dealId,
        entityType: parsed.entityType,
        entityId: parsed.entityId,
        type: parsed.type as ActivityType,
        message: parsed.message,
      },
    });

    if (parsed.leadId && ["CALL", "TEXT", "EMAIL"].includes(parsed.type)) {
      await tx.lead.updateMany({
        where: {
          id: parsed.leadId,
          orgId: ctx.orgId,
          firstResponseAt: null,
        },
        data: {
          firstResponseAt: new Date(),
        },
      });
    }

    if (["CALL", "TEXT", "EMAIL"].includes(parsed.type)) {
      await tx.communicationAttempt.create({
        data: {
          orgId: ctx.orgId,
          activityId: activity.id,
          leadId: parsed.leadId,
          customerId: parsed.customerId,
          provider: "stub",
          channel: parsed.type.toLowerCase(),
          status: "logged",
          recipient: parsed.customerId ? "linked-customer" : undefined,
          createdById: ctx.userId,
          payloadJson: { message: parsed.message },
          responseJson: { accepted: true },
        },
      });
    }

    return activity;
  });

  return created;
}

export async function listCrmTasks() {
  const ctx = await requirePerm(PermissionScope.CRM_READ);
  const org = await prisma.organization.findUnique({
    where: { id: ctx.orgId },
    select: { taskOverdueGraceMinutes: true },
  });
  const overdueCutoff = new Date(Date.now() - (org?.taskOverdueGraceMinutes ?? 0) * 60 * 1000);
  return prisma.crmTask.findMany({
    where: { orgId: ctx.orgId },
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
      lead: { select: { id: true, source: true, stage: true } },
      customer: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: [
      { status: "asc" },
      { dueAt: "asc" },
      { createdAt: "desc" },
    ],
    take: 200,
  }).then((items) =>
    items.map((item) => ({
      ...item,
      isOverdue: item.status === "OPEN" && !!item.dueAt && item.dueAt <= overdueCutoff,
    })),
  );
}

export async function createCrmTask(input: unknown) {
  const ctx = await requirePerm(PermissionScope.CRM_WRITE);
  const parsed = crmTaskCreateSchema.parse(input);
  const created = await prisma.crmTask.create({
    data: {
      orgId: ctx.orgId,
      title: parsed.title,
      description: parsed.description,
      dueAt: parsed.dueAt ? new Date(parsed.dueAt) : undefined,
      assignedToId: parsed.assignedToId,
      leadId: parsed.leadId,
      customerId: parsed.customerId,
      createdById: ctx.userId,
    },
  });

  await prisma.$transaction(async (tx) => {
    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "CrmTask",
      entityId: created.id,
      action: AuditAction.CREATE,
      after: created,
    });
  });

  return created;
}

export async function updateCrmTask(input: unknown) {
  const ctx = await requirePerm(PermissionScope.CRM_WRITE);
  const parsed = crmTaskUpdateSchema.parse(input);
  const existing = await prisma.crmTask.findFirst({
    where: { id: parsed.taskId, orgId: ctx.orgId },
  });
  if (!existing) throw new AppError("Task not found.", 404);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.crmTask.update({
      where: { id: parsed.taskId },
      data: {
        title: parsed.title,
        description: parsed.description,
        dueAt: parsed.dueAt ? new Date(parsed.dueAt) : undefined,
        assignedToId: parsed.assignedToId === undefined ? undefined : parsed.assignedToId,
        status: parsed.status,
        completedAt: parsed.status === "COMPLETED" ? new Date() : parsed.status ? null : undefined,
      },
    });
    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "CrmTask",
      entityId: updated.id,
      action: AuditAction.UPDATE,
      before: existing,
      after: updated,
    });
    return updated;
  });
}

export async function listMessageTemplates() {
  const ctx = await requirePerm(PermissionScope.CRM_READ);
  return prisma.messageTemplate.findMany({
    where: { orgId: ctx.orgId },
    orderBy: { createdAt: "desc" },
  });
}

export async function createMessageTemplate(input: unknown) {
  const ctx = await requirePerm(PermissionScope.CRM_WRITE);
  const parsed = messageTemplateCreateSchema.parse(input);
  const template = await prisma.messageTemplate.create({
    data: {
      orgId: ctx.orgId,
      name: parsed.name,
      channel: parsed.channel,
      body: parsed.body,
      createdById: ctx.userId,
    },
  });
  await prisma.$transaction(async (tx) => {
    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "MessageTemplate",
      entityId: template.id,
      action: AuditAction.CREATE,
      after: template,
    });
  });
  return template;
}

export async function updateMessageTemplate(input: unknown) {
  const ctx = await requirePerm(PermissionScope.CRM_WRITE);
  const parsed = messageTemplateUpdateSchema.parse(input);
  const existing = await prisma.messageTemplate.findFirst({
    where: { id: parsed.templateId, orgId: ctx.orgId },
  });
  if (!existing) throw new AppError("Template not found.", 404);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.messageTemplate.update({
      where: { id: parsed.templateId },
      data: {
        name: parsed.name,
        channel: parsed.channel,
        body: parsed.body,
        isActive: parsed.isActive,
      },
    });
    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "MessageTemplate",
      entityId: updated.id,
      action: AuditAction.UPDATE,
      before: existing,
      after: updated,
    });
    return updated;
  });
}
