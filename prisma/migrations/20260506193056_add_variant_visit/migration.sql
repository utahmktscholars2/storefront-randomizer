-- CreateTable
CREATE TABLE "VariantVisit" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "experimentKey" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "sessionId" TEXT,
    "variant" TEXT NOT NULL,
    "pageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VariantVisit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VariantVisit_shop_idx" ON "VariantVisit"("shop");

-- CreateIndex
CREATE INDEX "VariantVisit_experimentKey_idx" ON "VariantVisit"("experimentKey");

-- CreateIndex
CREATE INDEX "VariantVisit_visitorId_idx" ON "VariantVisit"("visitorId");

-- CreateIndex
CREATE INDEX "VariantVisit_createdAt_idx" ON "VariantVisit"("createdAt");
