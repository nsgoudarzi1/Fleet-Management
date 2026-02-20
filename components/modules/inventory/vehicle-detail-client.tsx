"use client";

import { useState } from "react";
import { toast } from "sonner";
import { InlineEditField } from "@/components/shared/inline-edit-field";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatDate } from "@/lib/utils";

type VehicleDetail = {
  id: string;
  vin: string;
  stockNumber: string;
  year: number;
  make: string;
  model: string;
  trim: string | null;
  mileage: number;
  status: string;
  listPrice: string | number;
  minPrice: string | number | null;
  location: string | null;
  notes: string | null;
  floorplanSource: string | null;
  acquiredAt: string | Date;
  costAcquisition: string | number;
  costParts: string | number;
  costLabor: string | number;
  costMisc: string | number;
  reconTasks: Array<{
    id: string;
    title: string;
    status: string;
    dueDate: string | Date | null;
    notes: string | null;
    vendor: { name: string } | null;
    lineItems: Array<{
      id: string;
      category: string;
      description: string;
      quantity: string | number;
      unitCost: string | number;
      totalCost: string | number;
    }>;
  }>;
  priceHistory: Array<{
    id: string;
    previous: string | number | null;
    next: string | number;
    note: string | null;
    createdAt: string | Date;
  }>;
  deals: Array<{
    id: string;
    dealNumber: string;
    stage: string;
    createdAt: string | Date;
  }>;
};

export function VehicleDetailClient({ vehicle }: { vehicle: VehicleDetail }) {
  const [creatingTask, setCreatingTask] = useState(false);
  const [addingLineItemFor, setAddingLineItemFor] = useState<string | null>(null);

  const createReconTask = async (formData: FormData) => {
    setCreatingTask(true);
    const payload = {
      vehicleId: vehicle.id,
      title: String(formData.get("title") ?? ""),
      dueDate: formData.get("dueDate") ? new Date(String(formData.get("dueDate"))).toISOString() : undefined,
      notes: String(formData.get("notes") ?? ""),
    };
    const response = await fetch("/api/recon-tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setCreatingTask(false);
    if (!response.ok) {
      toast.error("Unable to create recon task");
      return;
    }
    toast.success("Recon task created");
    window.location.reload();
  };

  const changeTaskStatus = async (reconTaskId: string, status: string) => {
    const response = await fetch("/api/recon-tasks/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reconTaskId, status }),
    });
    if (!response.ok) {
      toast.error("Unable to update task");
      return;
    }
    toast.success("Task updated");
    window.location.reload();
  };

  const addLineItem = async (reconTaskId: string, formData: FormData) => {
    setAddingLineItemFor(reconTaskId);
    const payload = {
      reconTaskId,
      category: String(formData.get("category") ?? "Labor"),
      description: String(formData.get("description") ?? ""),
      quantity: Number(formData.get("quantity") ?? 1),
      unitCost: Number(formData.get("unitCost") ?? 0),
    };
    const response = await fetch("/api/recon-line-items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setAddingLineItemFor(null);
    if (!response.ok) {
      toast.error("Unable to add line item");
      return;
    }
    toast.success("Line item added");
    window.location.reload();
  };

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs text-slate-500">{vehicle.stockNumber} • {vehicle.vin}</p>
            <h1 className="text-2xl font-semibold text-slate-900">
              {vehicle.year} {vehicle.make} {vehicle.model} {vehicle.trim ?? ""}
            </h1>
            <p className="text-sm text-slate-500">Acquired {formatDate(vehicle.acquiredAt)}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={vehicle.status} />
            <Badge variant="outline">{vehicle.location ?? "No location"}</Badge>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <section className="space-y-4">
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="recon">Recon</TabsTrigger>
              <TabsTrigger value="pricing">Pricing</TabsTrigger>
            </TabsList>
            <TabsContent value="overview">
              <Card>
                <CardHeader>
                  <CardTitle>Inline Details</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  <InlineEditField label="Stock #" field="stockNumber" value={vehicle.stockNumber} endpoint={`/api/vehicles/${vehicle.id}`} />
                  <InlineEditField label="VIN" field="vin" value={vehicle.vin} endpoint={`/api/vehicles/${vehicle.id}`} />
                  <InlineEditField label="Mileage" field="mileage" type="number" value={vehicle.mileage} endpoint={`/api/vehicles/${vehicle.id}`} />
                  <InlineEditField label="Location" field="location" value={vehicle.location} endpoint={`/api/vehicles/${vehicle.id}`} />
                  <InlineEditField label="List Price" field="listPrice" type="number" value={vehicle.listPrice} endpoint={`/api/vehicles/${vehicle.id}`} />
                  <InlineEditField label="Min Price" field="minPrice" type="number" value={vehicle.minPrice} endpoint={`/api/vehicles/${vehicle.id}`} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Cost Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2 sm:grid-cols-2">
                  <p className="text-sm text-slate-500">Acquisition</p>
                  <p className="text-sm font-medium text-right">{formatCurrency(vehicle.costAcquisition)}</p>
                  <p className="text-sm text-slate-500">Parts</p>
                  <p className="text-sm font-medium text-right">{formatCurrency(vehicle.costParts)}</p>
                  <p className="text-sm text-slate-500">Labor</p>
                  <p className="text-sm font-medium text-right">{formatCurrency(vehicle.costLabor)}</p>
                  <p className="text-sm text-slate-500">Misc</p>
                  <p className="text-sm font-medium text-right">{formatCurrency(vehicle.costMisc)}</p>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="recon" className="space-y-3">
              <Card>
                <CardHeader>
                  <CardTitle>Add Recon Task</CardTitle>
                </CardHeader>
                <CardContent>
                  <form action={createReconTask} className="grid gap-2 sm:grid-cols-2">
                    <Input name="title" placeholder="Task title" required />
                    <Input name="dueDate" type="datetime-local" />
                    <Textarea name="notes" placeholder="Notes" className="sm:col-span-2" />
                    <div className="sm:col-span-2 flex justify-end">
                      <Button type="submit" disabled={creatingTask}>
                        {creatingTask ? "Saving..." : "Add Task"}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
              {vehicle.reconTasks.map((task) => (
                <Card key={task.id}>
                  <CardHeader className="flex flex-row items-start justify-between gap-2">
                    <div>
                      <CardTitle>{task.title}</CardTitle>
                      <p className="text-xs text-slate-500">
                        {task.vendor?.name ?? "No vendor"} • Due {task.dueDate ? formatDate(task.dueDate, "MMM d, h:mm a") : "N/A"}
                      </p>
                    </div>
                    <select
                      defaultValue={task.status}
                      className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
                      onChange={(event) => void changeTaskStatus(task.id, event.target.value)}
                    >
                      <option value="TODO">TODO</option>
                      <option value="IN_PROGRESS">IN PROGRESS</option>
                      <option value="BLOCKED">BLOCKED</option>
                      <option value="DONE">DONE</option>
                    </select>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {task.lineItems.map((line) => (
                      <div key={line.id} className="rounded border border-slate-200 px-3 py-2 text-sm">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-slate-900">{line.description}</p>
                          <p className="text-slate-900">{formatCurrency(line.totalCost)}</p>
                        </div>
                        <p className="text-xs text-slate-500">
                          {line.category} • {line.quantity} x {formatCurrency(line.unitCost)}
                        </p>
                      </div>
                    ))}
                    <form action={(formData) => addLineItem(task.id, formData)} className="grid gap-2 sm:grid-cols-4">
                      <Input name="category" placeholder="Category" required />
                      <Input name="description" placeholder="Description" required className="sm:col-span-2" />
                      <Input name="quantity" type="number" placeholder="Qty" defaultValue={1} required />
                      <Input name="unitCost" type="number" placeholder="Unit Cost" required />
                      <div className="sm:col-span-4 flex justify-end">
                        <Button type="submit" variant="outline" size="sm" disabled={addingLineItemFor === task.id}>
                          Add Line Item
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
            <TabsContent value="pricing">
              <Card>
                <CardHeader>
                  <CardTitle>Price History</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {vehicle.priceHistory.length === 0 ? <p className="text-sm text-slate-500">No price changes yet.</p> : null}
                  {vehicle.priceHistory.map((price) => (
                    <div key={price.id} className="rounded border border-slate-200 p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-slate-900">
                          {price.previous ? formatCurrency(price.previous) : "N/A"} → {formatCurrency(price.next)}
                        </p>
                        <p className="text-xs text-slate-500">{formatDate(price.createdAt, "MMM d, h:mm a")}</p>
                      </div>
                      <p className="text-xs text-slate-500">{price.note ?? "No note"}</p>
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
            <CardContent className="space-y-2 text-sm">
              <div className="rounded border border-slate-200 p-3">
                <p className="font-medium text-slate-900">Vehicle created</p>
                <p className="text-xs text-slate-500">{formatDate(vehicle.acquiredAt, "MMM d, h:mm a")}</p>
              </div>
              {vehicle.reconTasks.map((task) => (
                <div key={`timeline-${task.id}`} className="rounded border border-slate-200 p-3">
                  <p className="font-medium text-slate-900">Recon: {task.title}</p>
                  <p className="text-xs text-slate-500">Status {task.status.replaceAll("_", " ")}</p>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Related Deals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {vehicle.deals.length === 0 ? <p className="text-sm text-slate-500">No deals linked.</p> : null}
              {vehicle.deals.map((deal) => (
                <div key={deal.id} className="rounded border border-slate-200 p-3">
                  <p className="text-sm font-medium text-slate-900">{deal.dealNumber}</p>
                  <p className="text-xs text-slate-500">{deal.stage}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
