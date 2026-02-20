CREATE TABLE "ApiRateLimit" (
  "id" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "windowStart" TIMESTAMP(3) NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ApiRateLimit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ApiRateLimit_scope_key_windowStart_key"
ON "ApiRateLimit"("scope", "key", "windowStart");

CREATE INDEX "ApiRateLimit_windowStart_idx"
ON "ApiRateLimit"("windowStart");