DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class
    WHERE relkind = 'i'
      AND relname = 'DocumentTemplate_jurisdiction_docType_dealType_effectiveFrom_id'
  ) THEN
    ALTER INDEX "DocumentTemplate_jurisdiction_docType_dealType_effectiveFrom_id"
      RENAME TO "DocumentTemplate_jurisdiction_docType_dealType_effectiveFro_idx";
  END IF;
END
$$;

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

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class
    WHERE relkind = 'i'
      AND relname = 'DocumentTemplate_orgId_jurisdiction_docType_dealType_effectiveF'
  ) THEN
    ALTER INDEX "DocumentTemplate_orgId_jurisdiction_docType_dealType_effectiveF"
      RENAME TO "DocumentTemplate_orgId_jurisdiction_docType_dealType_effect_idx";
  END IF;
END
$$;
