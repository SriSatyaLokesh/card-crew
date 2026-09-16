ALTER TABLE "CardCatalog"
  ADD COLUMN "card_category" TEXT NOT NULL DEFAULT 'credit',
  ADD COLUMN "upi_enabled" BOOLEAN NOT NULL DEFAULT false;
