import { Role } from "@prisma/client";
import { TemplatesManagerClient } from "@/components/modules/compliance/templates-manager-client";
import { PageHeader } from "@/components/shared/page-header";
import { requireOrgRoles } from "@/lib/services/guard";

export default async function ComplianceTemplatesPage() {
  await requireOrgRoles([Role.ADMIN, Role.ACCOUNTING]);
  return (
    <div className="space-y-4">
      <PageHeader
        title="Compliance Templates"
        description="Versioned, state-aware template management. Not legal advice."
      />
      <TemplatesManagerClient />
    </div>
  );
}
