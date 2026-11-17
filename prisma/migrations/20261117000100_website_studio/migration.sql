-- Additive public-site configuration. No existing rows are rewritten or removed.
CREATE TABLE IF NOT EXISTS "WebsiteSection" (
  "key" TEXT NOT NULL PRIMARY KEY,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "data" JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- Photo-only past journals need no invented travel dates.
ALTER TABLE "Trip" ALTER COLUMN "startDate" DROP NOT NULL;
ALTER TABLE "TripDay" ALTER COLUMN "date" DROP NOT NULL;
