"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { InlineEditField } from "@/components/shared/inline-edit-field";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatDate } from "@/lib/utils";

type CustomerDetail = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
  createdAt: string | Date;
  leads: Array<{ id: string; stage: string; source: string; createdAt: string | Date }>;
  deals: Array<{
    id: string;
    dealNumber: string;
    stage: string;
    salePrice: string | number;
    createdAt: string | Date;
  }>;
  appointments: Array<{
    id: string;
    title: string;
    status: string;
    scheduledAt: string | Date;
  }>;
  activities: Array<{
    id: string;
    type: string;
    message: string;
    createdAt: string | Date;
    user: { name: string | null } | null;
  }>;
  payments: Array<{
    id: string;
    amount: string | number;
    postedAt: string | Date;
    method: string;
  }>;
};

export function CustomerDetailClient({ customer }: { customer: CustomerDetail }) {
  const [savingActivity, setSavingActivity] = useState(false);
  const [savingAppointment, setSavingAppointment] = useState(false);

  const addActivity = async (formData: FormData) => {
    setSavingActivity(true);
    const payload = {
      entityType: "Customer",
      entityId: customer.id,
      customerId: customer.id,
      message: String(formData.get("message") ?? ""),
      type: String(formData.get("type") ?? "NOTE"),
    };
    const response = await fetch("/api/activities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSavingActivity(false);
    if (!response.ok) {
      toast.error("Unable to add activity");
      return;
    }
    toast.success("Activity added");
    window.location.reload();
  };

  const addAppointment = async (formData: FormData) => {
    setSavingAppointment(true);
    const payload = {
      customerId: customer.id,
      title: String(formData.get("title") ?? ""),
      scheduledAt: new Date(String(formData.get("scheduledAt"))).toISOString(),
      status: String(formData.get("status") ?? "SCHEDULED"),
      notes: String(formData.get("notes") ?? ""),
    };
    const response = await fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSavingAppointment(false);
    if (!response.ok) {
      toast.error("Unable to add appointment");
      return;
    }
    toast.success("Appointment scheduled");
    window.location.reload();
  };

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <p className="text-xs text-slate-500">Customer Profile</p>
        <h1 className="text-2xl font-semibold text-slate-900">
          {customer.firstName} {customer.lastName}
        </h1>
        <p className="text-sm text-slate-500">
          {customer.email ?? "No email"} • {customer.phone ?? "No phone"}
        </p>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <section className="space-y-4">
          <Tabs defaultValue="summary">
            <TabsList>
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="appointments">Appointments</TabsTrigger>
              <TabsTrigger value="financials">Financials</TabsTrigger>
            </TabsList>
            <TabsContent value="summary" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Inline Profile</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  <InlineEditField label="First Name" value={customer.firstName} field="firstName" endpoint={`/api/customers/${customer.id}`} />
                  <InlineEditField label="Last Name" value={customer.lastName} field="lastName" endpoint={`/api/customers/${customer.id}`} />
                  <InlineEditField label="Email" value={customer.email} field="email" endpoint={`/api/customers/${customer.id}`} />
                  <InlineEditField label="Phone" value={customer.phone} field="phone" endpoint={`/api/customers/${customer.id}`} />
                  <InlineEditField label="City" value={customer.city} field="city" endpoint={`/api/customers/${customer.id}`} />
                  <InlineEditField label="State" value={customer.state} field="state" endpoint={`/api/customers/${customer.id}`} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Leads & Deals</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {customer.leads.map((lead) => (
                    <div key={lead.id} className="rounded border border-slate-200 p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-slate-900">{lead.source}</p>
                        <StatusBadge status={lead.stage} />
                      </div>
                      <p className="text-xs text-slate-500">{formatDate(lead.createdAt)}</p>
                    </div>
                  ))}
                  {customer.deals.map((deal) => (
                    <Link key={deal.id} href={`/deals/${deal.id}`} className="block rounded border border-slate-200 p-3 text-sm hover:bg-slate-50">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-slate-900">{deal.dealNumber}</p>
                        <StatusBadge status={deal.stage} />
                      </div>
                      <p className="text-xs text-slate-500">{formatCurrency(deal.salePrice)}</p>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="appointments" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Schedule Appointment</CardTitle>
                </CardHeader>
                <CardContent>
                  <form action={addAppointment} className="grid gap-2 sm:grid-cols-2">
                    <Input name="title" placeholder="Title" required />
                    <Input name="scheduledAt" type="datetime-local" required />
                    <select name="status" defaultValue="SCHEDULED" className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm">
                      <option value="SCHEDULED">SCHEDULED</option>
                      <option value="CONFIRMED">CONFIRMED</option>
                    </select>
                    <Textarea name="notes" className="sm:col-span-2" placeholder="Notes" />
                    <div className="sm:col-span-2 flex justify-end">
                      <Button type="submit" disabled={savingAppointment}>
                        {savingAppointment ? "Saving..." : "Create Appointment"}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Upcoming</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {customer.appointments.map((appointment) => (
                    <div key={appointment.id} className="rounded border border-slate-200 p-3 text-sm">
                      <p className="font-medium text-slate-900">{appointment.title}</p>
                      <p className="text-xs text-slate-500">{formatDate(appointment.scheduledAt, "MMM d, h:mm a")}</p>
                      <StatusBadge status={appointment.status} />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="financials">
              <Card>
                <CardHeader>
                  <CardTitle>Payment History</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {customer.payments.length === 0 ? <p className="text-sm text-slate-500">No payments recorded.</p> : null}
                  {customer.payments.map((payment) => (
                    <div key={payment.id} className="rounded border border-slate-200 p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-slate-900">{formatCurrency(payment.amount)}</p>
                        <p className="text-xs text-slate-500">{payment.method}</p>
                      </div>
                      <p className="text-xs text-slate-500">{formatDate(payment.postedAt, "MMM d, yyyy h:mm a")}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </section>
        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <form action={addActivity} className="space-y-2">
                <Textarea name="message" placeholder="Add a note, call, text update..." required />
                <select name="type" defaultValue="NOTE" className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
                  <option value="NOTE">NOTE</option>
                  <option value="CALL">CALL</option>
                  <option value="TEXT">TEXT</option>
                  <option value="EMAIL">EMAIL</option>
                </select>
                <Button type="submit" className="w-full" disabled={savingActivity}>
                  {savingActivity ? "Saving..." : "Add Activity"}
                </Button>
              </form>
              {customer.activities.map((activity) => (
                <div key={activity.id} className="rounded border border-slate-200 p-3 text-sm">
                  <p className="font-medium text-slate-900">{activity.message}</p>
                  <p className="text-xs text-slate-500">
                    {activity.type} • {activity.user?.name ?? "System"} • {formatDate(activity.createdAt, "MMM d, h:mm a")}
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
