import { Role } from "@prisma/client";
import { RulesManagerClient } from "@/components/modules/compliance/rules-manager-client";
import { PageHeader } from "@/components/shared/page-header";
import { requireOrgRoles } from "@/lib/services/guard";

export default async function ComplianceRulesPage() {
  await requireOrgRoles([Role.ADMIN, Role.ACCOUNTING]);
  return (
    <div className="space-y-4">
      <PageHeader
        title="Compliance Rules"
        description="Versioned jurisdiction rulesets with evaluation harness. Not legal advice."
      />
      <RulesManagerClient />
    </div>
  );
}
