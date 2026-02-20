import {
  PrismaClient,
  Role,
  VehicleStatus,
  LeadStage,
  DealStage,
  DealType,
  PaymentMethod,
  FundingStatus,
  ReconTaskStatus,
  ActivityType,
  AuditAction,
  AppointmentStatus,
  DocumentType,
  DocumentTemplateEngine,
  DocumentOutputFormat,
  ServiceAppointmentStatus,
  RepairOrderStatus,
  RepairOrderLineType,
  RepairOrderLineDecision,
  PartTransactionType,
  AccountType,
  JournalSourceType,
  AccountingPeriodStatus,
  ApiKeyScope,
  FundingCaseStatus,
  PermissionScope,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "demo1234";
const toJson = <T>(value: T) => JSON.parse(JSON.stringify(value));

const BUYERS_ORDER_TEMPLATE = `
<h1>Buyer's Order</h1>
<div class="section">
  <div class="field-row"><span class="field-label">Dealer</span><span class="field-value">{{dealer.name}}</span></div>
  <div class="field-row"><span class="field-label">Deal Number</span><span class="field-value">{{deal.dealNumber}}</span></div>
  <div class="field-row"><span class="field-label">Jurisdiction</span><span class="field-value">{{deal.jurisdiction}}</span></div>
  <div class="field-row"><span class="field-label">Deal Type</span><span class="field-value">{{deal.dealType}}</span></div>
</div>
<div class="section">
  <h3>Buyer</h3>
  <div class="field-row"><span class="field-label">Name</span><span class="field-value">{{customer.fullName}}</span></div>
  <div class="field-row"><span class="field-label">Address</span><span class="field-value">{{customer.address1}}, {{customer.city}} {{customer.state}} {{customer.postalCode}}</span></div>
</div>
<div class="section">
  <h3>Vehicle</h3>
  <div class="field-row"><span class="field-label">Unit</span><span class="field-value">{{vehicle.year}} {{vehicle.make}} {{vehicle.model}}</span></div>
  <div class="field-row"><span class="field-label">VIN</span><span class="field-value">{{vehicle.vin}}</span></div>
  <div class="field-row"><span class="field-label">Stock #</span><span class="field-value">{{vehicle.stockNumber}}</span></div>
</div>
<div class="section">
  <h3>Pricing</h3>
  <div class="field-row"><span class="field-label">Sale Price</span><span class="field-value">$ {{deal.salePrice}}</span></div>
  <div class="field-row"><span class="field-label">Taxes</span><span class="field-value">$ {{deal.taxes}}</span></div>
  <div class="field-row"><span class="field-label">Fees</span><span class="field-value">$ {{deal.fees}}</span></div>
  <div class="field-row"><span class="field-label">Financed Amount</span><span class="field-value">$ {{deal.financedAmount}}</span></div>
</div>
<div class="section">
  <div>{{{SIGN_BUYER_1}}}</div>
  <div>{{{SIGN_DEALER_1}}}</div>
</div>
<div class="notice">{{notLegalAdvice}}</div>
`;

const ODOMETER_TEMPLATE = `
<h1>Odometer Disclosure Statement</h1>
<div class="section">
  <div class="field-row"><span class="field-label">Vehicle VIN</span><span class="field-value">{{vehicle.vin}}</span></div>
  <div class="field-row"><span class="field-label">Year/Make/Model</span><span class="field-value">{{vehicle.year}} {{vehicle.make}} {{vehicle.model}}</span></div>
  <div class="field-row"><span class="field-label">Current Mileage</span><span class="field-value">{{vehicle.mileage}}</span></div>
</div>
<div class="section">
  <p>I certify the odometer reading is accurate to the best of my knowledge, unless otherwise indicated by law.</p>
  <div>{{{SIGN_BUYER_1}}}</div>
  <div>{{{SIGN_DEALER_1}}}</div>
</div>
<div class="notice">{{notLegalAdvice}}</div>
`;

const WE_OWE_TEMPLATE = `
<h1>We Owe / Due Bill</h1>
<div class="section">
  <div class="field-row"><span class="field-label">Deal Number</span><span class="field-value">{{deal.dealNumber}}</span></div>
  <div class="field-row"><span class="field-label">Customer</span><span class="field-value">{{customer.fullName}}</span></div>
  <div class="field-row"><span class="field-label">Vehicle</span><span class="field-value">{{vehicle.year}} {{vehicle.make}} {{vehicle.model}}</span></div>
</div>
<div class="section">
  <p>Dealer agrees to complete and deliver owed items listed below:</p>
  <ul>
    <li>Second key fob</li>
    <li>Final detail and fuel fill</li>
    <li>Accessory installation by appointment</li>
  </ul>
</div>
<div class="section">
  <div>{{{SIGN_BUYER_1}}}</div>
  <div>{{{SIGN_DEALER_1}}}</div>
</div>
<div class="notice">{{notLegalAdvice}}</div>
`;

const RIC_TEMPLATE = `
<h1>Retail Installment Contract (Illustrative)</h1>
<div class="section">
  <div class="field-row"><span class="field-label">Deal Number</span><span class="field-value">{{deal.dealNumber}}</span></div>
  <div class="field-row"><span class="field-label">Buyer</span><span class="field-value">{{customer.fullName}}</span></div>
  <div class="field-row"><span class="field-label">Amount Financed</span><span class="field-value">$ {{deal.financedAmount}}</span></div>
  <div class="field-row"><span class="field-label">APR / Term</span><span class="field-value">{{deal.apr}}% / {{deal.termMonths}} months</span></div>
</div>
<div class="section">
  <div>{{{SIGN_BUYER_1}}}</div>
  <div>{{{SIGN_CO_BUYER_1}}}</div>
  <div>{{{SIGN_DEALER_1}}}</div>
</div>
<div class="notice">{{notLegalAdvice}}</div>
`;

const TITLE_REG_TEMPLATE = `
<h1>Title & Registration Worksheet</h1>
<div class="section">
  <div class="field-row"><span class="field-label">Jurisdiction</span><span class="field-value">{{deal.jurisdiction}}</span></div>
  <div class="field-row"><span class="field-label">Buyer</span><span class="field-value">{{customer.fullName}}</span></div>
  <div class="field-row"><span class="field-label">Vehicle VIN</span><span class="field-value">{{vehicle.vin}}</span></div>
  <div class="field-row"><span class="field-label">Lienholder Present</span><span class="field-value">{{deal.dealType}}</span></div>
</div>
<div class="section">
  <div>{{{SIGN_BUYER_1}}}</div>
  <div>{{{SIGN_DEALER_1}}}</div>
</div>
<div class="notice">{{notLegalAdvice}}</div>
`;

const PRIVACY_NOTICE_TEMPLATE = `
<h1>Privacy Notice</h1>
<div class="section">
  <p>This notice describes how customer information may be collected and shared in relation to this transaction.</p>
  <div class="field-row"><span class="field-label">Customer</span><span class="field-value">{{customer.fullName}}</span></div>
  <div class="field-row"><span class="field-label">Deal Number</span><span class="field-value">{{deal.dealNumber}}</span></div>
</div>
<div class="section">
  <div>{{{SIGN_BUYER_1}}}</div>
</div>
<div class="notice">{{notLegalAdvice}}</div>
`;

async function createUser(email: string, name: string, role: Role, orgId: string, isDefault = false) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      passwordHash,
    },
    create: {
      email,
      name,
      passwordHash,
    },
  });

  await prisma.membership.upsert({
    where: {
      userId_orgId: {
        userId: user.id,
        orgId,
      },
    },
    update: {
      role,
      isDefault,
    },
    create: {
      userId: user.id,
      orgId,
      role,
      isDefault,
    },
  });

  return user;
}

async function main() {
  const org = await prisma.organization.upsert({
    where: { slug: "summit-auto" },
    update: {
      name: "Summit Auto Group",
      taxRate: 0.075,
      docFee: 499,
      licenseFee: 199,
      leadSlaMinutes: 15,
      taskOverdueGraceMinutes: 0,
    },
    create: {
      name: "Summit Auto Group",
      slug: "summit-auto",
      taxRate: 0.075,
      docFee: 499,
      licenseFee: 199,
      leadSlaMinutes: 15,
      taskOverdueGraceMinutes: 0,
    },
  });

  await prisma.auditEvent.deleteMany({ where: { orgId: org.id } });
  await prisma.webhookDelivery.deleteMany({ where: { orgId: org.id } });
  await prisma.webhookEvent.deleteMany({ where: { orgId: org.id } });
  await prisma.webhookEndpoint.deleteMany({ where: { orgId: org.id } });
  await prisma.apiKey.deleteMany({ where: { orgId: org.id } });
  await prisma.communicationAttempt.deleteMany({ where: { orgId: org.id } });
  await prisma.crmTask.deleteMany({ where: { orgId: org.id } });
  await prisma.messageTemplate.deleteMany({ where: { orgId: org.id } });
  await prisma.importJobRow.deleteMany({ where: { orgId: org.id } });
  await prisma.importJob.deleteMany({ where: { orgId: org.id } });
  await prisma.membership.updateMany({
    where: { orgId: org.id },
    data: { customRoleId: null },
  });
  await prisma.rolePermission.deleteMany({ where: { orgId: org.id } });
  await prisma.orgRole.deleteMany({ where: { orgId: org.id } });
  await prisma.fundingStip.deleteMany({ where: { orgId: org.id } });
  await prisma.fundingCase.deleteMany({ where: { orgId: org.id } });
  await prisma.vendorPayment.deleteMany({ where: { orgId: org.id } });
  await prisma.billLine.deleteMany({ where: { orgId: org.id } });
  await prisma.bill.deleteMany({ where: { orgId: org.id } });
  await prisma.vendor.deleteMany({ where: { orgId: org.id } });
  await prisma.journalLine.deleteMany({ where: { orgId: org.id } });
  await prisma.journalEntry.deleteMany({ where: { orgId: org.id } });
  await prisma.postingAccountMap.deleteMany({ where: { orgId: org.id } });
  await prisma.chartOfAccount.deleteMany({ where: { orgId: org.id } });
  await prisma.accountingPeriod.deleteMany({ where: { orgId: org.id } });
  await prisma.partTransaction.deleteMany({ where: { orgId: org.id } });
  await prisma.timePunch.deleteMany({ where: { orgId: org.id } });
  await prisma.repairOrderLine.deleteMany({ where: { orgId: org.id } });
  await prisma.repairOrder.deleteMany({ where: { orgId: org.id } });
  await prisma.serviceAppointment.deleteMany({ where: { orgId: org.id } });
  await prisma.part.deleteMany({ where: { orgId: org.id } });
  await prisma.partVendor.deleteMany({ where: { orgId: org.id } });
  await prisma.technician.deleteMany({ where: { orgId: org.id } });
  await prisma.documentEvent.deleteMany({ where: { orgId: org.id } });
  await prisma.dealDocument.deleteMany({ where: { orgId: org.id } });
  await prisma.documentEnvelope.deleteMany({ where: { orgId: org.id } });
  await prisma.documentFieldMap.deleteMany({ where: { orgId: org.id } });
  await prisma.documentTemplate.deleteMany({ where: { OR: [{ orgId: org.id }, { orgId: null }] } });
  await prisma.complianceRuleSet.deleteMany({ where: { OR: [{ orgId: org.id }, { orgId: null }] } });
  await prisma.fundingEvent.deleteMany({ where: { orgId: org.id } });
  await prisma.payment.deleteMany({ where: { orgId: org.id } });
  await prisma.dealLineItem.deleteMany({ where: { orgId: org.id } });
  await prisma.tradeIn.deleteMany({ where: { orgId: org.id } });
  await prisma.activityLog.deleteMany({ where: { orgId: org.id } });
  await prisma.appointment.deleteMany({ where: { orgId: org.id } });
  await prisma.lead.deleteMany({ where: { orgId: org.id } });
  await prisma.deal.deleteMany({ where: { orgId: org.id } });
  await prisma.customer.deleteMany({ where: { orgId: org.id } });
  await prisma.reconLineItem.deleteMany({ where: { orgId: org.id } });
  await prisma.reconTask.deleteMany({ where: { orgId: org.id } });
  await prisma.reconVendor.deleteMany({ where: { orgId: org.id } });
  await prisma.vehiclePhoto.deleteMany({ where: { orgId: org.id } });
  await prisma.vehiclePriceHistory.deleteMany({ where: { orgId: org.id } });
  await prisma.vehicle.deleteMany({ where: { orgId: org.id } });
  await prisma.savedView.deleteMany({ where: { orgId: org.id } });

  const owner = await createUser("owner@summitauto.dev", "Olivia Owner", Role.OWNER, org.id, true);
  const sales = await createUser("sales@summitauto.dev", "Sam Sales", Role.SALES, org.id);
  const service = await createUser("service@summitauto.dev", "Riley Service", Role.SERVICE, org.id);
  const accounting = await createUser("accounting@summitauto.dev", "Alex Accounting", Role.ACCOUNTING, org.id);
  const manager = await createUser("manager@summitauto.dev", "Morgan Manager", Role.MANAGER, org.id);

  const salesCoordinatorRole = await prisma.orgRole.create({
    data: {
      orgId: org.id,
      name: "Sales Coordinator",
      description: "Can read/write CRM and deals but cannot close repair orders.",
      createdById: owner.id,
      permissions: {
        createMany: {
          data: [
            { orgId: org.id, scope: PermissionScope.CRM_READ },
            { orgId: org.id, scope: PermissionScope.CRM_WRITE },
            { orgId: org.id, scope: PermissionScope.DEALS_READ },
            { orgId: org.id, scope: PermissionScope.DEALS_WRITE },
          ],
        },
      },
    },
  });

  await prisma.membership.updateMany({
    where: { userId: sales.id, orgId: org.id },
    data: { customRoleId: salesCoordinatorRole.id },
  });

  const [techA, techB] = await prisma.$transaction([
    prisma.technician.create({
      data: {
        orgId: org.id,
        userId: service.id,
        displayName: "Riley Service",
        code: "TECH-01",
        hourlyCost: 38,
        flatRateFactor: 1.1,
      },
    }),
    prisma.technician.create({
      data: {
        orgId: org.id,
        displayName: "Taylor Tech",
        code: "TECH-02",
        hourlyCost: 34,
        flatRateFactor: 1.0,
      },
    }),
  ]);

  const complianceSeeds = [
    {
      jurisdiction: "TX",
      version: 1,
      rulesJson: {
        metadata: {
          title: "TX baseline illustrative rules",
          notLegalAdvice: true,
        },
        scenarios: [
          {
            when: { dealType: [DealType.FINANCE] },
            requiredDocuments: [
              DocumentType.BUYERS_ORDER,
              DocumentType.RETAIL_INSTALLMENT_CONTRACT,
              DocumentType.ODOMETER_DISCLOSURE,
              DocumentType.PRIVACY_NOTICE,
            ],
            notes: "Finance baseline docs",
          },
          {
            when: { hasTradeIn: true },
            requiredDocuments: [DocumentType.TITLE_REG_APPLICATION, DocumentType.WE_OWE],
            notes: "Trade-in workflow",
          },
        ],
        validations: [
          {
            code: "TX_FINANCE_LIEN_REQUIRED",
            message: "Finance deals should include lienholder details before title submission.",
            severity: "error",
            when: { isFinanced: true, hasLienholder: false },
          },
        ],
        computedFields: {
          suggestedTaxRate: 0.0625,
        },
      },
    },
    {
      jurisdiction: "CA",
      version: 1,
      rulesJson: {
        metadata: {
          title: "CA baseline illustrative rules",
          notLegalAdvice: true,
        },
        scenarios: [
          {
            when: { dealType: [DealType.CASH, DealType.FINANCE, DealType.LEASE] },
            requiredDocuments: [
              DocumentType.BUYERS_ORDER,
              DocumentType.ODOMETER_DISCLOSURE,
              DocumentType.PRIVACY_NOTICE,
            ],
            notes: "Core California disclosures",
          },
          {
            when: { dealType: [DealType.FINANCE] },
            requiredDocuments: [DocumentType.RETAIL_INSTALLMENT_CONTRACT],
            notes: "Finance contract",
          },
        ],
        validations: [
          {
            code: "CA_OUT_OF_STATE_WARNING",
            message: "Out-of-state buyer may require additional state-specific disclosures.",
            severity: "warning",
            when: { isOutOfStateBuyer: true },
          },
        ],
        computedFields: {
          suggestedTaxRate: 0.0725,
        },
      },
    },
    {
      jurisdiction: "FL",
      version: 1,
      rulesJson: {
        metadata: {
          title: "FL baseline illustrative rules",
          notLegalAdvice: true,
        },
        scenarios: [
          {
            when: { dealType: [DealType.CASH, DealType.FINANCE] },
            requiredDocuments: [
              DocumentType.BUYERS_ORDER,
              DocumentType.ODOMETER_DISCLOSURE,
              DocumentType.PRIVACY_NOTICE,
            ],
            notes: "Florida retail core",
          },
          {
            when: { dealType: [DealType.FINANCE] },
            requiredDocuments: [DocumentType.RETAIL_INSTALLMENT_CONTRACT, DocumentType.TITLE_REG_APPLICATION],
            notes: "Finance + title package",
          },
        ],
        validations: [
          {
            code: "FL_TITLE_REQUIRES_LIEN",
            message: "Financed deals should include lienholder details for title/reg workflows.",
            severity: "error",
            when: { isFinanced: true, hasLienholder: false },
          },
        ],
        computedFields: {
          suggestedTaxRate: 0.06,
        },
      },
    },
  ];

  await prisma.complianceRuleSet.createMany({
    data: complianceSeeds.map((seed) => ({
      orgId: null,
      jurisdiction: seed.jurisdiction,
      version: seed.version,
      effectiveFrom: new Date("2025-01-01T00:00:00.000Z"),
      rulesJson: seed.rulesJson,
      metadataJson: {
        source: "Illustrative starter set",
      },
      notLegalAdviceNotice: "Not legal advice. This starter configuration is illustrative only.",
    })),
  });

  const templateSeeds = [
    { docType: DocumentType.BUYERS_ORDER, sourceHtml: BUYERS_ORDER_TEMPLATE },
    { docType: DocumentType.ODOMETER_DISCLOSURE, sourceHtml: ODOMETER_TEMPLATE },
    { docType: DocumentType.RETAIL_INSTALLMENT_CONTRACT, sourceHtml: RIC_TEMPLATE },
    { docType: DocumentType.TITLE_REG_APPLICATION, sourceHtml: TITLE_REG_TEMPLATE },
    { docType: DocumentType.WE_OWE, sourceHtml: WE_OWE_TEMPLATE },
    { docType: DocumentType.PRIVACY_NOTICE, sourceHtml: PRIVACY_NOTICE_TEMPLATE },
  ];

  for (const stateCode of ["TX", "CA", "FL"]) {
    for (const templateSeed of templateSeeds) {
      const sourceHash = createHash("sha256").update(templateSeed.sourceHtml).digest("hex");
      await prisma.documentTemplate.create({
        data: {
          orgId: org.id,
          name: `${stateCode} ${templateSeed.docType.replaceAll("_", " ")}`,
          docType: templateSeed.docType,
          jurisdiction: stateCode,
          dealType: DealType.FINANCE,
          version: 1,
          effectiveFrom: new Date("2025-01-01T00:00:00.000Z"),
          isDefault: true,
          defaultForOrg: true,
          templateEngine: DocumentTemplateEngine.HTML,
          sourceHtml: templateSeed.sourceHtml,
          sourceHash,
          requiredFieldsJson: {
            requiredPaths: ["customer.fullName", "vehicle.vin", "deal.dealNumber"],
          },
          outputFormat: DocumentOutputFormat.PDF,
          metadataJson: {
            importedBy: "seed",
            sourceType: "original-template",
          },
          notLegalAdviceNotice: "Not legal advice. Validate legal sufficiency with counsel.",
        },
      });
    }
  }

  const reconVendor = await prisma.reconVendor.create({
    data: {
      orgId: org.id,
      name: "FastLane Recon",
      phone: "555-0118",
      email: "ops@fastlanerecon.dev",
    },
  });

  const vehicle1 = await prisma.vehicle.create({
    data: {
      orgId: org.id,
      vin: "1FTFW1ET9EFA00001",
      stockNumber: "STK-1001",
      year: 2021,
      make: "Ford",
      model: "F-150",
      trim: "XLT",
      mileage: 48200,
      status: VehicleStatus.RECON,
      purchaseSource: "Auction",
      listPrice: 34995,
      minPrice: 32995,
      floorplanSource: "Ally Floorplan",
      floorplanBalance: 24000,
      costAcquisition: 26800,
      costParts: 320,
      costLabor: 780,
      costMisc: 120,
      location: "Recon Bay 2",
      notes: "Needs front bumper repaint",
      photos: {
        create: [
          {
            orgId: org.id,
            url: "https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?q=80&w=1200&auto=format&fit=crop",
            caption: "Front 3/4",
            sortOrder: 1,
          },
        ],
      },
      priceHistory: {
        create: [
          {
            orgId: org.id,
            previous: 35995,
            next: 34995,
            note: "Adjusted to align with local comps",
            createdById: manager.id,
          },
        ],
      },
    },
  });

  const reconTask = await prisma.reconTask.create({
    data: {
      orgId: org.id,
      vehicleId: vehicle1.id,
      vendorId: reconVendor.id,
      title: "Bumper repaint and polish",
      status: ReconTaskStatus.IN_PROGRESS,
      dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2),
      notes: "Confirm color blend with hood edge",
      lineItems: {
        create: [
          {
            orgId: org.id,
            category: "Labor",
            description: "Paint prep and spray",
            quantity: 4,
            unitCost: 95,
            totalCost: 380,
          },
          {
            orgId: org.id,
            category: "Parts",
            description: "Paint materials",
            quantity: 1,
            unitCost: 140,
            totalCost: 140,
          },
        ],
      },
    },
  });

  const vehicle2 = await prisma.vehicle.create({
    data: {
      orgId: org.id,
      vin: "WBA8E9G56GNU00002",
      stockNumber: "STK-1002",
      year: 2020,
      make: "BMW",
      model: "330i",
      trim: "Sedan",
      mileage: 39750,
      status: VehicleStatus.READY,
      purchaseSource: "Trade",
      listPrice: 28995,
      minPrice: 27995,
      costAcquisition: 23500,
      costParts: 150,
      costLabor: 260,
      costMisc: 40,
      location: "Front Line",
    },
  });

  const customer = await prisma.customer.create({
    data: {
      orgId: org.id,
      firstName: "Jordan",
      lastName: "Miles",
      email: "jordan.miles@example.com",
      phone: "555-0199",
      city: "Austin",
      state: "TX",
      notes: "Prefers text communication after 5PM.",
    },
  });

  const lead = await prisma.lead.create({
    data: {
      orgId: org.id,
      customerId: customer.id,
      vehicleId: vehicle2.id,
      source: "Autotrader",
      stage: LeadStage.APPOINTMENT_SET,
      nextAction: "Confirm finance docs",
      nextActionAt: new Date(Date.now() + 1000 * 60 * 60 * 4),
      slaDueAt: new Date(Date.now() + 1000 * 60 * 60),
      assignedToId: sales.id,
      statusNote: "Customer requested OTD quote",
    },
  });

  await prisma.appointment.create({
    data: {
      orgId: org.id,
      customerId: customer.id,
      leadId: lead.id,
      title: "Test drive + numbers",
      scheduledAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      status: AppointmentStatus.CONFIRMED,
      notes: "Bring trade title",
      createdById: sales.id,
    },
  });

  await prisma.messageTemplate.createMany({
    data: [
      {
        orgId: org.id,
        name: "Sales Follow-Up",
        channel: "email",
        body: "Thanks for visiting {{dealer.name}}. Are you available today to continue your deal options?",
        createdById: sales.id,
      },
      {
        orgId: org.id,
        name: "Service Status Update",
        channel: "sms",
        body: "Your vehicle service is in progress. We will send another update once technician work is complete.",
        createdById: service.id,
      },
    ],
  });

  await prisma.crmTask.create({
    data: {
      orgId: org.id,
      title: "Follow up with lead before lunch",
      description: "Call customer and confirm lender stip progress.",
      dueAt: new Date(Date.now() - 1000 * 60 * 30),
      assignedToId: sales.id,
      createdById: manager.id,
      leadId: lead.id,
      customerId: customer.id,
    },
  });

  const deal = await prisma.deal.create({
    data: {
      orgId: org.id,
      dealNumber: "D-2026-0001",
      dealType: DealType.FINANCE,
      jurisdiction: "TX",
      vehicleId: vehicle2.id,
      customerId: customer.id,
      salespersonId: sales.id,
      stage: DealStage.SUBMITTED,
      salePrice: 28495,
      downPayment: 3000,
      apr: 6.25,
      termMonths: 72,
      taxes: 2137.13,
      fees: 698,
      tradeAllowance: 2000,
      payoff: 0,
      financedAmount: 26330.13,
      monthlyPayment: 440.22,
      fundingStatus: FundingStatus.IN_REVIEW,
      checklist: {
        insurance: true,
        odometer: true,
        idVerification: false,
        stips: false,
      },
      notes: "Pending proof of income.",
      lineItems: {
        create: [
          {
            orgId: org.id,
            type: "FEE",
            label: "Doc Fee",
            amount: 499,
          },
          {
            orgId: org.id,
            type: "FEE",
            label: "License Fee",
            amount: 199,
          },
        ],
      },
    },
  });

  await prisma.payment.create({
    data: {
      orgId: org.id,
      dealId: deal.id,
      customerId: customer.id,
      amount: 3000,
      method: PaymentMethod.ACH,
      reference: "ACH-000781",
      notes: "Down payment received",
      createdById: accounting.id,
      postedAt: new Date(),
    },
  });

  await prisma.fundingEvent.create({
    data: {
      orgId: org.id,
      dealId: deal.id,
      status: FundingStatus.IN_REVIEW,
      amount: 26330.13,
      note: "Sent to lender queue",
      createdById: accounting.id,
      eventAt: new Date(),
    },
  });

  const fundingCase = await prisma.fundingCase.create({
    data: {
      orgId: org.id,
      dealId: deal.id,
      lenderName: "Summit Credit Union",
      lenderContactName: "Drew Underwriter",
      lenderContactEmail: "drew.underwriter@summitcu.dev",
      status: FundingCaseStatus.STIPS_REQUESTED,
      amountFinanced: 26330.13,
      reserveAmount: 375,
      feeTotal: 95,
      nextAction: "Collect proof of income and utility bill",
      nextActionAt: new Date(Date.now() + 1000 * 60 * 60 * 2),
      submittedAt: new Date(Date.now() - 1000 * 60 * 60 * 6),
      notes: "Initial lender review returned stip request.",
      createdById: accounting.id,
    },
  });

  await prisma.fundingStip.createMany({
    data: [
      {
        orgId: org.id,
        fundingCaseId: fundingCase.id,
        docType: "PROOF_OF_INCOME",
        required: true,
        notes: "Two most recent pay stubs required.",
      },
      {
        orgId: org.id,
        fundingCaseId: fundingCase.id,
        docType: "PROOF_OF_RESIDENCE",
        required: true,
        receivedAt: new Date(),
        notes: "Utility bill received; pending verification.",
      },
    ],
  });

  await prisma.activityLog.createMany({
    data: [
      {
        orgId: org.id,
        userId: sales.id,
        customerId: customer.id,
        leadId: lead.id,
        entityType: "Lead",
        entityId: lead.id,
        type: ActivityType.NOTE,
        message: "Customer requested a quote with 72-month financing.",
      },
      {
        orgId: org.id,
        userId: service.id,
        entityType: "ReconTask",
        entityId: reconTask.id,
        type: ActivityType.STATUS_CHANGE,
        message: "Recon task moved to IN_PROGRESS.",
      },
    ],
  });

  await prisma.savedView.createMany({
    data: [
      {
        orgId: org.id,
        userId: manager.id,
        entityKey: "inventory",
        name: "Recon Aging > 2 Days",
        filterJson: {
          status: "RECON",
          sort: "acquiredAt",
          direction: "asc",
        },
      },
      {
        orgId: org.id,
        userId: sales.id,
        entityKey: "leads",
        name: "SLA At Risk",
        filterJson: {
          stage: ["NEW", "CONTACTED", "QUALIFIED", "APPOINTMENT_SET"],
          slaRiskOnly: true,
        },
      },
      {
        orgId: org.id,
        userId: service.id,
        entityKey: "fixedops-repair-orders",
        name: "Waiting Approvals",
        filterJson: {
          status: ["AWAITING_APPROVAL"],
          sort: "approvalRequestedAt",
          direction: "asc",
        },
      },
    ],
  });

  const filtersVendor = await prisma.partVendor.create({
    data: {
      orgId: org.id,
      name: "Prime Parts Supply",
      email: "orders@primeparts.dev",
      phone: "555-0120",
    },
  });

  const [oilFilter, brakePad] = await prisma.$transaction([
    prisma.part.create({
      data: {
        orgId: org.id,
        vendorId: filtersVendor.id,
        partNumber: "OF-041",
        description: "Synthetic Oil Filter",
        binLocation: "A-12",
        onHandQty: 24,
        reorderPoint: 8,
        unitCost: 6.5,
        unitPrice: 19.99,
        taxable: true,
      },
    }),
    prisma.part.create({
      data: {
        orgId: org.id,
        vendorId: filtersVendor.id,
        partNumber: "BP-220",
        description: "Front Brake Pad Set",
        binLocation: "B-04",
        onHandQty: 6,
        reorderPoint: 4,
        unitCost: 42,
        unitPrice: 119.95,
        taxable: true,
      },
    }),
  ]);

  const serviceAppt = await prisma.serviceAppointment.create({
    data: {
      orgId: org.id,
      customerId: customer.id,
      vehicleId: vehicle2.id,
      technicianId: techA.id,
      title: "Brake inspection + oil service",
      concern: "Brake squeal and maintenance light",
      scheduledAt: new Date(Date.now() + 1000 * 60 * 60 * 3),
      status: ServiceAppointmentStatus.CONFIRMED,
      notes: "Customer waiting in lounge.",
      createdById: service.id,
    },
  });

  await prisma.serviceAppointment.create({
    data: {
      orgId: org.id,
      customerId: customer.id,
      vehicleId: vehicle2.id,
      technicianId: techB.id,
      title: "Scheduled 30k service",
      concern: "Routine maintenance package",
      scheduledAt: new Date(Date.now() + 1000 * 60 * 60 * 30),
      status: ServiceAppointmentStatus.SCHEDULED,
      createdById: service.id,
    },
  });

  const repairOrder = await prisma.repairOrder.create({
    data: {
      orgId: org.id,
      roNumber: "RO-2026-0001",
      customerId: customer.id,
      vehicleId: vehicle2.id,
      advisorId: service.id,
      serviceAppointmentId: serviceAppt.id,
      status: RepairOrderStatus.AWAITING_APPROVAL,
      customerNotes: "Noise from front axle at low speed.",
      internalNotes: "MPI photos pending upload.",
      mpiChecklist: {
        tires: "green",
        brakes: "red",
        fluids: "yellow",
      },
      approvalRequestedAt: new Date(),
      subtotalLabor: 129.95,
      subtotalParts: 139.94,
      subtotalSublet: 0,
      subtotalFees: 15,
      taxTotal: 12.44,
      grandTotal: 297.33,
    },
  });

  await prisma.serviceAppointment.update({
    where: { id: serviceAppt.id },
    data: {
      convertedToRoId: repairOrder.id,
      status: ServiceAppointmentStatus.CHECKED_IN,
    },
  });

  const [laborLine, partLine] = await prisma.$transaction([
    prisma.repairOrderLine.create({
      data: {
        orgId: org.id,
        repairOrderId: repairOrder.id,
        lineNumber: 1,
        type: RepairOrderLineType.LABOR,
        description: "Brake inspection and road test",
        operationCode: "BRK-INSP",
        technicianId: techA.id,
        quantity: 1,
        flatRateHours: 1.5,
        actualHours: 1.25,
        unitCost: 38,
        unitPrice: 129.95,
        taxable: false,
        decision: RepairOrderLineDecision.APPROVED,
        approvedAt: new Date(),
        approvedById: service.id,
      },
    }),
    prisma.repairOrderLine.create({
      data: {
        orgId: org.id,
        repairOrderId: repairOrder.id,
        lineNumber: 2,
        type: RepairOrderLineType.PART,
        description: "Front brake pad set",
        partId: brakePad.id,
        technicianId: techA.id,
        quantity: 1,
        unitCost: 42,
        unitPrice: 119.95,
        taxable: true,
        decision: RepairOrderLineDecision.RECOMMENDED,
      },
    }),
  ]);

  await prisma.timePunch.create({
    data: {
      orgId: org.id,
      technicianId: techA.id,
      repairOrderId: repairOrder.id,
      lineId: laborLine.id,
      clockInAt: new Date(Date.now() - 1000 * 60 * 75),
      clockOutAt: new Date(Date.now() - 1000 * 60 * 5),
      minutesWorked: 70,
      createdById: service.id,
    },
  });

  await prisma.$transaction([
    prisma.partTransaction.create({
      data: {
        orgId: org.id,
        partId: brakePad.id,
        repairOrderId: repairOrder.id,
        lineId: partLine.id,
        type: PartTransactionType.ALLOCATE,
        quantity: -1,
        unitCost: 42,
        unitPrice: 119.95,
        reference: repairOrder.roNumber,
        reason: "RO allocation",
      },
    }),
    prisma.part.update({
      where: { id: brakePad.id },
      data: {
        onHandQty: { decrement: 1 },
        reservedQty: { increment: 1 },
      },
    }),
    prisma.partTransaction.create({
      data: {
        orgId: org.id,
        partId: oilFilter.id,
        type: PartTransactionType.RECEIVE,
        quantity: 4,
        unitCost: 6.5,
        unitPrice: 19.99,
        reference: "PO-2026-1001",
        reason: "Stock top-up",
      },
    }),
  ]);

  const currentMonthStart = new Date();
  currentMonthStart.setUTCDate(1);
  currentMonthStart.setUTCHours(0, 0, 0, 0);
  const nextMonthStart = new Date(currentMonthStart);
  nextMonthStart.setUTCMonth(nextMonthStart.getUTCMonth() + 1);
  const periodKey = `${currentMonthStart.getUTCFullYear()}-${String(currentMonthStart.getUTCMonth() + 1).padStart(2, "0")}`;

  const accountingPeriod = await prisma.accountingPeriod.create({
    data: {
      orgId: org.id,
      periodKey,
      startDate: currentMonthStart,
      endDate: new Date(nextMonthStart.getTime() - 1000),
      status: AccountingPeriodStatus.OPEN,
    },
  });

  const coaSeed = [
    { code: "1000", name: "Cash - Operating", type: AccountType.ASSET },
    { code: "1100", name: "Accounts Receivable", type: AccountType.ASSET },
    { code: "2100", name: "Sales Tax Payable", type: AccountType.LIABILITY },
    { code: "4020", name: "Vehicle Sales Revenue", type: AccountType.REVENUE },
    { code: "4000", name: "Service Labor Revenue", type: AccountType.REVENUE },
    { code: "4010", name: "Parts Revenue", type: AccountType.REVENUE },
    { code: "5000", name: "Parts COGS", type: AccountType.COGS },
  ];
  const createdCoa = await Promise.all(
    coaSeed.map((account) =>
      prisma.chartOfAccount.create({
        data: {
          orgId: org.id,
          code: account.code,
          name: account.name,
          type: account.type,
        },
      }),
    ),
  );
  const coaByCode = new Map(createdCoa.map((account) => [account.code, account]));

  await prisma.postingAccountMap.createMany({
    data: [
      { orgId: org.id, sourceType: JournalSourceType.RO_CLOSE, key: "cash", accountId: coaByCode.get("1000")!.id },
      { orgId: org.id, sourceType: JournalSourceType.RO_CLOSE, key: "laborRevenue", accountId: coaByCode.get("4000")!.id },
      { orgId: org.id, sourceType: JournalSourceType.RO_CLOSE, key: "partsRevenue", accountId: coaByCode.get("4010")!.id },
      { orgId: org.id, sourceType: JournalSourceType.RO_CLOSE, key: "taxPayable", accountId: coaByCode.get("2100")!.id },
      { orgId: org.id, sourceType: JournalSourceType.RO_CLOSE, key: "partsCogs", accountId: coaByCode.get("5000")!.id },
      { orgId: org.id, sourceType: JournalSourceType.DEAL_DELIVERY, key: "cash", accountId: coaByCode.get("1000")!.id },
      { orgId: org.id, sourceType: JournalSourceType.DEAL_DELIVERY, key: "salesRevenue", accountId: coaByCode.get("4020")!.id },
      { orgId: org.id, sourceType: JournalSourceType.DEAL_DELIVERY, key: "taxPayable", accountId: coaByCode.get("2100")!.id },
    ],
  });

  const serviceEntry = await prisma.journalEntry.create({
    data: {
      orgId: org.id,
      entryNumber: "JE-2026-0001",
      description: "Seed service posting for sample RO",
      postedAt: new Date(),
      sourceType: JournalSourceType.RO_CLOSE,
      sourceId: repairOrder.id,
      periodId: accountingPeriod.id,
      totalDebit: 297.33,
      totalCredit: 297.33,
      createdById: accounting.id,
    },
  });

  await prisma.journalLine.createMany({
    data: [
      {
        orgId: org.id,
        journalEntryId: serviceEntry.id,
        accountId: coaByCode.get("1000")!.id,
        description: "Service cash receipt",
        debit: 297.33,
        credit: 0,
      },
      {
        orgId: org.id,
        journalEntryId: serviceEntry.id,
        accountId: coaByCode.get("4000")!.id,
        description: "Labor revenue",
        debit: 0,
        credit: 129.95,
      },
      {
        orgId: org.id,
        journalEntryId: serviceEntry.id,
        accountId: coaByCode.get("4010")!.id,
        description: "Parts revenue",
        debit: 0,
        credit: 139.94,
      },
      {
        orgId: org.id,
        journalEntryId: serviceEntry.id,
        accountId: coaByCode.get("2100")!.id,
        description: "Tax payable",
        debit: 0,
        credit: 12.44,
      },
      {
        orgId: org.id,
        journalEntryId: serviceEntry.id,
        accountId: coaByCode.get("5000")!.id,
        description: "Parts cost",
        debit: 15,
        credit: 0,
      },
    ],
  });

  const webhookEndpoint = await prisma.webhookEndpoint.create({
    data: {
      orgId: org.id,
      name: "Local Demo Endpoint",
      targetUrl: "http://localhost:3000/api/health",
      secret: "whsec_demo_local_secret",
      eventTypes: ["repairOrder.closed", "journalEntry.posted", "part.transaction.created"],
      createdById: owner.id,
    },
  });

  const webhookEvent = await prisma.webhookEvent.create({
    data: {
      orgId: org.id,
      eventType: "repairOrder.updated",
      entityType: "RepairOrder",
      entityId: repairOrder.id,
      payloadJson: {
        roNumber: repairOrder.roNumber,
        status: repairOrder.status,
      },
    },
  });

  await prisma.webhookDelivery.create({
    data: {
      orgId: org.id,
      webhookEventId: webhookEvent.id,
      endpointId: webhookEndpoint.id,
      status: "PENDING",
      attemptCount: 0,
      nextAttemptAt: new Date(),
    },
  });

  await prisma.apiKey.create({
    data: {
      orgId: org.id,
      name: "Demo Public API Key",
      keyPrefix: "ff_demo",
      keyHash: createHash("sha256").update("ff_demo_seed_secret").digest("hex"),
      scopes: [ApiKeyScope.VEHICLES_READ, ApiKeyScope.CUSTOMERS_READ, ApiKeyScope.REPAIR_ORDERS_READ],
      createdById: owner.id,
    },
  });

  await prisma.auditEvent.createMany({
    data: [
      {
        orgId: org.id,
        actorId: owner.id,
        entityType: "Vehicle",
        entityId: vehicle1.id,
        action: AuditAction.CREATE,
        after: toJson(vehicle1),
      },
      {
        orgId: org.id,
        actorId: owner.id,
        entityType: "Customer",
        entityId: customer.id,
        action: AuditAction.CREATE,
        after: toJson(customer),
      },
      {
        orgId: org.id,
        actorId: owner.id,
        entityType: "Deal",
        entityId: deal.id,
        action: AuditAction.CREATE,
        after: toJson(deal),
      },
      {
        orgId: org.id,
        actorId: service.id,
        entityType: "RepairOrder",
        entityId: repairOrder.id,
        action: AuditAction.CREATE,
        after: toJson(repairOrder),
      },
    ],
  });

  console.log("Seed complete.");
  console.log("Demo login: owner@summitauto.dev / demo1234");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
