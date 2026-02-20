"use client";

import Link from "next/link";
import { CalendarPlus, RefreshCw, Repeat, Wrench } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { DataTable } from "@/components/tables/data-table";
import { SavedViewsBar } from "@/components/tables/saved-views-bar";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/utils";

type AppointmentRow = {
  id: string;
  title: string;
  concern: string | null;
  scheduledAt: string | Date;
  status: string;
  customer: { id: string; firstName: string; lastName: string } | null;
  vehicle: { id: string; year: number; make: string; model: string; stockNumber: string } | null;
  technician: { id: string; displayName: string } | null;
  repairOrder: { id: string; roNumber: string } | null;
};

type SimpleOption = { id: string; label: string };

export function ServiceAppointmentsListClient({
  rows,
  customerOptions,
  vehicleOptions,
  technicianOptions,
}: {
  rows: AppointmentRow[];
  customerOptions: SimpleOption[];
  vehicleOptions: SimpleOption[];
  technicianOptions: SimpleOption[];
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [convertingId, setConvertingId] = useState<string | null>(null);

  const columns = useMemo(
    () => [
      {
        key: "scheduledAt",
        label: "Scheduled",
        render: (row: AppointmentRow) => formatDate(row.scheduledAt, "MMM d, h:mm a"),
      },
      {
        key: "title",
        label: "Appointment",
        render: (row: AppointmentRow) => (
          <div>
            <p className="font-medium text-slate-900">{row.title}</p>
            <p className="text-xs text-slate-500">{row.concern ?? "No concern noted"}</p>
          </div>
        ),
      },
      {
        key: "customer",
        label: "Customer",
        render: (row: AppointmentRow) =>
          row.customer ? `${row.customer.firstName} ${row.customer.lastName}` : "-",
      },
      {
        key: "vehicle",
        label: "Vehicle",
        render: (row: AppointmentRow) =>
          row.vehicle ? `${row.vehicle.year} ${row.vehicle.make} ${row.vehicle.model}` : "-",
      },
      {
        key: "technician",
        label: "Tech",
        render: (row: AppointmentRow) => row.technician?.displayName ?? "Unassigned",
      },
      {
        key: "status",
        label: "Status",
        render: (row: AppointmentRow) => <StatusBadge status={row.status} />,
      },
      {
        key: "repairOrder",
        label: "Repair Order",
        render: (row: AppointmentRow) => row.repairOrder?.roNumber ?? "Not converted",
      },
    ],
    [],
  );

  const convertToRo = async (appointmentId: string) => {
    setConvertingId(appointmentId);
    const response = await fetch(`/api/fixedops/appointments/${appointmentId}/convert-to-ro`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    setConvertingId(null);
    if (!response.ok) {
      toast.error("Unable to convert appointment.");
      return;
    }
    const payload = (await response.json()) as { data: { id: string } };
    toast.success("Appointment converted to repair order.");
    window.location.assign(`/fixedops/repair-orders/${payload.data.id}`);
  };

  return (
    <div className="space-y-3">
      <SavedViewsBar entityKey="fixedops-appointments" />
      <DataTable
        rows={rows}
        columns={columns}
        selectedIds={selectedIds}
        onSelectedIdsChange={setSelectedIds}
        storageKey="fixedops-appointments-table"
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <CreateAppointmentDialog
              customerOptions={customerOptions}
              vehicleOptions={vehicleOptions}
              technicianOptions={technicianOptions}
            />
          </div>
        }
        rowActions={(row) => (
          <>
            {row.repairOrder ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`/fixedops/repair-orders/${row.repairOrder.id}`}>Open RO</Link>
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                disabled={convertingId === row.id}
                onClick={() => void convertToRo(row.id)}
              >
                <Repeat className="mr-2 h-4 w-4" />
                {convertingId === row.id ? "Converting..." : "Convert"}
              </Button>
            )}
          </>
        )}
      />
    </div>
  );
}

function CreateAppointmentDialog({
  customerOptions,
  vehicleOptions,
  technicianOptions,
}: {
  customerOptions: SimpleOption[];
  vehicleOptions: SimpleOption[];
  technicianOptions: SimpleOption[];
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const createAppointment = async (formData: FormData) => {
    setSaving(true);
    const payload = {
      title: String(formData.get("title") ?? ""),
      concern: String(formData.get("concern") ?? "") || undefined,
      notes: String(formData.get("notes") ?? "") || undefined,
      customerId: String(formData.get("customerId") ?? "") || undefined,
      vehicleId: String(formData.get("vehicleId") ?? "") || undefined,
      technicianId: String(formData.get("technicianId") ?? "") || undefined,
      scheduledAt: new Date(String(formData.get("scheduledAt") ?? new Date().toISOString())).toISOString(),
      status: String(formData.get("status") ?? "SCHEDULED"),
    };

    const response = await fetch("/api/fixedops/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);

    if (!response.ok) {
      toast.error("Unable to create service appointment.");
      return;
    }

    toast.success("Service appointment created.");
    setOpen(false);
    window.location.reload();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <CalendarPlus className="mr-2 h-4 w-4" />
          New Appointment
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Service Appointment</DialogTitle>
        </DialogHeader>
        <form action={createAppointment} className="grid gap-3 sm:grid-cols-2">
          <Input name="title" placeholder="Title" required className="sm:col-span-2" />
          <Input name="scheduledAt" type="datetime-local" required />
          <select name="status" className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm">
            <option value="SCHEDULED">SCHEDULED</option>
            <option value="CONFIRMED">CONFIRMED</option>
            <option value="CHECKED_IN">CHECKED IN</option>
          </select>
          <select name="customerId" className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm">
            <option value="">No customer</option>
            {customerOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <select name="vehicleId" className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm">
            <option value="">No vehicle</option>
            {vehicleOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <select name="technicianId" className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm sm:col-span-2">
            <option value="">Unassigned technician</option>
            {technicianOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <Input name="concern" placeholder="Customer concern" className="sm:col-span-2" />
          <Textarea name="notes" placeholder="Internal notes" className="sm:col-span-2" />
          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit" disabled={saving}>
              <Wrench className="mr-2 h-4 w-4" />
              {saving ? "Saving..." : "Create Appointment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
