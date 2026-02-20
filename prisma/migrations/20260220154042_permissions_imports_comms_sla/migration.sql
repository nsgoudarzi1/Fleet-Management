-- CreateEnum
CREATE TYPE "PermissionScope" AS ENUM ('INVENTORY_READ', 'INVENTORY_WRITE', 'CRM_READ', 'CRM_WRITE', 'DEALS_READ', 'DEALS_WRITE', 'FIXEDOPS_READ', 'FIXEDOPS_WRITE', 'FIXEDOPS_CLOSE', 'ACCOUNTING_READ', 'ACCOUNTING_POST', 'FUNDING_MANAGE', 'COMPLIANCE_MANAGE', 'INTEGRATIONS_MANAGE', 'IMPORT_MANAGE', 'SECURITY_MANAGE', 'AUDIT_READ');

-- CreateEnum
CREATE TYPE "ImportJobStatus" AS ENUM ('DRAFT', 'RUNNING', 'COMPLETED', 'FAILED', 'ROLLED_BACK');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'COMPLETED', 'CANCELED');

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "firstResponseAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Membership" ADD COLUMN     "customRoleId" TEXT;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "leadSlaMinutes" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN     "taskOverdueGraceMinutes" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "OrgRole" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "scope" "PermissionScope" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "status" "ImportJobStatus" NOT NULL DEFAULT 'DRAFT',
    "originalFileKey" TEXT,
    "mappingJson" JSONB,
    "statsJson" JSONB,
    "errorJson" JSONB,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "rolledBackAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportJobRow" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "importJobId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "externalId" TEXT,
    "action" TEXT NOT NULL,
    "snapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportJobRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageTemplate" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmTask" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'OPEN',
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "assignedToId" TEXT,
    "createdById" TEXT,
    "leadId" TEXT,
    "customerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationAttempt" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "activityId" TEXT,
    "leadId" TEXT,
    "customerId" TEXT,
    "provider" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "recipient" TEXT,
    "status" TEXT NOT NULL,
    "payloadJson" JSONB,
    "responseJson" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrgRole_orgId_createdAt_idx" ON "OrgRole"("orgId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrgRole_orgId_name_key" ON "OrgRole"("orgId", "name");

-- CreateIndex
CREATE INDEX "RolePermission_orgId_scope_idx" ON "RolePermission"("orgId", "scope");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_roleId_scope_key" ON "RolePermission"("roleId", "scope");

-- CreateIndex
CREATE INDEX "ImportJob_orgId_status_createdAt_idx" ON "ImportJob"("orgId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ImportJob_orgId_entityType_createdAt_idx" ON "ImportJob"("orgId", "entityType", "createdAt");

-- CreateIndex
CREATE INDEX "ImportJobRow_orgId_importJobId_createdAt_idx" ON "ImportJobRow"("orgId", "importJobId", "createdAt");

-- CreateIndex
CREATE INDEX "ImportJobRow_orgId_entityType_entityId_idx" ON "ImportJobRow"("orgId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "MessageTemplate_orgId_channel_createdAt_idx" ON "MessageTemplate"("orgId", "channel", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MessageTemplate_orgId_name_key" ON "MessageTemplate"("orgId", "name");

-- CreateIndex
CREATE INDEX "CrmTask_orgId_status_dueAt_idx" ON "CrmTask"("orgId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "CrmTask_orgId_assignedToId_status_idx" ON "CrmTask"("orgId", "assignedToId", "status");

-- CreateIndex
CREATE INDEX "CrmTask_orgId_leadId_idx" ON "CrmTask"("orgId", "leadId");

-- CreateIndex
CREATE INDEX "CommunicationAttempt_orgId_channel_createdAt_idx" ON "CommunicationAttempt"("orgId", "channel", "createdAt");

-- CreateIndex
CREATE INDEX "CommunicationAttempt_orgId_leadId_createdAt_idx" ON "CommunicationAttempt"("orgId", "leadId", "createdAt");

-- CreateIndex
CREATE INDEX "Lead_orgId_firstResponseAt_idx" ON "Lead"("orgId", "firstResponseAt");

-- CreateIndex
CREATE INDEX "Membership_orgId_customRoleId_idx" ON "Membership"("orgId", "customRoleId");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_customRoleId_fkey" FOREIGN KEY ("customRoleId") REFERENCES "OrgRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgRole" ADD CONSTRAINT "OrgRole_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgRole" ADD CONSTRAINT "OrgRole_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "OrgRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJobRow" ADD CONSTRAINT "ImportJobRow_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJobRow" ADD CONSTRAINT "ImportJobRow_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "ImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageTemplate" ADD CONSTRAINT "MessageTemplate_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageTemplate" ADD CONSTRAINT "MessageTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTask" ADD CONSTRAINT "CrmTask_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTask" ADD CONSTRAINT "CrmTask_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTask" ADD CONSTRAINT "CrmTask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTask" ADD CONSTRAINT "CrmTask_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTask" ADD CONSTRAINT "CrmTask_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationAttempt" ADD CONSTRAINT "CommunicationAttempt_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationAttempt" ADD CONSTRAINT "CommunicationAttempt_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "ActivityLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationAttempt" ADD CONSTRAINT "CommunicationAttempt_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationAttempt" ADD CONSTRAINT "CommunicationAttempt_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationAttempt" ADD CONSTRAINT "CommunicationAttempt_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

DO $$
BEGIN
  IF to_regclass('"DocumentTemplate_orgId_jurisdiction_docType_dealType_deletedAt_"') IS NOT NULL
     AND to_regclass('"DocumentTemplate_orgId_jurisdiction_docType_dealType_delete_idx"') IS NULL THEN
    ALTER INDEX "DocumentTemplate_orgId_jurisdiction_docType_dealType_deletedAt_" RENAME TO "DocumentTemplate_orgId_jurisdiction_docType_dealType_delete_idx";
  END IF;
END $$;
