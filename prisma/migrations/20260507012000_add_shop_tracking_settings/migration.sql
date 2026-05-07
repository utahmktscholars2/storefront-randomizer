-- Per-shop analytics settings controlled from the embedded app.
CREATE TABLE "ShopTrackingSettings" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "trackClicks" BOOLEAN NOT NULL DEFAULT true,
    "trackPageDuration" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopTrackingSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ShopTrackingSettings_shop_key" ON "ShopTrackingSettings"("shop");
