-- CreateEnum
CREATE TYPE "SpecSource" AS ENUM ('MANUAL', 'VIN_DECODE');

-- CreateEnum
CREATE TYPE "SpecVersion" AS ENUM ('AS_LISTED', 'AS_SOLD');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "UpfitJobStatus" AS ENUM ('DRAFT', 'PLANNED', 'IN_PROGRESS', 'WAITING_PARTS', 'COMPLETED', 'CANCELED');

-- CreateEnum
CREATE TYPE "DealDocumentChecklistStatus" AS ENUM ('PENDING', 'GENERATED', 'BLOCKED', 'MISSING_DATA');

-- CreateTable
CREATE TABLE "VehicleSpec" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "dealId" TEXT,
    "source" "SpecSource" NOT NULL DEFAULT 'MANUAL',
    "version" "SpecVersion" NOT NULL DEFAULT 'AS_LISTED',
    "gvwr" INTEGER,
    "gawrFront" INTEGER,
    "gawrRear" INTEGER,
    "axleConfig" TEXT,
    "wheelbaseIn" DECIMAL(8,2),
    "bodyType" TEXT,
    "boxLengthIn" DECIMAL(8,2),
    "cabType" TEXT,
    "engine" TEXT,
    "transmission" TEXT,
    "fuelType" TEXT,
    "ptoCapable" BOOLEAN NOT NULL DEFAULT false,
    "hitchRating" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleSpec_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntityAttachment" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "url" TEXT,
    "uploadedById" TEXT,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EntityAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FleetAccount" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "locationsJson" JSONB,
    "billingTerms" TEXT,
    "taxExempt" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FleetAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FleetAccountCustomer" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "fleetAccountId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "roleLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FleetAccountCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "quoteNumber" TEXT NOT NULL,
    "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
    "customerId" TEXT,
    "fleetAccountId" TEXT,
    "dealId" TEXT,
    "createdById" TEXT,
    "expiresAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "shareToken" TEXT,
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "taxableTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "costTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "grossTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteLine" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "taxable" BOOLEAN NOT NULL DEFAULT true,
    "unitCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "lineSubtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "lineTax" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "lineCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "lineGross" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscountApprovalRequest" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "quoteId" TEXT,
    "requestedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reason" TEXT NOT NULL,
    "delta" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedAt" TIMESTAMP(3),
    "responseNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscountApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UpfitJob" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "dealId" TEXT,
    "quoteId" TEXT,
    "vendorId" TEXT,
    "status" "UpfitJobStatus" NOT NULL DEFAULT 'PLANNED',
    "eta" TIMESTAMP(3),
    "internalNotes" TEXT,
    "customerNotes" TEXT,
    "costEstimate" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "actualCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "billableToCustomer" BOOLEAN NOT NULL DEFAULT true,
    "includeActualCosts" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UpfitJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UpfitMilestone" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "upfitJobId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UpfitMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentPackTemplate" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "state" CHAR(2) NOT NULL,
    "saleType" "DealType",
    "rulesJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentPackTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentPackTemplateItem" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "packTemplateId" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "blocking" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "documentTemplateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentPackTemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealDocumentChecklistItem" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "packTemplateId" TEXT,
    "documentType" "DocumentType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "status" "DealDocumentChecklistStatus" NOT NULL DEFAULT 'PENDING',
    "blocking" BOOLEAN NOT NULL DEFAULT true,
    "generatedDocumentId" TEXT,
    "missingFieldsJson" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealDocumentChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VehicleSpec_orgId_vehicleId_version_createdAt_idx" ON "VehicleSpec"("orgId", "vehicleId", "version", "createdAt");

-- CreateIndex
CREATE INDEX "VehicleSpec_orgId_dealId_idx" ON "VehicleSpec"("orgId", "dealId");

-- CreateIndex
CREATE INDEX "EntityAttachment_orgId_entityType_entityId_createdAt_idx" ON "EntityAttachment"("orgId", "entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "EntityAttachment_orgId_uploadedById_createdAt_idx" ON "EntityAttachment"("orgId", "uploadedById", "createdAt");

-- CreateIndex
CREATE INDEX "FleetAccount_orgId_createdAt_idx" ON "FleetAccount"("orgId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FleetAccount_orgId_name_key" ON "FleetAccount"("orgId", "name");

-- CreateIndex
CREATE INDEX "FleetAccountCustomer_orgId_fleetAccountId_createdAt_idx" ON "FleetAccountCustomer"("orgId", "fleetAccountId", "createdAt");

-- CreateIndex
CREATE INDEX "FleetAccountCustomer_orgId_customerId_createdAt_idx" ON "FleetAccountCustomer"("orgId", "customerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FleetAccountCustomer_fleetAccountId_customerId_key" ON "FleetAccountCustomer"("fleetAccountId", "customerId");

-- CreateIndex
CREATE INDEX "Quote_orgId_status_createdAt_idx" ON "Quote"("orgId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Quote_orgId_expiresAt_idx" ON "Quote"("orgId", "expiresAt");

-- CreateIndex
CREATE INDEX "Quote_orgId_shareToken_idx" ON "Quote"("orgId", "shareToken");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_orgId_quoteNumber_key" ON "Quote"("orgId", "quoteNumber");

-- CreateIndex
CREATE INDEX "QuoteLine_orgId_quoteId_createdAt_idx" ON "QuoteLine"("orgId", "quoteId", "createdAt");

-- CreateIndex
CREATE INDEX "QuoteLine_orgId_vehicleId_createdAt_idx" ON "QuoteLine"("orgId", "vehicleId", "createdAt");

-- CreateIndex
CREATE INDEX "DiscountApprovalRequest_orgId_status_createdAt_idx" ON "DiscountApprovalRequest"("orgId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "DiscountApprovalRequest_orgId_entityType_entityId_idx" ON "DiscountApprovalRequest"("orgId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "DiscountApprovalRequest_orgId_quoteId_createdAt_idx" ON "DiscountApprovalRequest"("orgId", "quoteId", "createdAt");

-- CreateIndex
CREATE INDEX "UpfitJob_orgId_status_createdAt_idx" ON "UpfitJob"("orgId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "UpfitJob_orgId_vehicleId_createdAt_idx" ON "UpfitJob"("orgId", "vehicleId", "createdAt");

-- CreateIndex
CREATE INDEX "UpfitJob_orgId_dealId_createdAt_idx" ON "UpfitJob"("orgId", "dealId", "createdAt");

-- CreateIndex
CREATE INDEX "UpfitJob_orgId_quoteId_createdAt_idx" ON "UpfitJob"("orgId", "quoteId", "createdAt");

-- CreateIndex
CREATE INDEX "UpfitJob_orgId_vendorId_createdAt_idx" ON "UpfitJob"("orgId", "vendorId", "createdAt");

-- CreateIndex
CREATE INDEX "UpfitMilestone_orgId_upfitJobId_dueAt_idx" ON "UpfitMilestone"("orgId", "upfitJobId", "dueAt");

-- CreateIndex
CREATE INDEX "UpfitMilestone_orgId_completedAt_idx" ON "UpfitMilestone"("orgId", "completedAt");

-- CreateIndex
CREATE INDEX "DocumentPackTemplate_orgId_state_saleType_createdAt_idx" ON "DocumentPackTemplate"("orgId", "state", "saleType", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentPackTemplate_orgId_name_state_saleType_key" ON "DocumentPackTemplate"("orgId", "name", "state", "saleType");

-- CreateIndex
CREATE INDEX "DocumentPackTemplateItem_orgId_packTemplateId_sortOrder_idx" ON "DocumentPackTemplateItem"("orgId", "packTemplateId", "sortOrder");

-- CreateIndex
CREATE INDEX "DocumentPackTemplateItem_orgId_documentType_idx" ON "DocumentPackTemplateItem"("orgId", "documentType");

-- CreateIndex
CREATE INDEX "DealDocumentChecklistItem_orgId_dealId_status_createdAt_idx" ON "DealDocumentChecklistItem"("orgId", "dealId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "DealDocumentChecklistItem_orgId_status_createdAt_idx" ON "DealDocumentChecklistItem"("orgId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "DealDocumentChecklistItem_orgId_generatedDocumentId_idx" ON "DealDocumentChecklistItem"("orgId", "generatedDocumentId");

-- AddForeignKey
ALTER TABLE "VehicleSpec" ADD CONSTRAINT "VehicleSpec_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleSpec" ADD CONSTRAINT "VehicleSpec_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleSpec" ADD CONSTRAINT "VehicleSpec_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleSpec" ADD CONSTRAINT "VehicleSpec_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityAttachment" ADD CONSTRAINT "EntityAttachment_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityAttachment" ADD CONSTRAINT "EntityAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetAccount" ADD CONSTRAINT "FleetAccount_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetAccountCustomer" ADD CONSTRAINT "FleetAccountCustomer_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetAccountCustomer" ADD CONSTRAINT "FleetAccountCustomer_fleetAccountId_fkey" FOREIGN KEY ("fleetAccountId") REFERENCES "FleetAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetAccountCustomer" ADD CONSTRAINT "FleetAccountCustomer_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_fleetAccountId_fkey" FOREIGN KEY ("fleetAccountId") REFERENCES "FleetAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteLine" ADD CONSTRAINT "QuoteLine_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteLine" ADD CONSTRAINT "QuoteLine_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteLine" ADD CONSTRAINT "QuoteLine_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountApprovalRequest" ADD CONSTRAINT "DiscountApprovalRequest_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountApprovalRequest" ADD CONSTRAINT "DiscountApprovalRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountApprovalRequest" ADD CONSTRAINT "DiscountApprovalRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountApprovalRequest" ADD CONSTRAINT "DiscountApprovalRequest_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UpfitJob" ADD CONSTRAINT "UpfitJob_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UpfitJob" ADD CONSTRAINT "UpfitJob_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UpfitJob" ADD CONSTRAINT "UpfitJob_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UpfitJob" ADD CONSTRAINT "UpfitJob_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UpfitJob" ADD CONSTRAINT "UpfitJob_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UpfitJob" ADD CONSTRAINT "UpfitJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UpfitMilestone" ADD CONSTRAINT "UpfitMilestone_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UpfitMilestone" ADD CONSTRAINT "UpfitMilestone_upfitJobId_fkey" FOREIGN KEY ("upfitJobId") REFERENCES "UpfitJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UpfitMilestone" ADD CONSTRAINT "UpfitMilestone_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentPackTemplate" ADD CONSTRAINT "DocumentPackTemplate_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentPackTemplateItem" ADD CONSTRAINT "DocumentPackTemplateItem_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentPackTemplateItem" ADD CONSTRAINT "DocumentPackTemplateItem_packTemplateId_fkey" FOREIGN KEY ("packTemplateId") REFERENCES "DocumentPackTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentPackTemplateItem" ADD CONSTRAINT "DocumentPackTemplateItem_documentTemplateId_fkey" FOREIGN KEY ("documentTemplateId") REFERENCES "DocumentTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealDocumentChecklistItem" ADD CONSTRAINT "DealDocumentChecklistItem_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealDocumentChecklistItem" ADD CONSTRAINT "DealDocumentChecklistItem_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealDocumentChecklistItem" ADD CONSTRAINT "DealDocumentChecklistItem_packTemplateId_fkey" FOREIGN KEY ("packTemplateId") REFERENCES "DocumentPackTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealDocumentChecklistItem" ADD CONSTRAINT "DealDocumentChecklistItem_generatedDocumentId_fkey" FOREIGN KEY ("generatedDocumentId") REFERENCES "DealDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

