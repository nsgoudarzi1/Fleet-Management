import { Role } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireOrgContext } from "@/lib/services/guard";

const saveSchema = z.object({
  entityKey: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(80),
  filterJson: z.record(z.string(), z.any()),
});

export async function listSavedViews(entityKey: string) {
  const ctx = await requireOrgContext(Role.VIEWER);
  return prisma.savedView.findMany({
    where: {
      orgId: ctx.orgId,
      userId: ctx.userId,
      entityKey,
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function createOrUpdateSavedView(input: unknown) {
  const ctx = await requireOrgContext(Role.VIEWER);
  const parsed = saveSchema.parse(input);

  return prisma.savedView.upsert({
    where: {
      orgId_userId_entityKey_name: {
        orgId: ctx.orgId,
        userId: ctx.userId,
        entityKey: parsed.entityKey,
        name: parsed.name,
      },
    },
    update: {
      filterJson: parsed.filterJson as Prisma.InputJsonValue,
    },
    create: {
      orgId: ctx.orgId,
      userId: ctx.userId,
      entityKey: parsed.entityKey,
      name: parsed.name,
      filterJson: parsed.filterJson as Prisma.InputJsonValue,
    },
  });
}

export async function deleteSavedView(id: string) {
  const ctx = await requireOrgContext(Role.VIEWER);
  return prisma.savedView.deleteMany({
    where: {
      id,
      orgId: ctx.orgId,
      userId: ctx.userId,
    },
  });
}
