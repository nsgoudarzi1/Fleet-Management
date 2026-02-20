import { Prisma } from "@prisma/client";
import { type DealSnapshot } from "@/lib/compliance/evaluate";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/services/guard";

export type DealContext = Prisma.DealGetPayload<{
  include: {
    customer: true;
    vehicle: true;
    tradeIns: true;
    org: true;
    documents: {
      include: {
        template: true;
      };
      orderBy: {
        createdAt: "desc";
      };
    };
    documentEnvelopes: {
      orderBy: {
        createdAt: "desc";
      };
    };
  };
}>;

export async function loadDealContextBase(orgId: string, dealId: string) {
  const deal = await prisma.deal.findFirst({
    where: { id: dealId, orgId },
    include: {
      customer: true,
      vehicle: true,
      tradeIns: true,
      org: true,
      documents: {
        include: {
          template: true,
        },
        orderBy: { createdAt: "desc" },
      },
      documentEnvelopes: {
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!deal) throw new AppError("Deal not found.", 404);
  return deal;
}

export function buildDealSnapshotFromContext(deal: DealContext): DealSnapshot {
  const hasTradeIn = deal.tradeIns.length > 0;
  const isFinanced = Number(deal.financedAmount) > 0 && deal.dealType !== "CASH";
  const jurisdiction = (deal.jurisdiction ?? deal.customer.state ?? "TX").toUpperCase();

  return {
    dealId: deal.id,
    orgId: deal.orgId,
    jurisdiction,
    buyerState: deal.customer.state,
    dealType: deal.dealType,
    hasTradeIn,
    isFinanced,
    hasLienholder: isFinanced,
    salePrice: Number(deal.salePrice),
    financedAmount: Number(deal.financedAmount),
    customer: {
      firstName: deal.customer.firstName,
      lastName: deal.customer.lastName,
      email: deal.customer.email,
      phone: deal.customer.phone,
    },
    vehicle: {
      year: deal.vehicle.year,
      make: deal.vehicle.make,
      model: deal.vehicle.model,
      vin: deal.vehicle.vin,
      mileage: deal.vehicle.mileage,
      stockNumber: deal.vehicle.stockNumber,
    },
    dealer: {
      name: deal.org.name,
      taxRate: Number(deal.org.taxRate),
      docFee: Number(deal.org.docFee),
      licenseFee: Number(deal.org.licenseFee),
    },
  };
}

export function buildTemplateContextFromDeal(deal: DealContext) {
  const trade = deal.tradeIns[0];
  return {
    generatedAt: new Date().toISOString(),
    notLegalAdvice:
      "Not legal advice. This generated form is configuration-driven and must be validated by licensed counsel.",
    dealer: {
      name: deal.org.name,
      taxRate: Number(deal.org.taxRate),
      docFee: Number(deal.org.docFee),
      licenseFee: Number(deal.org.licenseFee),
    },
    deal: {
      dealNumber: deal.dealNumber,
      stage: deal.stage,
      dealType: deal.dealType,
      jurisdiction: deal.jurisdiction ?? deal.customer.state ?? "TX",
      salePrice: Number(deal.salePrice).toFixed(2),
      downPayment: Number(deal.downPayment).toFixed(2),
      taxes: Number(deal.taxes).toFixed(2),
      fees: Number(deal.fees).toFixed(2),
      financedAmount: Number(deal.financedAmount).toFixed(2),
      monthlyPayment: Number(deal.monthlyPayment).toFixed(2),
      apr: Number(deal.apr).toFixed(3),
      termMonths: deal.termMonths,
    },
    customer: {
      firstName: deal.customer.firstName,
      lastName: deal.customer.lastName,
      fullName: `${deal.customer.firstName} ${deal.customer.lastName}`,
      email: deal.customer.email ?? "",
      phone: deal.customer.phone ?? "",
      address1: deal.customer.address1 ?? "",
      city: deal.customer.city ?? "",
      state: deal.customer.state ?? "",
      postalCode: deal.customer.postalCode ?? "",
    },
    vehicle: {
      year: deal.vehicle.year,
      make: deal.vehicle.make,
      model: deal.vehicle.model,
      trim: deal.vehicle.trim ?? "",
      vin: deal.vehicle.vin,
      mileage: deal.vehicle.mileage,
      stockNumber: deal.vehicle.stockNumber,
    },
    tradeIn: trade
      ? {
          hasTrade: true,
          vin: trade.vin ?? "",
          year: trade.year ?? "",
          make: trade.make ?? "",
          model: trade.model ?? "",
          mileage: trade.mileage ?? "",
          allowance: Number(trade.allowance).toFixed(2),
          payoff: Number(trade.payoff).toFixed(2),
        }
      : { hasTrade: false },
    SIGN_BUYER_1: '<span class="signature-anchor" data-anchor="SIGN_BUYER_1">Buyer Signature</span>',
    SIGN_CO_BUYER_1: '<span class="signature-anchor" data-anchor="SIGN_CO_BUYER_1">Co-Buyer Signature</span>',
    SIGN_DEALER_1: '<span class="signature-anchor" data-anchor="SIGN_DEALER_1">Dealer Signature</span>',
    DATE_BUYER_1: new Date().toLocaleDateString("en-US"),
    DATE_DEALER_1: new Date().toLocaleDateString("en-US"),
  };
}

export const CANONICAL_TEMPLATE_VARIABLES = [
  "dealer.name",
  "deal.dealNumber",
  "deal.dealType",
  "deal.jurisdiction",
  "customer.fullName",
  "customer.address1",
  "vehicle.vin",
  "vehicle.year",
  "vehicle.make",
  "vehicle.model",
  "tradeIn.hasTrade",
  "tradeIn.allowance",
  "SIGN_BUYER_1",
  "SIGN_CO_BUYER_1",
  "SIGN_DEALER_1",
  "DATE_BUYER_1",
  "DATE_DEALER_1",
];
