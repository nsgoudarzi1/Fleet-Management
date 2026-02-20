import { PageHeader } from "@/components/shared/page-header";
import { SecuritySettingsClient } from "@/components/modules/security/security-settings-client";
import { listSecuritySettings } from "@/lib/services/security";

export default async function SecuritySettingsPage() {
  const data = await listSecuritySettings();

  return (
    <div className="space-y-4">
      <PageHeader
        title="Security & Permissions"
        description="Manage custom roles, permission matrix, and user assignments."
      />
      <SecuritySettingsClient
        builtInRoles={data.builtInRoles as never[]}
        customRoles={data.customRoles as never[]}
        memberships={data.memberships as never[]}
        scopes={data.allPermissionScopes as never[]}
      />
    </div>
  );
}

