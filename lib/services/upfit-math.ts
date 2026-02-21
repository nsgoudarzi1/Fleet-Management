export type RollupInputJob = {
  billableToCustomer: boolean;
  includeActualCosts: boolean;
  costEstimate: number;
  actualCost: number;
};

export function calculateUpfitRollupAmount(jobs: RollupInputJob[]) {
  const billableAmount = jobs
    .filter((item) => item.billableToCustomer)
    .reduce((sum, item) => sum + Number(item.includeActualCosts ? item.actualCost : item.costEstimate), 0);
  const actualCost = jobs.reduce((sum, item) => sum + Number(item.actualCost), 0);
  return {
    billableAmount,
    actualCost,
  };
}
