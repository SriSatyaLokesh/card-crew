CREATE TYPE "ReferralStatus" AS ENUM ('not_required', 'pending', 'approved', 'declined', 'ignored');

ALTER TABLE "Request"
  ADD COLUMN "intermediary_id" TEXT,
  ADD COLUMN "referral_status" "ReferralStatus" NOT NULL DEFAULT 'not_required';

CREATE INDEX "Request_intermediary_id_idx" ON "Request"("intermediary_id");

ALTER TABLE "Request"
  ADD CONSTRAINT "Request_intermediary_id_fkey" FOREIGN KEY ("intermediary_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
