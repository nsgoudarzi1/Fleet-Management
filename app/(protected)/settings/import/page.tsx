import { ImportManagerClient } from "@/components/modules/imports/import-manager-client";
import { PageHeader } from "@/components/shared/page-header";
import { listImportJobs } from "@/lib/services/imports";

export default async function ImportSettingsPage() {
  const jobs = await listImportJobs();

  return (
    <div className="space-y-4">
      <PageHeader
        title="CSV Import"
        description="Map columns, preview data, run idempotent imports, and rollback created rows."
      />
      <ImportManagerClient initialJobs={jobs as never[]} />
    </div>
  );
}

