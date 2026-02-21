export type QuoteCalcLine = {
  quantity: number;
  unitPrice: number;
  taxable: boolean;
  unitCost: number;
};

export function calculateQuoteTotals(lines: QuoteCalcLine[], taxRate: number) {
  const normalizedTaxRate = Number.isFinite(taxRate) ? Math.max(0, taxRate) : 0;
  return lines.reduce(
    (acc, line) => {
      const quantity = Math.max(0, line.quantity);
      const unitPrice = Math.max(0, line.unitPrice);
      const unitCost = Math.max(0, line.unitCost);
      const lineSubtotal = quantity * unitPrice;
      const lineTax = line.taxable ? lineSubtotal * normalizedTaxRate : 0;
      const lineTotal = lineSubtotal + lineTax;
      const lineCost = quantity * unitCost;
      const lineGross = lineSubtotal - lineCost;
      return {
        subtotal: acc.subtotal + lineSubtotal,
        taxableTotal: acc.taxableTotal + (line.taxable ? lineSubtotal : 0),
        taxTotal: acc.taxTotal + lineTax,
        total: acc.total + lineTotal,
        costTotal: acc.costTotal + lineCost,
        grossTotal: acc.grossTotal + lineGross,
      };
    },
    {
      subtotal: 0,
      taxableTotal: 0,
      taxTotal: 0,
      total: 0,
      costTotal: 0,
      grossTotal: 0,
    },
  );
}
