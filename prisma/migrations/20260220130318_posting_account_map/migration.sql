-- CreateTable
CREATE TABLE "PostingAccountMap" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "sourceType" "JournalSourceType" NOT NULL,
    "key" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostingAccountMap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PostingAccountMap_orgId_sourceType_createdAt_idx" ON "PostingAccountMap"("orgId", "sourceType", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PostingAccountMap_orgId_sourceType_key_key" ON "PostingAccountMap"("orgId", "sourceType", "key");

-- AddForeignKey
ALTER TABLE "PostingAccountMap" ADD CONSTRAINT "PostingAccountMap_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostingAccountMap" ADD CONSTRAINT "PostingAccountMap_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ChartOfAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class
    WHERE relkind = 'i'
      AND relname = 'DocumentTemplate_orgId_jurisdiction_docType_dealType_deletedAt_'
  ) THEN
    ALTER INDEX "DocumentTemplate_orgId_jurisdiction_docType_dealType_deletedAt_"
      RENAME TO "DocumentTemplate_orgId_jurisdiction_docType_dealType_delete_idx";
  END IF;
END
$$;
