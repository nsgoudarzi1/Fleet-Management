import { Role } from "@prisma/client";
import { IntegrationsSettingsClient } from "@/components/modules/integrations/integrations-settings-client";
import { PageHeader } from "@/components/shared/page-header";
import { requireOrgRoles } from "@/lib/services/guard";
import { listWebhookEndpoints, listApiKeys } from "@/lib/services/integrations";

export default async function IntegrationsSettingsPage() {
  await requireOrgRoles([Role.ADMIN]);
  const [apiKeys, webhookData] = await Promise.all([listApiKeys(), listWebhookEndpoints()]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Open Integrations"
        description="Org-scoped API keys, outbound webhooks with retries, and delivery diagnostics."
      />
      <IntegrationsSettingsClient
        apiKeys={apiKeys as never[]}
        webhooks={webhookData.endpoints as never[]}
        deliveries={webhookData.recentDeliveries as never[]}
      />
    </div>
  );
}
