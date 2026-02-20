-- CreateEnum
CREATE TYPE "FundingCaseStatus" AS ENUM ('NOT_SUBMITTED', 'SUBMITTED', 'STIPS_REQUESTED', 'APPROVED', 'FUNDED', 'PAID_OUT', 'CLOSED');

-- CreateTable
CREATE TABLE "FundingCase" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "lenderName" TEXT NOT NULL,
    "lenderContactName" TEXT,
    "lenderContactEmail" TEXT,
    "lenderContactPhone" TEXT,
    "status" "FundingCaseStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
    "amountFinanced" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "reserveAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "feeTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "nextAction" TEXT,
    "nextActionAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "fundedAt" TIMESTAMP(3),
    "paidOutAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "notes" TEXT,
    "metadataJson" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FundingCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FundingStip" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "fundingCaseId" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "receivedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "notes" TEXT,
    "attachmentJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FundingStip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FundingCase_dealId_key" ON "FundingCase"("dealId");

-- CreateIndex
CREATE INDEX "FundingCase_orgId_status_createdAt_idx" ON "FundingCase"("orgId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "FundingCase_orgId_nextActionAt_idx" ON "FundingCase"("orgId", "nextActionAt");

-- CreateIndex
CREATE UNIQUE INDEX "FundingCase_orgId_dealId_key" ON "FundingCase"("orgId", "dealId");

-- CreateIndex
CREATE INDEX "FundingStip_orgId_fundingCaseId_createdAt_idx" ON "FundingStip"("orgId", "fundingCaseId", "createdAt");

-- CreateIndex
CREATE INDEX "FundingStip_orgId_required_receivedAt_verifiedAt_idx" ON "FundingStip"("orgId", "required", "receivedAt", "verifiedAt");

-- AddForeignKey
ALTER TABLE "FundingCase" ADD CONSTRAINT "FundingCase_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingCase" ADD CONSTRAINT "FundingCase_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingCase" ADD CONSTRAINT "FundingCase_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingStip" ADD CONSTRAINT "FundingStip_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingStip" ADD CONSTRAINT "FundingStip_fundingCaseId_fkey" FOREIGN KEY ("fundingCaseId") REFERENCES "FundingCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingStip" ADD CONSTRAINT "FundingStip_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

DO $$
BEGIN
  IF to_regclass('"DocumentTemplate_orgId_jurisdiction_docType_dealType_deletedAt_"') IS NOT NULL
     AND to_regclass('"DocumentTemplate_orgId_jurisdiction_docType_dealType_delete_idx"') IS NULL THEN
    ALTER INDEX "DocumentTemplate_orgId_jurisdiction_docType_dealType_deletedAt_" RENAME TO "DocumentTemplate_orgId_jurisdiction_docType_dealType_delete_idx";
  END IF;
END $$;
