"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { calcMonthlyPayment, formatCurrency } from "@/lib/utils";

type Option = {
  id: string;
  label: string;
};

type NewDealFormProps = {
  vehicles: Option[];
  customers: Option[];
  salespeople: Option[];
  defaultVehicleId?: string;
  defaultCustomerId?: string;
};

export function NewDealForm({
  vehicles,
  customers,
  salespeople,
  defaultVehicleId,
  defaultCustomerId,
}: NewDealFormProps) {
  const [creating, setCreating] = useState(false);
  const [salePrice, setSalePrice] = useState(0);
  const [downPayment, setDownPayment] = useState(0);
  const [taxes, setTaxes] = useState(0);
  const [fees, setFees] = useState(0);
  const [tradeAllowance, setTradeAllowance] = useState(0);
  const [payoff, setPayoff] = useState(0);
  const [apr, setApr] = useState(6.99);
  const [termMonths, setTermMonths] = useState(72);

  const financedAmount = useMemo(
    () => salePrice + taxes + fees - downPayment - tradeAllowance + payoff,
    [salePrice, taxes, fees, downPayment, tradeAllowance, payoff],
  );
  const monthlyPayment = useMemo(
    () => calcMonthlyPayment({ principal: financedAmount, apr, months: termMonths }),
    [financedAmount, apr, termMonths],
  );

  const createDeal = async (formData: FormData) => {
    setCreating(true);
    const payload = {
      vehicleId: String(formData.get("vehicleId") ?? ""),
      customerId: String(formData.get("customerId") ?? ""),
      salespersonId: String(formData.get("salespersonId") ?? ""),
      dealType: String(formData.get("dealType") ?? "FINANCE"),
      jurisdiction: String(formData.get("jurisdiction") ?? "TX"),
      salePrice,
      downPayment,
      apr,
      termMonths,
      taxes,
      fees,
      tradeAllowance,
      payoff,
      notes: String(formData.get("notes") ?? ""),
    };
    const response = await fetch("/api/deals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setCreating(false);
    if (!response.ok) {
      toast.error("Unable to create deal");
      return;
    }
    const json = (await response.json()) as { data: { id: string } };
    toast.success("Deal created");
    window.location.href = `/deals/${json.data.id}`;
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
      <Card>
        <CardHeader>
          <CardTitle>Create Deal</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createDeal} className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span>Vehicle</span>
              <select
                name="vehicleId"
                required
                defaultValue={defaultVehicleId ?? ""}
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              >
                <option value="">Select vehicle...</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span>Customer</span>
              <select
                name="customerId"
                required
                defaultValue={defaultCustomerId ?? ""}
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              >
                <option value="">Select customer...</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span>Salesperson</span>
              <select name="salespersonId" className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
                <option value="">Auto-assign me</option>
                {salespeople.map((salesperson) => (
                  <option key={salesperson.id} value={salesperson.id}>
                    {salesperson.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span>Deal Type</span>
              <select name="dealType" className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" defaultValue="FINANCE">
                <option value="CASH">CASH</option>
                <option value="FINANCE">FINANCE</option>
                <option value="LEASE">LEASE</option>
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span>Jurisdiction</span>
              <Input name="jurisdiction" defaultValue="TX" placeholder="State code (e.g., TX)" maxLength={2} />
            </label>
            <div />
            <InputField label="Sale Price" value={salePrice} onChange={setSalePrice} />
            <InputField label="Down Payment" value={downPayment} onChange={setDownPayment} />
            <InputField label="Taxes" value={taxes} onChange={setTaxes} />
            <InputField label="Fees" value={fees} onChange={setFees} />
            <InputField label="Trade Allowance" value={tradeAllowance} onChange={setTradeAllowance} />
            <InputField label="Payoff" value={payoff} onChange={setPayoff} />
            <InputField label="APR (%)" value={apr} onChange={setApr} />
            <InputField label="Term (months)" value={termMonths} onChange={setTermMonths} step={1} />
            <label className="space-y-1 text-sm sm:col-span-2">
              <span>Notes</span>
              <textarea
                name="notes"
                className="min-h-20 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                placeholder="Desking notes"
              />
            </label>
            <div className="sm:col-span-2 flex justify-end">
              <Button type="submit" disabled={creating}>
                {creating ? "Creating..." : "Create Deal"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Payment Preview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Financed Amount</span>
            <span className="font-semibold">{formatCurrency(financedAmount)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Estimated Monthly</span>
            <span className="font-semibold">{formatCurrency(monthlyPayment)}</span>
          </div>
          <p className="text-xs text-slate-500">
            Calculator uses simple amortization for desking-lite workflow.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  step = 0.01,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
}) {
  return (
    <label className="space-y-1 text-sm">
      <span>{label}</span>
      <Input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
