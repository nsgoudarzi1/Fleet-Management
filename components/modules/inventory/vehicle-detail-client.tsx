"use client";

import { useState } from "react";
import { toast } from "sonner";
import { EntityDrawer } from "@/components/shared/entity-drawer";
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
  specs: Array<{
    id: string;
    version: string;
    dealId: string | null;
    gvwr: number | null;
    gawrFront: number | null;
    gawrRear: number | null;
    axleConfig: string | null;
    wheelbaseIn: string | number | null;
    bodyType: string | null;
    boxLengthIn: string | number | null;
    cabType: string | null;
    engine: string | null;
    transmission: string | null;
    fuelType: string | null;
    ptoCapable: boolean;
    hitchRating: string | null;
    notes: string | null;
    source: string;
    createdAt: string | Date;
  }>;
  attachments: Array<{
    id: string;
    filename: string;
    contentType: string;
    size: number;
    tags: string[];
    url: string | null;
    createdAt: string | Date;
  }>;
  upfitJobs: Array<{
    id: string;
    status: string;
    vendor: { name: string } | null;
    costEstimate: string | number;
    actualCost: string | number;
    milestones: Array<{
      id: string;
      name: string;
      completedAt: string | Date | null;
    }>;
  }>;
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
  const [savingSpec, setSavingSpec] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [attachmentQuery, setAttachmentQuery] = useState("");

  const listedSpec = vehicle.specs.find((item) => item.version === "AS_LISTED" && !item.dealId) ?? vehicle.specs[0] ?? null;

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

  const updateSpec = async (formData: FormData) => {
    setSavingSpec(true);
    const payload = {
      gvwr: formData.get("gvwr"),
      gawrFront: formData.get("gawrFront"),
      gawrRear: formData.get("gawrRear"),
      axleConfig: formData.get("axleConfig"),
      wheelbaseIn: formData.get("wheelbaseIn"),
      bodyType: formData.get("bodyType"),
      boxLengthIn: formData.get("boxLengthIn"),
      cabType: formData.get("cabType"),
      engine: formData.get("engine"),
      transmission: formData.get("transmission"),
      fuelType: formData.get("fuelType"),
      ptoCapable: formData.get("ptoCapable") === "on",
      hitchRating: formData.get("hitchRating"),
      notes: formData.get("notes"),
    };
    const response = await fetch(`/api/vehicles/${vehicle.id}/spec`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSavingSpec(false);
    if (!response.ok) {
      toast.error("Unable to save vehicle specs");
      return;
    }
    toast.success("Vehicle specs saved");
    window.location.reload();
  };

  const uploadAttachment = async (formData: FormData) => {
    const file = formData.get("file");
    if (!(file instanceof File)) {
      toast.error("Choose a file to upload");
      return;
    }
    setUploadingAttachment(true);
    const dataBase64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("file-read-failed"));
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.readAsDataURL(file);
    }).catch(() => "");

    if (!dataBase64) {
      setUploadingAttachment(false);
      toast.error("Unable to read file");
      return;
    }

    const tagsRaw = String(formData.get("tags") ?? "");
    const response = await fetch(`/api/vehicles/${vehicle.id}/attachments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        size: file.size,
        dataBase64,
        tags: tagsRaw
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      }),
    });
    setUploadingAttachment(false);
    if (!response.ok) {
      toast.error("Unable to upload attachment");
      return;
    }
    toast.success("Attachment uploaded");
    window.location.reload();
  };

  const removeAttachment = async (attachmentId: string) => {
    const response = await fetch(`/api/vehicles/${vehicle.id}/attachments`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attachmentId }),
    });
    if (!response.ok) {
      toast.error("Unable to delete attachment");
      return;
    }
    toast.success("Attachment deleted");
    window.location.reload();
  };

  const visibleAttachments = vehicle.attachments.filter((item) => {
    const q = attachmentQuery.trim().toLowerCase();
    if (!q) return true;
    return item.filename.toLowerCase().includes(q) || item.tags.some((tag) => tag.toLowerCase().includes(q));
  });

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
              <TabsTrigger value="specs">Specs</TabsTrigger>
              <TabsTrigger value="attachments">Attachments</TabsTrigger>
              <TabsTrigger value="recon">Recon</TabsTrigger>
              <TabsTrigger value="upfits">Upfits</TabsTrigger>
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
            <TabsContent value="specs" className="space-y-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Commercial Unit Specs</CardTitle>
                  <Button asChild size="sm" variant="outline">
                    <a href={`/api/vehicles/${vehicle.id}/spec-sheet?version=AS_LISTED`} target="_blank" rel="noreferrer">
                      Generate Spec Sheet
                    </a>
                  </Button>
                </CardHeader>
                <CardContent>
                  <form action={updateSpec} className="grid gap-2 sm:grid-cols-2">
                    <Input name="gvwr" placeholder="GVWR" defaultValue={listedSpec?.gvwr ?? ""} />
                    <Input name="gawrFront" placeholder="GAWR Front" defaultValue={listedSpec?.gawrFront ?? ""} />
                    <Input name="gawrRear" placeholder="GAWR Rear" defaultValue={listedSpec?.gawrRear ?? ""} />
                    <Input name="axleConfig" placeholder="Axle Config" defaultValue={listedSpec?.axleConfig ?? ""} />
                    <Input name="wheelbaseIn" placeholder="Wheelbase (in)" defaultValue={listedSpec?.wheelbaseIn ?? ""} />
                    <Input name="bodyType" placeholder="Body Type" defaultValue={listedSpec?.bodyType ?? ""} />
                    <Input name="boxLengthIn" placeholder="Box Length (in)" defaultValue={listedSpec?.boxLengthIn ?? ""} />
                    <Input name="cabType" placeholder="Cab Type" defaultValue={listedSpec?.cabType ?? ""} />
                    <Input name="engine" placeholder="Engine" defaultValue={listedSpec?.engine ?? ""} />
                    <Input name="transmission" placeholder="Transmission" defaultValue={listedSpec?.transmission ?? ""} />
                    <Input name="fuelType" placeholder="Fuel Type" defaultValue={listedSpec?.fuelType ?? ""} />
                    <Input name="hitchRating" placeholder="Hitch Rating" defaultValue={listedSpec?.hitchRating ?? ""} />
                    <label className="sm:col-span-2 flex items-center gap-2 text-sm text-slate-600">
                      <input type="checkbox" name="ptoCapable" defaultChecked={listedSpec?.ptoCapable ?? false} />
                      PTO Capable
                    </label>
                    <Textarea name="notes" placeholder="Spec notes" className="sm:col-span-2" defaultValue={listedSpec?.notes ?? ""} />
                    <div className="sm:col-span-2 flex justify-end">
                      <Button type="submit" disabled={savingSpec}>
                        {savingSpec ? "Saving..." : "Save Specs"}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="attachments" className="space-y-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2">
                  <CardTitle>Attachments</CardTitle>
                  <EntityDrawer
                    title="Upload Attachment"
                    description="Upload files used for inventory marketing and sales handoff."
                    trigger={<Button size="sm">Upload</Button>}
                  >
                    <form action={uploadAttachment} className="space-y-3">
                      <Input name="file" type="file" required />
                      <Input name="tags" placeholder="Tags (comma separated)" />
                      <Button type="submit" className="w-full" disabled={uploadingAttachment}>
                        {uploadingAttachment ? "Uploading..." : "Upload File"}
                      </Button>
                    </form>
                  </EntityDrawer>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Input
                    value={attachmentQuery}
                    onChange={(event) => setAttachmentQuery(event.target.value)}
                    placeholder="Search by filename or tag"
                  />
                  {visibleAttachments.length === 0 ? <p className="text-sm text-slate-500">No attachments found.</p> : null}
                  {visibleAttachments.map((item) => (
                    <div key={item.id} className="rounded border border-slate-200 p-3 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-slate-900">{item.filename}</p>
                          <p className="text-xs text-slate-500">{Math.round(item.size / 1024)} KB</p>
                          <p className="text-xs text-slate-500">
                            {item.tags.length ? item.tags.join(", ") : "No tags"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {item.url ? (
                            <Button asChild variant="outline" size="sm">
                              <a href={item.url} target="_blank" rel="noreferrer">Open</a>
                            </Button>
                          ) : null}
                          <Button variant="ghost" size="sm" onClick={() => void removeAttachment(item.id)}>
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
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
            <TabsContent value="upfits">
              <Card>
                <CardHeader>
                  <CardTitle>Linked Upfit Jobs</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {vehicle.upfitJobs.length === 0 ? <p className="text-sm text-slate-500">No upfit jobs linked.</p> : null}
                  {vehicle.upfitJobs.map((job) => (
                    <div key={job.id} className="rounded border border-slate-200 p-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-slate-900">{job.vendor?.name ?? "Unassigned Vendor"}</p>
                        <StatusBadge status={job.status} />
                      </div>
                      <p className="text-xs text-slate-500">
                        Estimate {formatCurrency(job.costEstimate)} â€¢ Actual {formatCurrency(job.actualCost)}
                      </p>
                      <p className="text-xs text-slate-500">
                        Milestones {job.milestones.filter((item) => !!item.completedAt).length}/{job.milestones.length}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
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
