import { AuditAction, type Prisma, PrismaClient } from "@prisma/client";

type AuditInput = {
  orgId: string;
  actorId?: string | null;
  entityType: "Vehicle" | "Customer" | "Deal" | "Payment" | string;
  entityId: string;
  action: AuditAction;
  before?: Prisma.InputJsonValue | null;
  after?: Prisma.InputJsonValue | null;
};

type Tx = Prisma.TransactionClient | PrismaClient;

export async function recordAudit(tx: Tx, input: AuditInput) {
  await tx.auditEvent.create({
    data: {
      orgId: input.orgId,
      actorId: input.actorId ?? null,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      before: input.before ?? undefined,
      after: input.after ?? undefined,
    },
  });
}
