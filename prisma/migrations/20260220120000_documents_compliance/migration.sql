-- CreateEnum
CREATE TYPE "DealType" AS ENUM ('CASH', 'FINANCE', 'LEASE');

-- CreateEnum
CREATE TYPE "DocumentTemplateEngine" AS ENUM ('HTML', 'DOCX');

-- CreateEnum
CREATE TYPE "DocumentOutputFormat" AS ENUM ('PDF');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM (
  'BUYERS_ORDER',
  'RETAIL_INSTALLMENT_CONTRACT',
  'ODOMETER_DISCLOSURE',
  'POWER_OF_ATTORNEY',
  'TITLE_REG_APPLICATION',
  'WE_OWE',
  'PRIVACY_NOTICE'
);

-- CreateEnum
CREATE TYPE "DealDocumentStatus" AS ENUM (
  'DRAFT',
  'GENERATED',
  'SENT_FOR_SIGNATURE',
  'PARTIALLY_SIGNED',
  'COMPLETED',
  'VOIDED',
  'FAILED'
);

-- CreateEnum
CREATE TYPE "DocumentEnvelopeStatus" AS ENUM (
  'DRAFT',
  'SENT',
  'VIEWED',
  'PARTIALLY_SIGNED',
  'COMPLETED',
  'DECLINED',
  'VOIDED',
  'ERROR'
);

-- AlterTable
ALTER TABLE "Deal"
ADD COLUMN "dealType" "DealType" NOT NULL DEFAULT 'FINANCE',
ADD COLUMN "jurisdiction" CHAR(2);

-- CreateTable
CREATE TABLE "DocumentTemplate" (
  "id" TEXT NOT NULL,
  "orgId" TEXT,
  "name" TEXT NOT NULL,
  "docType" "DocumentType" NOT NULL,
  "jurisdiction" CHAR(2) NOT NULL,
  "dealType" "DealType" NOT NULL,
  "version" INTEGER NOT NULL,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "templateEngine" "DocumentTemplateEngine" NOT NULL,
  "sourceHtml" TEXT,
  "sourceDocxKey" TEXT,
  "requiredFieldsJson" JSONB NOT NULL,
  "outputFormat" "DocumentOutputFormat" NOT NULL DEFAULT 'PDF',
  "metadataJson" JSONB,
  "notLegalAdviceNotice" TEXT NOT NULL DEFAULT 'Not legal advice. Validate all templates and rules with licensed counsel.',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DocumentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceRuleSet" (
  "id" TEXT NOT NULL,
  "orgId" TEXT,
  "jurisdiction" CHAR(2) NOT NULL,
  "version" INTEGER NOT NULL,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "rulesJson" JSONB NOT NULL,
  "metadataJson" JSONB,
  "notLegalAdviceNotice" TEXT NOT NULL DEFAULT 'Not legal advice. Validate all compliance rules with licensed counsel.',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ComplianceRuleSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealDocument" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "dealId" TEXT NOT NULL,
  "templateId" TEXT,
  "envelopeId" TEXT,
  "docType" "DocumentType" NOT NULL,
  "status" "DealDocumentStatus" NOT NULL DEFAULT 'DRAFT',
  "generatedAt" TIMESTAMP(3),
  "fileKey" TEXT,
  "fileHash" TEXT,
  "metadataJson" JSONB,
  "regenerateReason" TEXT,
  "createdById" TEXT,
  "voidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DealDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentEnvelope" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "dealId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerEnvelopeId" TEXT,
  "status" "DocumentEnvelopeStatus" NOT NULL DEFAULT 'DRAFT',
  "recipientsJson" JSONB NOT NULL,
  "sentAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DocumentEnvelope_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentEvent" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "envelopeId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "payloadJson" JSONB NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentFieldMap" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "docType" "DocumentType" NOT NULL,
  "anchor" TEXT NOT NULL,
  "fieldType" TEXT NOT NULL,
  "signerRole" TEXT NOT NULL,
  "signerIndex" INTEGER NOT NULL DEFAULT 0,
  "page" INTEGER,
  "x" DECIMAL(10,4),
  "y" DECIMAL(10,4),
  "width" DECIMAL(10,4),
  "height" DECIMAL(10,4),
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DocumentFieldMap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Deal_orgId_dealType_createdAt_idx" ON "Deal"("orgId", "dealType", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentTemplate_orgId_jurisdiction_docType_dealType_effectiveFrom_idx" ON "DocumentTemplate"("orgId", "jurisdiction", "docType", "dealType", "effectiveFrom");

-- CreateIndex
CREATE INDEX "DocumentTemplate_jurisdiction_docType_dealType_effectiveFrom_idx" ON "DocumentTemplate"("jurisdiction", "docType", "dealType", "effectiveFrom");

-- CreateIndex
CREATE INDEX "ComplianceRuleSet_orgId_jurisdiction_effectiveFrom_idx" ON "ComplianceRuleSet"("orgId", "jurisdiction", "effectiveFrom");

-- CreateIndex
CREATE INDEX "ComplianceRuleSet_jurisdiction_effectiveFrom_idx" ON "ComplianceRuleSet"("jurisdiction", "effectiveFrom");

-- CreateIndex
CREATE INDEX "DealDocument_orgId_dealId_docType_idx" ON "DealDocument"("orgId", "dealId", "docType");

-- CreateIndex
CREATE INDEX "DealDocument_orgId_status_createdAt_idx" ON "DealDocument"("orgId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentEnvelope_orgId_dealId_createdAt_idx" ON "DocumentEnvelope"("orgId", "dealId", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentEnvelope_orgId_status_createdAt_idx" ON "DocumentEnvelope"("orgId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentEvent_orgId_receivedAt_idx" ON "DocumentEvent"("orgId", "receivedAt");

-- CreateIndex
CREATE INDEX "DocumentEvent_orgId_envelopeId_receivedAt_idx" ON "DocumentEvent"("orgId", "envelopeId", "receivedAt");

-- CreateIndex
CREATE INDEX "DocumentFieldMap_orgId_templateId_createdAt_idx" ON "DocumentFieldMap"("orgId", "templateId", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentFieldMap_orgId_docType_anchor_idx" ON "DocumentFieldMap"("orgId", "docType", "anchor");

-- AddForeignKey
ALTER TABLE "DocumentTemplate" ADD CONSTRAINT "DocumentTemplate_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceRuleSet" ADD CONSTRAINT "ComplianceRuleSet_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealDocument" ADD CONSTRAINT "DealDocument_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealDocument" ADD CONSTRAINT "DealDocument_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealDocument" ADD CONSTRAINT "DealDocument_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "DocumentTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentEnvelope" ADD CONSTRAINT "DocumentEnvelope_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentEnvelope" ADD CONSTRAINT "DocumentEnvelope_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealDocument" ADD CONSTRAINT "DealDocument_envelopeId_fkey" FOREIGN KEY ("envelopeId") REFERENCES "DocumentEnvelope"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentEvent" ADD CONSTRAINT "DocumentEvent_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentEvent" ADD CONSTRAINT "DocumentEvent_envelopeId_fkey" FOREIGN KEY ("envelopeId") REFERENCES "DocumentEnvelope"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentFieldMap" ADD CONSTRAINT "DocumentFieldMap_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentFieldMap" ADD CONSTRAINT "DocumentFieldMap_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "DocumentTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
