"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/utils";

type LeadDetail = {
  id: string;
  source: string;
  stage: string;
  statusNote: string | null;
  nextAction: string | null;
  nextActionAt: string | Date | null;
  slaDueAt: string | Date | null;
  firstResponseAt: string | Date | null;
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
  } | null;
  vehicle: {
    id: string;
    stockNumber: string;
    year: number;
    make: string;
    model: string;
  } | null;
  assignedTo: { id: string; name: string | null } | null;
  appointments: Array<{ id: string; title: string; status: string; scheduledAt: string | Date }>;
  crmTasks: Array<{ id: string; title: string; status: string; dueAt: string | Date | null }>;
  activities: Array<{ id: string; type: string; message: string; createdAt: string | Date }>;
};

const LEAD_STAGES = ["NEW", "CONTACTED", "QUALIFIED", "APPOINTMENT_SET", "NEGOTIATION", "WON", "LOST"];

export function LeadDetailClient({ lead }: { lead: LeadDetail }) {
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);
  const [addingActivity, setAddingActivity] = useState(false);
  const [addingTask, setAddingTask] = useState(false);

  const updateLead = async (formData: FormData) => {
    setSaving(true);
    const payload = {
      stage: String(formData.get("stage") ?? lead.stage),
      nextAction: String(formData.get("nextAction") ?? ""),
      nextActionAt: formData.get("nextActionAt")
        ? new Date(String(formData.get("nextActionAt"))).toISOString()
        : undefined,
      slaDueAt: formData.get("slaDueAt") ? new Date(String(formData.get("slaDueAt"))).toISOString() : undefined,
      statusNote: String(formData.get("statusNote") ?? ""),
    };
    const response = await fetch(`/api/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!response.ok) {
      toast.error("Unable to update lead");
      return;
    }
    toast.success("Lead updated");
    window.location.reload();
  };

  const convertLead = async (formData: FormData) => {
    setConverting(true);
    const payload = {
      leadId: lead.id,
      firstName: String(formData.get("firstName") ?? ""),
      lastName: String(formData.get("lastName") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
    };
    const response = await fetch("/api/leads/convert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setConverting(false);
    if (!response.ok) {
      toast.error("Unable to convert lead");
      return;
    }
    const json = (await response.json()) as { data: { customer: { id: string } } };
    toast.success("Lead converted");
    window.location.href = `/crm/customers/${json.data.customer.id}`;
  };

  const addActivity = async (formData: FormData) => {
    setAddingActivity(true);
    const payload = {
      entityType: "Lead",
      entityId: lead.id,
      leadId: lead.id,
      customerId: lead.customer?.id,
      message: String(formData.get("message") ?? ""),
      type: String(formData.get("type") ?? "NOTE"),
    };
    const response = await fetch("/api/activities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setAddingActivity(false);
    if (!response.ok) {
      toast.error("Unable to add activity");
      return;
    }
    toast.success("Activity added");
    window.location.reload();
  };

  const addTask = async (formData: FormData) => {
    setAddingTask(true);
    const response = await fetch("/api/crm/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: String(formData.get("title") ?? ""),
        description: String(formData.get("description") ?? ""),
        dueAt: formData.get("dueAt") ? new Date(String(formData.get("dueAt"))).toISOString() : undefined,
        leadId: lead.id,
        customerId: lead.customer?.id,
      }),
    });
    setAddingTask(false);
    if (!response.ok) {
      toast.error("Unable to add task");
      return;
    }
    toast.success("Task added");
    window.location.reload();
  };

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <p className="text-xs text-slate-500">{lead.source} Lead</p>
        <h1 className="text-2xl font-semibold text-slate-900">
          {lead.customer ? `${lead.customer.firstName} ${lead.customer.lastName}` : "Unconverted Prospect"}
        </h1>
        <div className="mt-2 flex items-center gap-2">
          <StatusBadge status={lead.stage} />
          <p className="text-sm text-slate-500">
            {lead.firstResponseAt
              ? `First response ${formatDate(lead.firstResponseAt, "MMM d, h:mm a")}`
              : `SLA due ${lead.slaDueAt ? formatDate(lead.slaDueAt, "MMM d, h:mm a") : "N/A"}`}
          </p>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <section className="space-y-4">
          <Tabs defaultValue="pipeline">
            <TabsList>
              <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
              <TabsTrigger value="appointments">Appointments</TabsTrigger>
              <TabsTrigger value="convert">Convert</TabsTrigger>
            </TabsList>
            <TabsContent value="pipeline">
              <Card>
                <CardHeader>
                  <CardTitle>Update Lead</CardTitle>
                </CardHeader>
                <CardContent>
                  <form action={updateLead} className="grid gap-2 sm:grid-cols-2">
                    <select name="stage" defaultValue={lead.stage} className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm">
                      {LEAD_STAGES.map((stage) => (
                        <option value={stage} key={stage}>
                          {stage.replaceAll("_", " ")}
                        </option>
                      ))}
                    </select>
                    <Input name="nextAction" placeholder="Next action" defaultValue={lead.nextAction ?? ""} />
                    <Input
                      name="nextActionAt"
                      type="datetime-local"
                      defaultValue={lead.nextActionAt ? new Date(lead.nextActionAt).toISOString().slice(0, 16) : ""}
                    />
                    <Input
                      name="slaDueAt"
                      type="datetime-local"
                      defaultValue={lead.slaDueAt ? new Date(lead.slaDueAt).toISOString().slice(0, 16) : ""}
                    />
                    <Textarea name="statusNote" className="sm:col-span-2" defaultValue={lead.statusNote ?? ""} />
                    <div className="sm:col-span-2 flex justify-end">
                      <Button type="submit" disabled={saving}>
                        {saving ? "Saving..." : "Save Pipeline Updates"}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="appointments">
              <Card>
                <CardHeader>
                  <CardTitle>Appointments</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {lead.appointments.length === 0 ? <p className="text-sm text-slate-500">No appointments yet.</p> : null}
                  {lead.appointments.map((appointment) => (
                    <div key={appointment.id} className="rounded border border-slate-200 p-3 text-sm">
                      <p className="font-medium text-slate-900">{appointment.title}</p>
                      <p className="text-xs text-slate-500">{formatDate(appointment.scheduledAt, "MMM d, h:mm a")}</p>
                      <StatusBadge status={appointment.status} />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="convert">
              <Card>
                <CardHeader>
                  <CardTitle>Convert to Customer</CardTitle>
                </CardHeader>
                <CardContent>
                  <form action={convertLead} className="grid gap-2 sm:grid-cols-2">
                    <Input name="firstName" placeholder="First Name" defaultValue={lead.customer?.firstName ?? ""} required />
                    <Input name="lastName" placeholder="Last Name" defaultValue={lead.customer?.lastName ?? ""} required />
                    <Input name="email" type="email" placeholder="Email" defaultValue={lead.customer?.email ?? ""} />
                    <Input name="phone" placeholder="Phone" defaultValue={lead.customer?.phone ?? ""} />
                    <div className="sm:col-span-2 flex justify-end">
                      <Button type="submit" disabled={converting}>
                        {converting ? "Converting..." : "Convert Lead"}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </section>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Context</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {lead.vehicle ? (
                <Link href={`/inventory/${lead.vehicle.id}`} className="block rounded border border-slate-200 p-3 hover:bg-slate-50">
                  <p className="font-medium text-slate-900">
                    {lead.vehicle.year} {lead.vehicle.make} {lead.vehicle.model}
                  </p>
                  <p className="text-xs text-slate-500">{lead.vehicle.stockNumber}</p>
                </Link>
              ) : (
                <p className="text-slate-500">No vehicle tied yet.</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Activity & Tasks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <form action={addActivity} className="space-y-2">
                <Textarea name="message" placeholder="Log a note, call, text..." required />
                <select name="type" defaultValue="NOTE" className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
                  <option value="NOTE">NOTE</option>
                  <option value="CALL">CALL</option>
                  <option value="TEXT">TEXT</option>
                  <option value="EMAIL">EMAIL</option>
                </select>
                <Button type="submit" className="w-full" disabled={addingActivity}>
                  {addingActivity ? "Saving..." : "Add Activity"}
                </Button>
              </form>
              <form action={addTask} className="space-y-2 rounded border border-slate-200 p-3">
                <Input name="title" placeholder="Create follow-up task" required />
                <Input name="dueAt" type="datetime-local" />
                <Textarea name="description" placeholder="Task details" />
                <Button type="submit" className="w-full" variant="outline" disabled={addingTask}>
                  {addingTask ? "Saving..." : "Add Task"}
                </Button>
              </form>
              {lead.crmTasks.map((task) => (
                <div key={task.id} className="rounded border border-slate-200 p-3 text-sm">
                  <p className="font-medium text-slate-900">{task.title}</p>
                  <p className="text-xs text-slate-500">
                    {task.status}
                    {task.dueAt ? ` • Due ${formatDate(task.dueAt, "MMM d, h:mm a")}` : ""}
                  </p>
                </div>
              ))}
              {lead.activities.map((activity) => (
                <div key={activity.id} className="rounded border border-slate-200 p-3 text-sm">
                  <p className="font-medium text-slate-900">{activity.message}</p>
                  <p className="text-xs text-slate-500">
                    {activity.type} • {formatDate(activity.createdAt, "MMM d, h:mm a")}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
