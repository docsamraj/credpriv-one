-- Document gate tracking + interoperability & security foundation

ALTER TABLE "applications" ADD COLUMN "documentsCompleteAt" TIMESTAMP(3);

CREATE TABLE "integration_systems" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "systemType" TEXT NOT NULL,
    "baseUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_systems_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "integration_systems_code_key" ON "integration_systems"("code");

CREATE TABLE "external_identifiers" (
    "id" TEXT NOT NULL,
    "systemId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_identifiers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "external_identifiers_systemId_entityType_externalId_key" ON "external_identifiers"("systemId", "entityType", "externalId");
CREATE INDEX "external_identifiers_entityType_entityId_idx" ON "external_identifiers"("entityType", "entityId");

CREATE TABLE "webhook_subscriptions" (
    "id" TEXT NOT NULL,
    "systemId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "secretHash" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "webhook_subscriptions_event_isActive_idx" ON "webhook_subscriptions"("event", "isActive");

CREATE TABLE "data_exchange_logs" (
    "id" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "systemId" TEXT,
    "userId" TEXT,
    "payloadHash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_exchange_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "data_exchange_logs_entityType_entityId_idx" ON "data_exchange_logs"("entityType", "entityId");
CREATE INDEX "data_exchange_logs_createdAt_idx" ON "data_exchange_logs"("createdAt");

ALTER TABLE "external_identifiers" ADD CONSTRAINT "external_identifiers_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "integration_systems"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "webhook_subscriptions" ADD CONSTRAINT "webhook_subscriptions_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "integration_systems"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "data_exchange_logs" ADD CONSTRAINT "data_exchange_logs_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "integration_systems"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "data_exchange_logs" ADD CONSTRAINT "data_exchange_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
