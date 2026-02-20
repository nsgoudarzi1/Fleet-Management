"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type BuiltInRole = { role: string; permissions: string[] };
type CustomRole = { id: string; name: string; description: string | null; permissions: Array<{ scope: string }> };
type Membership = {
  id: string;
  role: string;
  customRoleId: string | null;
  user: { id: string; name: string | null; email: string };
};

export function SecuritySettingsClient({
  builtInRoles,
  customRoles,
  memberships,
  scopes,
}: {
  builtInRoles: BuiltInRole[];
  customRoles: CustomRole[];
  memberships: Membership[];
  scopes: string[];
}) {
  const [selectedScopes, setSelectedScopes] = useState<string[]>(["DEALS_READ"]);
  const [savingRole, setSavingRole] = useState(false);
  const [roleName, setRoleName] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const [savingMembershipId, setSavingMembershipId] = useState<string | null>(null);

  const createRole = async () => {
    setSavingRole(true);
    const response = await fetch("/api/security/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: roleName,
        description: roleDescription,
        permissions: selectedScopes,
      }),
    });
    setSavingRole(false);
    if (!response.ok) {
      toast.error("Unable to create role.");
      return;
    }
    toast.success("Custom role created.");
    window.location.reload();
  };

  const updateMembership = async (membershipId: string, role: string, customRoleId: string | null) => {
    setSavingMembershipId(membershipId);
    const response = await fetch(`/api/security/memberships/${membershipId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, customRoleId }),
    });
    setSavingMembershipId(null);
    if (!response.ok) {
      toast.error("Unable to update membership.");
      return;
    }
    toast.success("Membership updated.");
    window.location.reload();
  };

  return (
    <Tabs defaultValue="roles" className="space-y-3">
      <TabsList>
        <TabsTrigger value="roles">Roles</TabsTrigger>
        <TabsTrigger value="users">Users</TabsTrigger>
      </TabsList>
      <TabsContent value="roles" className="space-y-3">
        <Card>
          <CardHeader><CardTitle>Create Custom Role</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input value={roleName} onChange={(event) => setRoleName(event.target.value)} placeholder="Role name" />
            <Textarea value={roleDescription} onChange={(event) => setRoleDescription(event.target.value)} placeholder="Description" />
            <div className="grid gap-2 md:grid-cols-3 text-sm">
              {scopes.map((scope) => (
                <label key={scope} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedScopes.includes(scope)}
                    onChange={(event) =>
                      setSelectedScopes((current) =>
                        event.target.checked ? Array.from(new Set([...current, scope])) : current.filter((item) => item !== scope),
                      )
                    }
                  />
                  {scope}
                </label>
              ))}
            </div>
            <div className="flex justify-end">
              <Button disabled={savingRole || !roleName || selectedScopes.length === 0} onClick={() => void createRole()}>
                {savingRole ? "Saving..." : "Create Role"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Built-in Roles</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {builtInRoles.map((role) => (
              <div key={role.role} className="rounded border border-slate-200 p-3">
                <p className="font-medium text-slate-900">{role.role}</p>
                <p className="text-xs text-slate-500">{role.permissions.join(", ")}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Custom Roles</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {customRoles.map((role) => (
              <div key={role.id} className="rounded border border-slate-200 p-3">
                <p className="font-medium text-slate-900">{role.name}</p>
                <p className="text-xs text-slate-500">{role.description ?? "No description"}</p>
                <p className="text-xs text-slate-500">{role.permissions.map((perm) => perm.scope).join(", ")}</p>
              </div>
            ))}
            {customRoles.length === 0 ? <p className="text-slate-500">No custom roles yet.</p> : null}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="users">
        <Card>
          <CardHeader><CardTitle>User Assignments</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {memberships.map((membership) => (
              <MembershipRow
                key={membership.id}
                membership={membership}
                customRoles={customRoles}
                saving={savingMembershipId === membership.id}
                onSave={updateMembership}
              />
            ))}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

function MembershipRow({
  membership,
  customRoles,
  saving,
  onSave,
}: {
  membership: Membership;
  customRoles: CustomRole[];
  saving: boolean;
  onSave: (membershipId: string, role: string, customRoleId: string | null) => Promise<void>;
}) {
  const [role, setRole] = useState(membership.role);
  const [customRoleId, setCustomRoleId] = useState(membership.customRoleId ?? "");
  return (
    <div className="rounded border border-slate-200 p-3">
      <p className="font-medium text-slate-900">{membership.user.name ?? membership.user.email}</p>
      <p className="mb-2 text-xs text-slate-500">{membership.user.email}</p>
      <div className="grid gap-2 md:grid-cols-[180px_1fr_auto]">
        <select className="h-9 rounded border border-slate-300 px-2" value={role} onChange={(event) => setRole(event.target.value)}>
          {["OWNER", "ADMIN", "MANAGER", "SALES", "ACCOUNTING", "SERVICE", "VIEWER"].map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        <select
          className="h-9 rounded border border-slate-300 px-2"
          value={customRoleId}
          onChange={(event) => setCustomRoleId(event.target.value)}
        >
          <option value="">No custom role</option>
          {customRoles.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
        <Button size="sm" disabled={saving} onClick={() => void onSave(membership.id, role, customRoleId || null)}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}

