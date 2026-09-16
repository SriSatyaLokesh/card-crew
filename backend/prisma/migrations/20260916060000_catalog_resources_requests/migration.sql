-- CreateEnum
CREATE TYPE "ResourceVisibility" AS ENUM ('private', 'friends', 'network');

-- CreateEnum
CREATE TYPE "ResourceStatus" AS ENUM ('active', 'inactive', 'removed');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('pending', 'approved', 'declined', 'ignored');

-- CreateTable
CREATE TABLE "CardCatalog" (
    "id" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "card_type" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "variant" TEXT,
    "country" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CardCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resource" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "card_catalog_id" TEXT NOT NULL,
    "visibility" "ResourceVisibility" NOT NULL DEFAULT 'friends',
    "request_enabled" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "status" "ResourceStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Request" (
    "id" TEXT NOT NULL,
    "requester_id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "message" TEXT NOT NULL DEFAULT '',
    "status" "RequestStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMP(3),

    CONSTRAINT "Request_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Resource_owner_id_idx" ON "Resource"("owner_id");

-- CreateIndex
CREATE INDEX "Resource_card_catalog_id_idx" ON "Resource"("card_catalog_id");

-- CreateIndex
CREATE INDEX "Request_requester_id_idx" ON "Request"("requester_id");

-- CreateIndex
CREATE INDEX "Request_owner_id_idx" ON "Request"("owner_id");

-- CreateIndex
CREATE INDEX "Request_resource_id_idx" ON "Request"("resource_id");

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_card_catalog_id_fkey" FOREIGN KEY ("card_catalog_id") REFERENCES "CardCatalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SeedCuratedCatalog
INSERT INTO "CardCatalog" ("id", "issuer", "product_name", "card_type", "network", "variant", "country", "active", "created_at", "updated_at") VALUES
    ('hdfc-infinia', 'HDFC', 'Infinia', 'credit', 'Mastercard', 'Infinite', 'IN', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('hdfc-regalia-gold', 'HDFC', 'Regalia Gold', 'credit', 'Visa', 'Gold', 'IN', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('axis-atlas', 'Axis', 'Atlas', 'credit', 'Visa', 'Rewards', 'IN', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('amex-platinum', 'American Express', 'Platinum', 'credit', 'American Express', 'Platinum', 'IN', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
