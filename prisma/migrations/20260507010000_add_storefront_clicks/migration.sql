-- Track ordered storefront click events per visitor/session.
CREATE TABLE "StorefrontClick" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "experimentKey" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "sessionId" TEXT,
    "variant" TEXT NOT NULL,
    "pageUrl" TEXT,
    "clickedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sequence" INTEGER NOT NULL,
    "tagName" TEXT,
    "elementText" TEXT,
    "elementId" TEXT,
    "elementClasses" TEXT,
    "elementHref" TEXT,
    "elementRole" TEXT,
    "elementName" TEXT,
    "selector" TEXT,
    "abBlock" TEXT,
    "abVariant" TEXT,
    "x" INTEGER,
    "y" INTEGER,

    CONSTRAINT "StorefrontClick_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StorefrontClick_shop_idx" ON "StorefrontClick"("shop");
CREATE INDEX "StorefrontClick_shop_clickedAt_idx" ON "StorefrontClick"("shop", "clickedAt");
CREATE INDEX "StorefrontClick_shop_visitorId_sessionId_sequence_idx" ON "StorefrontClick"("shop", "visitorId", "sessionId", "sequence");
CREATE INDEX "StorefrontClick_experimentKey_idx" ON "StorefrontClick"("experimentKey");
