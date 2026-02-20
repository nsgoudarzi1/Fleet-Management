import { AuditViewerClient } from "@/components/modules/security/audit-viewer-client";
import { PageHeader } from "@/components/shared/page-header";
import { listAuditEvents } from "@/lib/services/security";

export default async function AuditPage() {
  const data = await listAuditEvents({});

  return (
    <div className="space-y-4">
      <PageHeader
        title="Audit Log"
        description="Filterable event history with before/after snapshots for critical actions."
      />
      <AuditViewerClient initialItems={data.items as never[]} />
    </div>
  );
}

