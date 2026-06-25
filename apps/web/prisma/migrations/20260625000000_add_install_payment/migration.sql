-- CreateTable
CREATE TABLE "InstallPayment" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "region" TEXT NOT NULL,
    "sourcePeriod" TEXT NOT NULL,
    "sourceRow" INTEGER NOT NULL,
    "salesRep" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "installDate" DATE NOT NULL,
    "contractPrice" DECIMAL(12,2),
    "payment1" DECIMAL(12,2),
    "payment2" DECIMAL(12,2),
    "payment3" DECIMAL(12,2),
    "payment4" DECIMAL(12,2),
    "balanceOwed" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstallPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InstallPayment_tenantId_idx" ON "InstallPayment"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "InstallPayment_tenantId_region_sourcePeriod_sourceRow_key" ON "InstallPayment"("tenantId", "region", "sourcePeriod", "sourceRow");

-- AddForeignKey
ALTER TABLE "InstallPayment" ADD CONSTRAINT "InstallPayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
