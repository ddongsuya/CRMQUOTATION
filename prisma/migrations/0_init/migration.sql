-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "quoteInitials" TEXT,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "teamId" INTEGER,
    "centerId" INTEGER,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prospect" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "pipeline" TEXT,
    "platform" TEXT,
    "stage" TEXT,
    "indTarget" TEXT,
    "croOutlook" TEXT,
    "founded" TEXT,
    "location" TEXT,
    "ceo" TEXT,
    "companyType" TEXT,
    "note" TEXT,
    "ownerId" INTEGER,
    "companyId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prospect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyReport" (
    "id" SERIAL NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "workContent" TEXT,
    "contractPlan" TEXT,
    "activityNote" TEXT,
    "contractAmount" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Center" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Center_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Target" (
    "id" SERIAL NOT NULL,
    "centerId" INTEGER,
    "period" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Target_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "centerId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" SERIAL NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "aliases" TEXT,
    "bizRegNo" TEXT,
    "industry" TEXT,
    "address" TEXT,
    "isNewClient" BOOLEAN NOT NULL DEFAULT true,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "position" TEXT,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deal" (
    "id" SERIAL NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "contactId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "modality" TEXT,
    "indication" TEXT,
    "clinicalDesign" TEXT,
    "submissionTarget" TEXT,
    "reportLanguage" TEXT NOT NULL DEFAULT 'KO',
    "translationRequested" BOOLEAN NOT NULL DEFAULT false,
    "stage" TEXT NOT NULL DEFAULT 'INQUIRY',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "lostReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" SERIAL NOT NULL,
    "dealId" INTEGER NOT NULL,
    "quoteId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "costEstimateSentAt" TIMESTAMP(3),
    "draftSentAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "contractNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentTerm" (
    "id" SERIAL NOT NULL,
    "contractId" INTEGER NOT NULL,
    "seq" INTEGER NOT NULL DEFAULT 1,
    "kind" TEXT NOT NULL DEFAULT 'ADVANCE',
    "ratio" DOUBLE PRECISION,
    "amount" DOUBLE PRECISION,
    "condition" TEXT,
    "studyId" INTEGER,
    "dueAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "PaymentTerm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Study" (
    "id" SERIAL NOT NULL,
    "dealId" INTEGER NOT NULL,
    "studyNumber" TEXT,
    "department" TEXT,
    "director" TEXT,
    "itemName" TEXT,
    "requestSentAt" TIMESTAMP(3),
    "studyEndAt" TIMESTAMP(3),
    "intakeCompletedAt" TIMESTAMP(3),
    "reportDraftDueAt" TIMESTAMP(3),
    "reportDraftIssuedAt" TIMESTAMP(3),
    "invoiceRequestedAt" TIMESTAMP(3),
    "invoiceIssuedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Study_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangeQuote" (
    "id" SERIAL NOT NULL,
    "dealId" INTEGER NOT NULL,
    "studyId" INTEGER,
    "kind" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "quoteId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChangeQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" SERIAL NOT NULL,
    "quoteNumber" TEXT NOT NULL,
    "revisedFromId" INTEGER,
    "supersededAt" TIMESTAMP(3),
    "userId" INTEGER,
    "dealId" INTEGER,
    "companyId" INTEGER,
    "contactId" INTEGER,
    "sentAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "accepted" BOOLEAN,
    "customerName" TEXT,
    "customerCompany" TEXT,
    "customerEmail" TEXT,
    "customerPhone" TEXT,
    "projectName" TEXT NOT NULL,
    "substanceName" TEXT,
    "substanceType" TEXT,
    "studyType" TEXT NOT NULL DEFAULT 'toxicity',
    "modality" TEXT NOT NULL,
    "priceStandard" TEXT NOT NULL DEFAULT 'MFDS',
    "testStandard" TEXT,
    "submissionPurpose" TEXT,
    "planJson" TEXT,
    "excipientCount" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'KRW',
    "exchangeRate" DOUBLE PRECISION,
    "discountRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "issuedAt" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "contractNo" TEXT,
    "contractAmount" DOUBLE PRECISION,
    "trackingNote" TEXT,
    "totalBeforeDiscount" DOUBLE PRECISION,
    "totalAfterDiscount" DOUBLE PRECISION,
    "vatAmount" DOUBLE PRECISION,
    "grandTotal" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteTracking" (
    "id" SERIAL NOT NULL,
    "quoteId" INTEGER NOT NULL,
    "conclusion" TEXT,
    "status" TEXT,
    "note" TEXT,
    "authorId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteTracking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteItem" (
    "id" SERIAL NOT NULL,
    "quoteId" INTEGER NOT NULL,
    "testItemKey" TEXT NOT NULL,
    "testNameSnapshot" TEXT NOT NULL,
    "adminRouteSnap" TEXT,
    "category" TEXT,
    "tag" TEXT,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'preset',
    "priority" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "unitPriceOverride" DOUBLE PRECISION,
    "studyWeeksOverride" INTEGER,
    "hamryangCountOverride" INTEGER,
    "customNote" TEXT,

    CONSTRAINT "QuoteItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataBlob" (
    "key" TEXT NOT NULL,
    "json" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataBlob_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" SERIAL NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "contactId" INTEGER,
    "dealId" INTEGER,
    "type" TEXT NOT NULL DEFAULT 'MEMO',
    "title" TEXT,
    "body" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" SERIAL NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "companyId" INTEGER,
    "contactId" INTEGER,
    "dealId" INTEGER,
    "title" TEXT NOT NULL,
    "memo" TEXT,
    "dueAt" TIMESTAMP(3),
    "done" BOOLEAN NOT NULL DEFAULT false,
    "doneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" SERIAL NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "contactId" INTEGER,
    "dealId" INTEGER,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'MEETING',
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "allDay" BOOLEAN NOT NULL DEFAULT true,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "location" TEXT,
    "attendeesClient" TEXT,
    "attendeesInternal" TEXT,
    "requests" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_teamId_idx" ON "User"("teamId");

-- CreateIndex
CREATE INDEX "User_centerId_idx" ON "User"("centerId");

-- CreateIndex
CREATE INDEX "Prospect_ownerId_idx" ON "Prospect"("ownerId");

-- CreateIndex
CREATE INDEX "DailyReport_ownerId_idx" ON "DailyReport"("ownerId");

-- CreateIndex
CREATE INDEX "DailyReport_date_idx" ON "DailyReport"("date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyReport_ownerId_date_key" ON "DailyReport"("ownerId", "date");

-- CreateIndex
CREATE INDEX "Target_centerId_idx" ON "Target"("centerId");

-- CreateIndex
CREATE UNIQUE INDEX "Target_centerId_period_key" ON "Target"("centerId", "period");

-- CreateIndex
CREATE INDEX "Team_centerId_idx" ON "Team"("centerId");

-- CreateIndex
CREATE INDEX "Company_ownerId_idx" ON "Company"("ownerId");

-- CreateIndex
CREATE INDEX "Contact_companyId_idx" ON "Contact"("companyId");

-- CreateIndex
CREATE INDEX "Deal_ownerId_idx" ON "Deal"("ownerId");

-- CreateIndex
CREATE INDEX "Deal_contactId_idx" ON "Deal"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_dealId_key" ON "Contract"("dealId");

-- CreateIndex
CREATE INDEX "PaymentTerm_contractId_idx" ON "PaymentTerm"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentTerm_contractId_seq_key" ON "PaymentTerm"("contractId", "seq");

-- CreateIndex
CREATE INDEX "Study_dealId_idx" ON "Study"("dealId");

-- CreateIndex
CREATE INDEX "Study_reportDraftDueAt_idx" ON "Study"("reportDraftDueAt");

-- CreateIndex
CREATE INDEX "ChangeQuote_dealId_idx" ON "ChangeQuote"("dealId");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_quoteNumber_key" ON "Quote"("quoteNumber");

-- CreateIndex
CREATE INDEX "Quote_userId_idx" ON "Quote"("userId");

-- CreateIndex
CREATE INDEX "Quote_status_idx" ON "Quote"("status");

-- CreateIndex
CREATE INDEX "Quote_dealId_idx" ON "Quote"("dealId");

-- CreateIndex
CREATE INDEX "Quote_companyId_idx" ON "Quote"("companyId");

-- CreateIndex
CREATE INDEX "Quote_contactId_idx" ON "Quote"("contactId");

-- CreateIndex
CREATE INDEX "Quote_userId_status_supersededAt_idx" ON "Quote"("userId", "status", "supersededAt");

-- CreateIndex
CREATE INDEX "Quote_revisedFromId_idx" ON "Quote"("revisedFromId");

-- CreateIndex
CREATE INDEX "QuoteTracking_quoteId_idx" ON "QuoteTracking"("quoteId");

-- CreateIndex
CREATE INDEX "QuoteItem_quoteId_idx" ON "QuoteItem"("quoteId");

-- CreateIndex
CREATE INDEX "Note_ownerId_idx" ON "Note"("ownerId");

-- CreateIndex
CREATE INDEX "Note_contactId_idx" ON "Note"("contactId");

-- CreateIndex
CREATE INDEX "Note_dealId_idx" ON "Note"("dealId");

-- CreateIndex
CREATE INDEX "Task_ownerId_idx" ON "Task"("ownerId");

-- CreateIndex
CREATE INDEX "Task_companyId_idx" ON "Task"("companyId");

-- CreateIndex
CREATE INDEX "Task_contactId_idx" ON "Task"("contactId");

-- CreateIndex
CREATE INDEX "Task_dealId_idx" ON "Task"("dealId");

-- CreateIndex
CREATE INDEX "Task_ownerId_done_dueAt_idx" ON "Task"("ownerId", "done", "dueAt");

-- CreateIndex
CREATE INDEX "CalendarEvent_ownerId_idx" ON "CalendarEvent"("ownerId");

-- CreateIndex
CREATE INDEX "CalendarEvent_startAt_idx" ON "CalendarEvent"("startAt");

-- CreateIndex
CREATE INDEX "CalendarEvent_contactId_idx" ON "CalendarEvent"("contactId");

-- CreateIndex
CREATE INDEX "CalendarEvent_dealId_idx" ON "CalendarEvent"("dealId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyReport" ADD CONSTRAINT "DailyReport_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Target" ADD CONSTRAINT "Target_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTerm" ADD CONSTRAINT "PaymentTerm_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Study" ADD CONSTRAINT "Study_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeQuote" ADD CONSTRAINT "ChangeQuote_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_revisedFromId_fkey" FOREIGN KEY ("revisedFromId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteTracking" ADD CONSTRAINT "QuoteTracking_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

