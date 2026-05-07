-- Track time spent on each storefront page view.
CREATE TABLE "PageDuration" (
    "id" TEXT NOT NULL,
    "pageViewId" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "experimentKey" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "sessionId" TEXT,
    "variant" TEXT NOT NULL,
    "pageUrl" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PageDuration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PageDuration_pageViewId_key" ON "PageDuration"("pageViewId");
CREATE INDEX "PageDuration_shop_idx" ON "PageDuration"("shop");
CREATE INDEX "PageDuration_shop_startedAt_idx" ON "PageDuration"("shop", "startedAt");
CREATE INDEX "PageDuration_shop_visitorId_sessionId_idx" ON "PageDuration"("shop", "visitorId", "sessionId");
CREATE INDEX "PageDuration_experimentKey_idx" ON "PageDuration"("experimentKey");
