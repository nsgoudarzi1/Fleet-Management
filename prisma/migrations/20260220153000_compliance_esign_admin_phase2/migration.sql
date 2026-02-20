-- AlterTable
ALTER TABLE "DocumentTemplate"
ADD COLUMN "defaultForOrg" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "sourceHash" TEXT,
ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "DocumentTemplate_orgId_jurisdiction_docType_dealType_deletedAt_effectiveFrom_idx"
ON "DocumentTemplate"("orgId", "jurisdiction", "docType", "dealType", "deletedAt", "effectiveFrom");

-- AlterTable
ALTER TABLE "DocumentEnvelope"
ADD COLUMN "requestId" TEXT,
ADD COLUMN "metadataJson" JSONB;

-- CreateIndex
CREATE UNIQUE INDEX "DocumentEnvelope_orgId_provider_providerEnvelopeId_key"
ON "DocumentEnvelope"("orgId", "provider", "providerEnvelopeId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentEnvelope_orgId_requestId_key"
ON "DocumentEnvelope"("orgId", "requestId");

-- AlterTable
ALTER TABLE "DocumentEvent"
ADD COLUMN "provider" TEXT,
ADD COLUMN "providerEventId" TEXT,
ADD COLUMN "idempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "DocumentEvent_orgId_idempotencyKey_key"
ON "DocumentEvent"("orgId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "DocumentEvent_orgId_provider_providerEventId_idx"
ON "DocumentEvent"("orgId", "provider", "providerEventId");
